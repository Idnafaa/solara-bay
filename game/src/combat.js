// Combat: fists and the pistol, with a raycast, damage and a burst of sparks.
// One clear job: what happens when Kai fights back.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { addHeat } from './wanted.js';

export function makeCombat() {
  return {
    sparks: [], // {mesh, life}
    tracer: null,
    flash: 0,
  };
}

function sparkBurst(scene, combat, x, y, z) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(24 * 3);
  for (let i = 0; i < 24; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffcc44', size: 0.35 });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  combat.sparks.push({ mesh: points, life: 0.25, vel: [] });
  for (let i = 0; i < 24; i++) {
    combat.sparks[combat.sparks.length - 1].vel.push([
      (Math.random() - 0.5) * 8,
      Math.random() * 6,
      (Math.random() - 0.5) * 8,
    ]);
  }
}

/** A pistol shot from the camera's centre: raycast peds, cars and cops. */
export function shoot(world, scene, combat, camera) {
  const player = world.player;
  if (!player.pistol || player.shootCooldown > 0 || !player.onFoot) return false;
  player.shootCooldown = 0.35;
  combat.flash = 0.08;
  const origin = new THREE.Vector3(player.x, player.y + 1.55, player.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(origin, dir, 0.1, PLAYER.PISTOL_RANGE);
  const targets = [];
  for (const ped of world.peds) {
    if (ped.alive) targets.push({ obj: ped.mesh, ref: { kind: 'ped', ped } });
  }
  for (const car of world.cars) {
    targets.push({ obj: car.group, ref: { kind: 'car', car } });
  }
  const hits = ray.intersectObjects(targets.map((t) => t.obj), true);
  let hitPoint = origin.clone().add(dir.clone().multiplyScalar(PLAYER.PISTOL_RANGE));
  if (hits.length > 0) {
    hitPoint = hits[0].point;
    let node = hits[0].object;
    while (node && !targets.some((t) => t.obj === node)) node = node.parent;
    const found = targets.find((t) => t.obj === node);
    if (found) {
      if (found.ref.kind === 'ped') {
        found.ref.ped.alive = false;
        addHeat(world.wanted, 1);
        world.events.push({ type: 'toast', text: 'Pedestrian down — the heat is on you' });
      } else {
        const car = found.ref.car;
        if (car.kind === 'police') {
          car.speed = Math.max(0, car.speed - 12);
          addHeat(world.wanted, 1);
        }
      }
    }
  }
  sparkBurst(scene, combat, hitPoint.x, hitPoint.y, hitPoint.z);
  world.onGunshot(player.x, player.z);
  return true;
}

/** A swing of Kai's fists at the nearest pedestrian in front of him. */
export function punch(world, player) {
  if (player.punchCooldown > 0 || !player.onFoot) return false;
  player.punchCooldown = 0.45;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  for (const ped of world.peds) {
    if (!ped.alive) continue;
    const dx = ped.x - player.x;
    const dz = ped.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < PLAYER.PUNCH_RANGE && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.4) {
      ped.alive = false;
      addHeat(world.wanted, 1);
      world.events.push({ type: 'toast', text: 'You knocked someone out — the heat is on you' });
      return true;
    }
  }
  return false;
}

/** Fade and move the spark bursts each frame. */
export function stepCombat(combat, dt) {
  combat.flash = Math.max(0, combat.flash - dt);
  for (let i = combat.sparks.length - 1; i >= 0; i--) {
    const s = combat.sparks[i];
    s.life -= dt;
    if (s.life <= 0) {
      s.mesh.parent?.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      combat.sparks.splice(i, 1);
      continue;
    }
    const pos = s.mesh.geometry.attributes.position;
    for (let j = 0; j < 24; j++) {
      pos.array[j * 3] += s.vel[j][0] * dt;
      pos.array[j * 3 + 1] += s.vel[j][1] * dt;
      pos.array[j * 3 + 2] += s.vel[j][2] * dt;
      s.vel[j][1] -= 12 * dt;
    }
    pos.needsUpdate = true;
    s.mesh.material.opacity = s.life / 0.25;
    s.mesh.material.transparent = true;
  }
}
