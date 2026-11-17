// Staged screenshots: the same scenes a player sees, reached by playing the real
// rules forward from a fresh world with a fixed seed and a simple autopilot —
// so every screenshot is a true render of the game, and the same seed always
// gives the same frame. ?shot=start|drive|chase|done
import { CITY, PLACES } from './config.js';
import { createWorld, stepWorld, enterCar } from './world.js';
import { makeCar } from './vehicles.js';
import { makeWanted, addHeat } from './wanted.js';

const STEP = 1 / 30;

/** A driver that holds its street, eases off for the car ahead, and never stops. */
function autopilot(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return { keys: new Set(), camYaw: 0, camPitch: 0.3 };
  const input = { keys: new Set(['KeyW']), camYaw: car.heading, camPitch: 0.3 };
  // Stay on the street: steer toward the nearest road line ahead.
  const aheadX = car.x + Math.sin(car.heading) * 12;
  const aheadZ = car.z + Math.cos(car.heading) * 12;
  let best = null;
  for (const s of CITY.STREETS) {
    const d = Math.min(Math.abs(aheadX - s), Math.abs(aheadZ - s));
    if (!best || d < best.d) best = { d, s, axis: Math.abs(aheadX - s) < Math.abs(aheadZ - s) ? 'x' : 'z' };
  }
  const lateral = best.axis === 'x' ? car.x - best.s : car.z - best.s;
  const wantHeading = best.axis === 'x'
    ? (Math.abs(car.heading) < Math.PI / 2 ? 0 : Math.PI)
    : (Math.abs(car.heading - Math.PI / 2) < Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff + Math.max(-0.4, Math.min(0.4, -lateral * 0.06));
  // A raises the heading, D lowers it (see player.js): steer toward the
  // heading correction the car needs.
  if (steer > 0.12) input.keys.add('KeyA');
  else if (steer < -0.12) input.keys.add('KeyD');
  // Brake for the car ahead.
  for (const other of [...world.cars, ...world.police]) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 11 && Math.sin(car.heading) * dx + Math.cos(car.heading) * dz > 0) {
      input.keys.delete('KeyW');
      input.keys.add('KeyS');
      break;
    }
  }
  return input;
}

function runFor(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const input = drive ? autopilot(world) : { keys: new Set(), camYaw: 0, camPitch: 0.3 };
    stepWorld(world, input, STEP);
  }
}

function putPlayerInCar(world, x, z, heading, carName) {
  const car = world.cars.find((c) => c.name === carName);
  car.x = x;
  car.z = z;
  car.heading = heading;
  enterCar(world.player, car);
}

/**
 * Set `world` to the named scene and return the screen the page should show
 * over it, and the camera yaw that frames it best.
 */
export function stageShot(name, world) {
  const player = world.player;
  if (name === 'drive') {
    putPlayerInCar(world, -120, 27, Math.PI / 2, 'Comet GT');
    world.missions.index = 0;
    world.missions.step = 1;
    player.pistol = true;
    player.armed = true;
    addHeat(world.wanted, 2);
    runFor(world, 14, true);
    player.health = 100;
    return { screen: 'play', camYaw: player.heading, camPitch: 0.3 };
  }
  if (name === 'chase') {
    // The chase, staged so the frame reads: Kai's car ahead at speed, the
    // police in formation behind him, the camera looking back down the
    // avenue at them. A short run lets the lights flash and the pack close.
    putPlayerInCar(world, 27, -60, 0, 'Stallion');
    world.player.car.speed = 22;
    world.missions.index = 1;
    world.missions.step = 1;
    player.pistol = true;
    player.armed = true;
    player.cash = 650;
    addHeat(world.wanted, 4);
    // The pursuit pack, spawned explicitly in formation behind Kai — the
    // world starts with no police, so these must be created, not placed.
    const formation = [[22, -82], [32, -86], [26, -94], [30, -102]];
    for (const [x, z] of formation) {
      const cop = makeCar('police', x, z, 0, '#111418');
      cop.speed = 26;
      world.scene.add(cop.group);
      world.police.push(cop);
    }
    // A short run: the world has really stepped, but the pack has not had
    // time to catch the player and pile onto him.
    runFor(world, 0.5, true);
    player.health = 100;
    return { screen: 'play', camYaw: player.heading + 2.5, camPitch: 0.3, camDist: 14 };
  }
  if (name === 'done') {
    // Kai on the street by the safehouse, the city behind him — not inside
    // the block, where a tower would fill the frame.
    player.x = -189;
    player.z = -162;
    player.heading = Math.PI / 2;
    player.cash = 1650;
    player.pistol = true;
    player.armed = true;
    world.missions.index = 3;
    world.missions.done = true;
    runFor(world, 2, false);
    return { screen: 'complete', camYaw: Math.PI / 2, camPitch: 0.25 };
  }
  // start: Kai on foot in the middle of an avenue, the towers and palms of
  // Solara Bay rising on both sides, the plaza ahead. Far from the Comet GT
  // so the first objective does not complete itself while the scene settles.
  player.x = -27;
  player.z = 150;
  player.heading = 0;
  runFor(world, 5, false);
  player.health = 100;
  return { screen: 'title', camYaw: 0, camPitch: 0.3 };
}
