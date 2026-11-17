// The city of Solara Bay: its streets, blocks, buildings, palms, lights and props.
// One clear job: turn a seed into the whole static city and hand back the colliders
// and the road graph the traffic, the police and the missions drive on.
import * as THREE from 'three';
import { CITY } from './config.js';
import { mulberry32, pick, range, int } from './random.js';
import { buildingTexture, asphaltTexture, sidewalkTexture, sandTexture, signTexture } from './textures.js';

const BUILDING_COLORS = ['#e8b48f', '#d9a06b', '#c98f7a', '#a8b8c4', '#e0cfa8', '#b7a99a', '#8fa8b8', '#d8d3c8'];
const SIGN_WORDS = [
  ['TACOS', '#ffd166', '#30202a'],
  ['SURF', '#7fe3ff', '#12303a'],
  ['HOTEL', '#ff9fb2', '#2a1a2e'],
  ['PIZZA', '#ffe066', '#33241a'],
  ['BAR', '#9dffb0', '#14261a'],
  ['24H', '#ffffff', '#222831'],
];

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

/** The nearest point on the road network to (x, z), with the street it sits on. */
export function nearestRoadPoint(x, z) {
  let best = null;
  for (const s of CITY.STREETS) {
    const d1 = Math.abs(x - s);
    if (!best || d1 < best.d) best = { d: d1, x: s, z, axis: 'z' };
    const d2 = Math.abs(z - s);
    if (d2 < best.d) best = { d: d2, x, z: s, axis: 'x' };
  }
  return best;
}

/** True when (x, z) is on asphalt rather than inside a block. */
export function isOnRoad(x, z) {
  const onStreetX = CITY.STREETS.some((s) => Math.abs(x - s) <= CITY.STREET_HALF);
  const onStreetZ = CITY.STREETS.some((s) => Math.abs(z - s) <= CITY.STREET_HALF);
  return onStreetX || onStreetZ;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: one asphalt plane for the whole city, a sand strip and the sea past it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.EXTENT * 2 + 80, CITY.EXTENT * 2 + 80),
    new THREE.MeshLambertMaterial({ map: asphaltTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.EXTENT * 2 + 80, 26),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.EXTENT + 24);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.EXTENT * 2 + 80, 220),
    new THREE.MeshLambertMaterial({ color: '#2e7f9e' }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.EXTENT + 150);
  group.add(sea);

  // Sidewalk slabs, one per block, raised a hand's width above the road.
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
  const slabGeo = new THREE.BoxGeometry(CITY.BLOCK + 4, 0.24, CITY.BLOCK + 4);
  const slabMesh = new THREE.InstancedMesh(slabGeo, sidewalkMat, CITY.BLOCK_CENTERS.length ** 2);
  const m4 = new THREE.Matrix4();
  let slabIndex = 0;
  for (const bx of CITY.BLOCK_CENTERS) {
    for (const bz of CITY.BLOCK_CENTERS) {
      m4.makeTranslation(bx, 0.12, bz);
      slabMesh.setMatrixAt(slabIndex, m4);
      slabIndex += 1;
    }
  }
  slabMesh.receiveShadow = true;
  group.add(slabMesh);

  // Buildings: one instanced box per tower, tinted per instance, windowed facades.
  const placements = [];
  for (const bx of CITY.BLOCK_CENTERS) {
    for (const bz of CITY.BLOCK_CENTERS) {
      // The plaza block stays open: a fountain square at the city centre.
      if (bx === 0 && bz === 0) continue;
      const count = int(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 12, 20);
        const d = range(rng, 12, 20);
        const h = range(rng, 9, 42);
        const ox = range(rng, -9, 9);
        const oz = range(rng, -9, 9);
        placements.push({ x: bx + ox, z: bz + oz, w, d, h, color: pick(rng, BUILDING_COLORS) });
      }
    }
  }
  const facadeMats = [];
  for (let v = 0; v < 4; v++) {
    facadeMats.push(new THREE.MeshLambertMaterial({ map: buildingTexture(v, '#ffffff') }));
  }
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildings = new THREE.InstancedMesh(buildingGeo, facadeMats[0], placements.length);
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    m4.makeScale(p.w, p.h, p.d);
    m4.setPosition(p.x, p.h / 2 + 0.24, p.z);
    buildings.setMatrixAt(i, m4);
    buildings.setColorAt(i, color.set(p.color));
    colliders.push({
      minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
      minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
    });
  });
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  group.add(buildings);

  // The plaza: a fountain ring and benches where the centre block would be.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.1, 24),
    new THREE.MeshLambertMaterial({ color: '#7fb3c8' }),
  );
  fountain.position.set(0, 0.55, 0);
  group.add(fountain);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    group.add(box(3, 0.6, 1, '#7a6a55', Math.cos(a) * 13, 0.55, Math.sin(a) * 13));
  }

  // Palm trees along every street, on the sidewalk edges.
  const palmSpots = [];
  for (const s of CITY.STREETS) {
    for (let t = -180; t <= 180; t += 36) {
      if (rng() < 0.55) palmSpots.push([s + 9.5, t + range(rng, -4, 4)]);
      if (rng() < 0.55) palmSpots.push([t + range(rng, -4, 4), s + 9.5]);
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8a6a48' });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(2.6, 3.2, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: '#3f8f4f' });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.2, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.2, z);
    crowns.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks, crowns);

  // Street lamps at every intersection corner.
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: '#3a3f45' });
  const lampCount = CITY.STREETS.length * CITY.STREETS.length;
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampCount);
  const bulbGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe9b0' });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount);
  let li = 0;
  for (const sx of CITY.STREETS) {
    for (const sz of CITY.STREETS) {
      m4.makeTranslation(sx + 8.6, 3.25, sz + 8.6);
      lamps.setMatrixAt(li, m4);
      m4.makeTranslation(sx + 8.6, 6.6, sz + 8.6);
      bulbs.setMatrixAt(li, m4);
      li += 1;
    }
  }
  group.add(lamps, bulbs);

  // Traffic lights: one housing per intersection, its lamp swapped red/green by the sim.
  const lights = [];
  const housingGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5);
  const housingMat = new THREE.MeshLambertMaterial({ color: '#222222' });
  for (const sx of CITY.STREETS) {
    for (const sz of CITY.STREETS) {
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(sx - 8.6, 4.4, sz - 8.6);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 10),
        new THREE.MeshBasicMaterial({ color: '#ff4444' }),
      );
      lamp.position.set(sx - 8.6, 4.7, sz - 8.6);
      group.add(housing, lamp);
      lights.push({ x: sx, z: sz, lamp, phase: (sx + sz) % 24 });
    }
  }

  // Neon signs on a few towers, facing the avenues.
  for (let i = 0; i < 10; i++) {
    const p = placements[int(rng, 0, placements.length - 1)];
    const [word, fg, bg] = pick(rng, SIGN_WORDS);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: signTexture(word, fg, bg) }),
    );
    sign.position.set(p.x, Math.min(p.h - 2, 14), p.z + p.d / 2 + 0.15);
    group.add(sign);
  }

  // The docks: stacked shipping containers and crates.
  const containerColors = ['#b8542e', '#2e6db8', '#3e8f4f', '#c8a13a'];
  for (let i = 0; i < 8; i++) {
    const c = box(8, 2.6, 2.6, pick(rng, containerColors), 150 + (i % 4) * 9, 1.55 + Math.floor(i / 4) * 2.7, 178 + (i % 2) * 4);
    c.castShadow = true;
    group.add(c);
    colliders.push({ minX: c.position.x - 4, maxX: c.position.x + 4, minZ: c.position.z - 1.3, maxZ: c.position.z + 1.3 });
  }

  // The marina: three little boats bobbing past the sand.
  for (let i = 0; i < 3; i++) {
    const boat = box(6, 1.4, 2.2, '#f2f2f2', -150 + i * 22, 0.4, CITY.EXTENT + 52 + (i % 2) * 14);
    boat.rotation.y = range(rng, -0.4, 0.4);
    group.add(boat);
  }

  // Lane dashes down the middle of every street, instanced for cheap.
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: '#e8d44d' });
  const dashes = [];
  for (const s of CITY.STREETS) {
    for (let t = -200; t <= 200; t += 9) dashes.push([s, t, 0]);
    for (let t = -200; t <= 200; t += 9) dashes.push([t, s, 1]);
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const rot = new THREE.Matrix4();
  dashes.forEach(([x, z, axis], i) => {
    rot.makeRotationX(-Math.PI / 2);
    if (axis === 1) rot.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    rot.setPosition(x, 0.03, z);
    dashMesh.setMatrixAt(i, rot);
  });
  group.add(dashMesh);

  scene.add(group);
  return { colliders, lights };
}

/** Push a circle (x, z, radius) out of every building collider it overlaps. */
export function resolveCollisions(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(px, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      pz = cz + (dz / d) * radius;
    } else if (d2 <= 1e-6) {
      // Dead centre inside a building: shove out along the shortest side.
      const left = px - c.minX;
      const right = c.maxX - px;
      const top = pz - c.minZ;
      const bottom = c.maxZ - pz;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = c.minX - radius;
      else if (m === right) px = c.maxX + radius;
      else if (m === top) pz = c.minZ - radius;
      else pz = c.maxZ + radius;
    }
  }
  return [px, pz];
}
