// Cars: how they look, how traffic drives the grid, and how the police hunt.
// One clear job: every vehicle in Solara Bay, player-driven or not, is built and
// moved here.
import * as THREE from 'three';
import { CITY, CAR } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { nearestRoadPoint, resolveCollisions } from './city.js';

const TRAFFIC_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e8e8e8', '#2c3e50', '#e67e22', '#16a085'];

function wheel(x, z) {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12),
    new THREE.MeshLambertMaterial({ color: '#181818' }),
  );
  w.rotation.z = Math.PI / 2;
  w.position.set(x, 0.36, z);
  return w;
}

/** A car made of boxes: body, cabin, wheels, headlights, and a light bar for police. */
export function buildCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.WIDTH, 0.75, CAR.LENGTH), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.WIDTH - 0.35, 0.62, CAR.LENGTH * 0.5),
    new THREE.MeshLambertMaterial({ color: '#1c2733' }),
  );
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.WIDTH - 0.3, 0.4, 0.5),
    new THREE.MeshLambertMaterial({ color: '#222222' }),
  );
  nose.position.set(0, 0.55, CAR.LENGTH / 2 + 0.1);
  g.add(nose);
  for (const [x, z] of [[-0.8, 1.5], [0.8, 1.5], [-0.8, -1.5], [0.8, -1.5]]) g.add(wheel(x, z));
  const headMat = new THREE.MeshBasicMaterial({ color: '#ffeebb' });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), headMat);
    h.position.set(x, 0.66, CAR.LENGTH / 2 + 0.36);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff3333' });
  for (const x of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), tailMat);
    t.position.set(x, 0.66, -CAR.LENGTH / 2 - 0.36);
    g.add(t);
  }
  let barRed = null;
  let barBlue = null;
  if (kind === 'police') {
    barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: '#ff2222' }),
    );
    barRed.position.set(-0.45, 1.68, -0.25);
    barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: '#2266ff' }),
    );
    barBlue.position.set(0.45, 1.68, -0.25);
    g.add(barRed, barBlue);
  }
  return { group: g, barRed, barBlue };
}

export function makeCar(kind, x, z, heading, color) {
  const { group, barRed, barBlue } = buildCarMesh(color, kind);
  return {
    kind, group, barRed, barBlue,
    x, z, heading, speed: 0, color,
    // traffic state
    axis: 'z', dir: 1, street: x,
    targetSpeed: CAR.TRAFFIC_SPEED,
    brake: 0,
    // police state
    flash: 0,
    ramCooldown: 0,
  };
}

/** Drive a car forward by its speed and heading, sliding off buildings. */
export function moveCar(car, dt, colliders) {
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  const [nx, nz] = resolveCollisions(car.x + dx, car.z + dz, 1.6, colliders);
  // Stay on land: the city ends at the beach, and the sea is not drivable.
  car.x = Math.max(-225, Math.min(225, nx));
  car.z = Math.max(-225, Math.min(225, nz));
}

function angleTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function turnToward(car, targetHeading, rate, dt) {
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  car.heading += step;
  return Math.abs(diff) < 0.15;
}

/** Is the light at (x, z) red for travel along `axis` right now? */
export function lightIsRed(lights, x, z, axis, time) {
  for (const l of lights) {
    if (Math.abs(l.x - x) < 9 && Math.abs(l.z - z) < 9) {
      const cycle = (time + l.phase) % 24;
      const nsGreen = cycle < 12;
      return axis === 'x' ? nsGreen : !nsGreen;
    }
  }
  return false;
}

/** One traffic car, following the road grid, stopping for red lights and the car ahead. */
export function stepTraffic(car, dt, time, lights, cars, colliders, rng) {
  const ahead = car.axis === 'z' ? car.z + car.dir * 9 : car.x + car.dir * 9;
  const crossStreet = CITY.STREETS.find((s) => Math.abs(ahead - s) < 9);
  let want = car.targetSpeed;
  if (crossStreet !== undefined) {
    const near = car.axis === 'z' ? Math.abs(car.z - crossStreet) : Math.abs(car.x - crossStreet);
    if (near < 10 && lightIsRed(lights, car.x, car.z, car.axis, time)) want = 0;
  }
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 9 && dist > 0.1) {
      const facing = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
      if (facing > 0 && Math.abs(Math.atan2(dx, dz) - car.heading) < 0.6) want = Math.min(want, 0);
    }
  }
  car.speed += Math.max(-CAR.BRAKE * dt, Math.min(CAR.ACCEL * 0.5 * dt, want - car.speed));
  if (car.speed < 0.05) car.speed = 0;
  // At an intersection, sometimes turn onto the crossing street.
  const atCross = CITY.STREETS.find((s) => Math.abs((car.axis === 'z' ? car.z : car.x) - s) < 1.2);
  if (atCross !== undefined && rng() < 0.02) {
    const turn = rng() < 0.5 ? -1 : 1;
    car.axis = car.axis === 'z' ? 'x' : 'z';
    car.dir = turn;
    if (car.axis === 'z') {
      car.street = Math.round(car.x);
      car.x = car.street;
    } else {
      car.street = Math.round(car.z);
      car.z = car.street;
    }
  }
  car.heading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  moveCar(car, dt, colliders);
}

/** One police car, hunting the player: steer onto the road toward them, then ram. */
export function stepPolice(car, dt, target, colliders) {
  // Off the road, get back on it first: cutting across blocks looks wrong
  // and strands the car on sidewalks.
  const rp = nearestRoadPoint(car.x, car.z);
  const chase = rp.d > 8 ? { x: rp.x, z: rp.z } : target;
  const desired = angleTo(car.x, car.z, chase.x, chase.z);
  const aligned = turnToward(car, desired, 2.4, dt);
  const dist = Math.hypot(target.x - car.x, target.z - car.z);
  // Close in fast from afar, but pace the player on their tail instead of
  // piling onto them: a chase reads better than a wreck. After a ram, ease
  // off for a moment.
  let want = dist > 7 ? CAR.POLICE_SPEED : Math.max(4, (target.speed || 0) - 1);
  if (car.ramCooldown > 0) want = Math.min(want, 8);
  car.speed += Math.max(-CAR.BRAKE * dt, Math.min(CAR.ACCEL * dt, want - car.speed));
  if (!aligned && car.speed > 12) car.speed -= 8 * dt;
  moveCar(car, dt, colliders);
  car.flash += dt;
  const on = Math.floor(car.flash * 6) % 2 === 0;
  if (car.barRed) car.barRed.material.color.set(on ? '#ff2222' : '#551111');
  if (car.barBlue) car.barBlue.material.color.set(on ? '#1133ff' : '#1122aa');
  car.ramCooldown = Math.max(0, car.ramCooldown - dt);
}

/** Spawn a set of traffic cars spread across the grid. */
export function spawnTraffic(scene, seed, count) {
  const rng = mulberry32(seed);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const axis = rng() < 0.5 ? 'z' : 'x';
    const street = pick(rng, CITY.STREETS);
    const along = range(rng, -190, 190);
    const dir = rng() < 0.5 ? -1 : 1;
    const x = axis === 'z' ? street + (dir > 0 ? -3.2 : 3.2) : along;
    const z = axis === 'z' ? along : street + (dir > 0 ? -3.2 : 3.2);
    const car = makeCar('traffic', x, z, 0, pick(rng, TRAFFIC_COLORS));
    car.axis = axis;
    car.dir = dir;
    car.street = street;
    car.targetSpeed = range(rng, 7, 11);
    car.speed = car.targetSpeed;
    car.heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}

/** Parked cars the player can steal, placed along the marina, the plaza and the docks. */
export function spawnParked(scene, seed) {
  const rng = mulberry32(seed);
  const spots = [
    { x: -170, z: 182, heading: Math.PI / 2, color: '#e8b13a', name: 'Comet GT' },
    { x: -158, z: 182, heading: Math.PI / 2, color: '#c0392b', name: 'Vesper' },
    { x: 170, z: -170, heading: 0, color: '#2980b9', name: 'Stallion' },
    { x: -30, z: 24, heading: Math.PI, color: '#27ae60', name: 'Bison' },
    { x: 84, z: -30, heading: Math.PI / 2, color: '#e8e8e8', name: 'Courier' },
    { x: 30, z: 84, heading: 0, color: '#8e44ad', name: 'Duchess' },
  ];
  const cars = [];
  for (const s of spots) {
    const car = makeCar('parked', s.x, s.z, s.heading, s.color);
    car.name = s.name;
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}

/** Sync every car mesh to its simulated position and heading. */
export function syncCars(cars) {
  for (const car of cars) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const lean = Math.max(-0.06, Math.min(0.06, (car.steer || 0) * -0.03));
    car.group.rotation.z = lean;
  }
}
