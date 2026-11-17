// The world: everything simulated, stepped together sixty times a second.
// One clear job: hold the state and advance it — the traffic, the police, the
// pedestrians, the missions, the heat and the collisions between them all.
import * as THREE from 'three';
import { CITY, CAR } from './config.js';
import { mulberry32 } from './random.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParked, stepTraffic, stepPolice, syncCars } from './vehicles.js';
import { spawnPeds, stepPed, syncPeds } from './people.js';
import { makePlayer, buildPlayerMesh, stepOnFoot, stepDriving, nearestStealableCar, enterCar, exitCar } from './player.js';
import { makeWanted, syncPolice, stepWanted } from './wanted.js';
import { makeMissionState, stepMissions, currentTarget } from './missions.js';
import { makeCombat, stepCombat, shoot, punch } from './combat.js';
import { makeAudio, setEngine, sfxCrash, sfxSiren } from './audio.js';

export function createWorld(scene, seed) {
  const rng = mulberry32(seed);
  const { colliders, lights } = buildCity(scene, seed);
  const world = {
    scene,
    seed,
    rng,
    time: 0,
    colliders,
    lights,
    player: makePlayer(),
    playerMesh: buildPlayerMesh(),
    cars: [],
    police: [],
    peds: [],
    missions: makeMissionState(),
    wanted: makeWanted(),
    combat: makeCombat(),
    audio: makeAudio(),
    events: [],
    gunshotAt: null,
    sirenTimer: 0,
    beacon: null,
    beaconLight: null,
    frozen: true, // the story does not advance on the title screen
  };
  scene.add(world.playerMesh);
  world.cars = [...spawnTraffic(scene, seed + 11, 14), ...spawnParked(scene, seed + 23)];
  world.peds = spawnPeds(scene, seed + 37, 22);
  // The waypoint beacon: a column of gold light marking the objective.
  const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: '#ffd94d', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  });
  world.beacon = new THREE.Mesh(beaconGeo, beaconMat);
  scene.add(world.beacon);
  world.onGunshot = (x, z) => {
    world.gunshotAt = { x, z, until: world.time + 1.5 };
  };
  return world;
}

/** The traffic-light cycle: north-south green for 12s, then east-west. */
function stepLights(world, dt) {
  for (const l of world.lights) {
    const cycle = (world.time + l.phase) % 24;
    l.lamp.material.color.set(cycle < 12 ? '#33dd55' : '#ff4444');
  }
}

function collideCars(world) {
  const all = [...world.cars, ...world.police];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 6) {
          sfxCrash(world.audio);
          if (a.kind === 'player' || b.kind === 'player') {
            world.player.health = Math.max(0, world.player.health - 4);
          }
          // A bump scrubs speed, it does not stop both cars dead.
          a.speed *= 0.7;
          b.speed *= 0.7;
          // A cop that just rammed backs off for a moment instead of
          // grinding on the player's bumper.
          if (a.kind === 'police') a.ramCooldown = 2;
          if (b.kind === 'police') b.ramCooldown = 2;
        }
      }
    }
  }
  // The player's car running a pedestrian over.
  const player = world.player;
  if (!player.onFoot && player.car) {
    for (const ped of world.peds) {
      if (!ped.alive) continue;
      const d = Math.hypot(ped.x - player.car.x, ped.z - player.car.z);
      if (d < 2.4 && Math.abs(player.car.speed) > 4) {
        ped.alive = false;
        world.events.push({ type: 'heat', amount: 1 });
        world.events.push({ type: 'toast', text: 'You hit a pedestrian — the heat is on you' });
        sfxCrash(world.audio);
      }
    }
  }
  // Traffic running Kai over on foot.
  if (player.onFoot) {
    for (const car of all) {
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < 2.2 && Math.abs(car.speed) > 3) {
        player.health = Math.max(0, player.health - 18);
        player.x += (player.x - car.x) * 0.6;
        player.z += (player.z - car.z) * 0.6;
        sfxCrash(world.audio);
        break;
      }
    }
  }
}

export function stepWorld(world, input, dt) {
  world.time += dt;
  stepLights(world, dt);
  const player = world.player;

  if (player.onFoot) stepOnFoot(player, input, dt, world.colliders);
  else stepDriving(player, input, dt, world.colliders);

  for (const car of world.cars) {
    if (car.kind === 'traffic') {
      stepTraffic(car, dt, world.time, world.lights, [...world.cars, ...world.police], world.colliders, world.rng);
    }
  }
  for (const cop of world.police) {
    stepPolice(cop, dt, player, world.colliders);
  }
  syncPolice(world.wanted, world.police, world.scene, player);

  const threat = world.gunshotAt && world.time < world.gunshotAt.until ? world.gunshotAt : null;
  for (const ped of world.peds) stepPed(ped, dt, world.colliders, threat);

  const missionEvent = world.frozen ? null : stepMissions(world.missions, player, world.wanted);
  if (missionEvent) world.events.push(missionEvent);

  stepWanted(world.wanted, dt, player, world.police);
  if (world.wanted.busted) world.events.push({ type: 'busted' });
  if (world.wanted.wasted) world.events.push({ type: 'wasted' });

  collideCars(world);
  stepCombat(world.combat, dt);

  // Police sirens, now and then, while the heat is on.
  if (world.wanted.level > 0) {
    world.sirenTimer -= dt;
    if (world.sirenTimer <= 0) {
      sfxSiren(world.audio);
      world.sirenTimer = 2.4;
    }
  }
  setEngine(world.audio, player.onFoot ? 0 : player.speed, !player.onFoot);

  // Waypoint beacon follows the current objective.
  const target = currentTarget(world.missions);
  if (target) {
    world.beacon.visible = true;
    world.beacon.position.set(target.x, 30, target.z);
    world.beacon.material.opacity = 0.18 + Math.sin(world.time * 3) * 0.07;
  } else {
    world.beacon.visible = false;
  }

  // Sync the meshes to the simulation.
  world.playerMesh.position.set(player.x, player.y, player.z);
  world.playerMesh.rotation.y = player.heading;
  world.playerMesh.visible = player.onFoot;
  const walkSwing = Math.sin(world.time * 9) * (player.speed > 0.5 ? 0.5 : 0);
  world.playerMesh.rotation.x = player.onFoot ? walkSwing * 0.06 : 0;
  syncCars([...world.cars, ...world.police]);
  syncPeds(world.peds);
}

export { nearestStealableCar, enterCar, exitCar, shoot, punch };
