// Pedestrians: the people of Solara Bay, strolling the sidewalks and running
// when the shooting starts. One clear job: walk, panic, and get out of the way.
import * as THREE from 'three';
import { CITY } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { resolveCollisions } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c'];
const PANTS = ['#2c3e50', '#34495e', '#7f8c8d', '#5d4037'];

function buildPedMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.32),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), legMat);
    leg.position.set(x, 0.31, 0);
    g.add(leg);
  }
  return g;
}

export function spawnPeds(scene, seed, count) {
  const rng = mulberry32(seed);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const street = pick(rng, CITY.STREETS);
    const along = range(rng, -190, 190);
    const side = rng() < 0.5 ? -1 : 1;
    const onXStreet = rng() < 0.5;
    const x = onXStreet ? street + side * 9.5 : along;
    const z = onXStreet ? along : street + side * 9.5;
    const mesh = buildPedMesh(
      pick(rng, SHIRTS),
      pick(rng, PANTS),
      pick(rng, ['#e8b98a', '#c98d64', '#8a5a3b', '#f0c8a0']),
    );
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 0.8, 1.6),
      walkPhase: rng() * 10,
      panic: 0,
      alive: true,
      // the sidewalk lane they follow: street + side offset, walking along it
      lane: { street, side, onXStreet, dir: rng() < 0.5 ? -1 : 1 },
    });
  }
  return peds;
}

/** One pedestrian: stroll their sidewalk, or run from a gunshot. */
export function stepPed(ped, dt, colliders, threat) {
  if (!ped.alive) return;
  if (threat) {
    const dx = ped.x - threat.x;
    const dz = ped.z - threat.z;
    const d = Math.hypot(dx, dz);
    if (d < 26) ped.panic = 3;
  }
  ped.panic = Math.max(0, ped.panic - dt);
  let speed = ped.speed;
  let heading = ped.heading;
  if (ped.panic > 0) {
    speed = 4.2;
    if (threat) heading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
  } else {
    const l = ped.lane;
    const along = l.onXStreet ? ped.z : ped.x;
    const next = along + l.dir * speed * dt;
    if (next > 195 || next < -195) l.dir *= -1;
    heading = l.onXStreet ? (l.dir > 0 ? 0 : Math.PI) : (l.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  ped.heading = heading;
  const nx = ped.x + Math.sin(heading) * speed * dt;
  const nz = ped.z + Math.cos(heading) * speed * dt;
  const [rx, rz] = resolveCollisions(nx, nz, 0.5, colliders);
  ped.x = rx;
  ped.z = rz;
  ped.walkPhase += dt * speed * 3;
}

export function syncPeds(peds) {
  for (const ped of peds) {
    ped.mesh.visible = ped.alive;
    if (!ped.alive) continue;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.35;
    ped.mesh.rotation.x = swing * 0.12;
  }
}
