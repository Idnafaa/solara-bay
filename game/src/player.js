// Kai Mercer: on foot and behind the wheel, plus the camera that follows him.
// One clear job: turn keyboard and mouse into a person and a car that feel right.
import * as THREE from 'three';
import { PLAYER, CAR, WORLD } from './config.js';
import { moveCar } from './vehicles.js';
import { resolveCollisions } from './city.js';

export function makePlayer() {
  return {
    x: -150, z: 178, y: 0, vy: 0,
    heading: Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null,
    health: PLAYER.HEALTH_MAX,
    cash: 150,
    armed: false,
    pistol: false,
    grounded: true,
    punchCooldown: 0,
    shootCooldown: 0,
  };
}

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.85, 0.36),
    new THREE.MeshLambertMaterial({ color: '#2e86c1' }),
  );
  jacket.position.y = 1.05;
  jacket.castShadow = true;
  g.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 12),
    new THREE.MeshLambertMaterial({ color: '#e8b98a' }),
  );
  head.position.y = 1.7;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: '#1a1a1a' }),
  );
  hair.position.y = 1.74;
  g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
  for (const x of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
    leg.position.set(x, 0.31, 0);
    g.add(leg);
  }
  const armMat = new THREE.MeshLambertMaterial({ color: '#2e86c1' });
  for (const x of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), armMat);
    arm.position.set(x, 1.05, 0);
    g.add(arm);
  }
  return g;
}

/** Kai on foot: WASD against the camera, Shift to run, Space to jump. */
export function stepOnFoot(player, input, dt, colliders) {
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = run ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
  let fx = 0;
  let fz = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) fz += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) fz -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) fx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) fx += 1;
  const len = Math.hypot(fx, fz);
  if (len > 0) {
    fx /= len;
    fz /= len;
    const yaw = input.camYaw;
    // Forward is (sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw):
    // pressing D must move the player toward the right of the screen.
    const wx = Math.sin(yaw) * fz - Math.cos(yaw) * fx;
    const wz = Math.cos(yaw) * fz + Math.sin(yaw) * fx;
    const [nx, nz] = resolveCollisions(player.x + wx * speed * dt, player.z + wz * speed * dt, PLAYER.RADIUS, colliders);
    player.x = Math.max(-225, Math.min(225, nx));
    player.z = Math.max(-225, Math.min(238, nz));
    player.heading = Math.atan2(wx, wz);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  if (input.keys.has('Space') && player.grounded) {
    player.vy = PLAYER.JUMP_SPEED;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= WORLD.GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
}

/** Kai driving: W accelerates, S brakes and reverses, A/D steer with the speed. */
export function stepDriving(player, input, dt, colliders) {
  const car = player.car;
  if (!car) return;
  const fwd = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  if (fwd) car.speed += CAR.ACCEL * dt;
  else if (back) {
    car.speed -= car.speed > 0.5 ? CAR.BRAKE * dt : CAR.REVERSE_ACCEL * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  car.speed = Math.max(-CAR.MAX_REVERSE, Math.min(CAR.MAX_SPEED, car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  car.steer = steer;
  if (Math.abs(car.speed) > 0.2) {
    const grip = Math.min(1, Math.abs(car.speed) / 12);
    // D (steer +1) turns the car toward screen-right, which is a decreasing
    // heading in this convention (forward is (sin h, cos h)).
    car.heading -= steer * CAR.TURN_RATE * grip * dt * Math.sign(car.speed);
  }
  moveCar(car, dt, colliders);
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.speed = car.speed;
}

/** The nearest car Kai can steal, within reach and roughly in front of him. */
export function nearestStealableCar(player, cars) {
  let best = null;
  let bestD = 5;
  for (const car of cars) {
    if (car.kind === 'police') continue;
    if (car === player.car) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.car = car;
  player.onFoot = false;
  car.kind = 'player';
  car.speed = 0;
}

export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  car.kind = 'parked';
  player.car = null;
  player.onFoot = true;
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.2;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.2;
  player.y = 0;
}

/**
 * Third-person camera: orbits Kai with the mouse, trails behind the car when
 * driving, and never clips through a building (it pulls in when blocked).
 */
export function updateCamera(camera, player, input, dt, colliders) {
  const target = new THREE.Vector3(player.x, player.y + 1.6, player.z);
  let yaw = input.camYaw;
  let pitch = input.camPitch;
  if (!player.onFoot && player.car) {
    // Driving: ease the yaw around to sit behind the car.
    let diff = player.heading - yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw += diff * Math.min(1, dt * 2.2);
    pitch += (0.32 - pitch) * Math.min(1, dt * 2);
    input.camYaw = yaw;
    input.camPitch = pitch;
  }
  const dist = input.camDist || (player.onFoot ? 7.5 : 11);
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = target.y + Math.sin(pitch) * dist + 1.2;
  // Pull the camera in if a building stands between it and Kai.
  let finalDist = dist;
  for (const c of colliders) {
    if (cx > c.minX - 1 && cx < c.maxX + 1 && cz > c.minZ - 1 && cz < c.maxZ + 1) {
      finalDist = dist * 0.55;
      break;
    }
  }
  camera.position.set(
    target.x - Math.sin(yaw) * Math.cos(pitch) * finalDist,
    target.y + Math.sin(pitch) * finalDist + 1.2,
    target.z - Math.cos(yaw) * Math.cos(pitch) * finalDist,
  );
  camera.lookAt(target.x, target.y + 0.4, target.z);
}
