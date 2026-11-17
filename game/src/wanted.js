// The wanted level: stars that rise with crime, police who answer them, and the
// bust meter that ends a run when the cops box Kai in. One clear job: the heat.
import { WANTED, CAR } from './config.js';
import { makeCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

export function makeWanted() {
  return {
    level: 0,
    unseenFor: 0,
    decayTimer: 0,
    bust: 0,
    busted: false,
    wasted: false,
  };
}

export function addHeat(wanted, amount) {
  wanted.level = Math.min(WANTED.MAX, wanted.level + amount);
  wanted.unseenFor = 0;
  wanted.decayTimer = 0;
}

/** How many police cars the current heat calls for. */
export function wantedPoliceCount(level) {
  return [0, 1, 2, 3, 4, 4][level];
}

/** Keep the police fleet matched to the wanted level, spawning at the road's edge. */
export function syncPolice(wanted, police, scene, player) {
  const want = wantedPoliceCount(wanted.level);
  while (police.length < want) {
    const spot = nearestRoadPoint(
      player.x + (Math.random() - 0.5) * 160,
      player.z + (Math.random() - 0.5) * 160,
    );
    const car = makeCar('police', spot.x, spot.z, 0, '#111418');
    car.speed = 10;
    scene.add(car.group);
    police.push(car);
  }
  while (police.length > want) {
    const car = police.pop();
    scene.remove(car.group);
  }
}

/** The heat step: decay when unseen, fill the bust meter when boxed in. */
export function stepWanted(wanted, dt, player, police) {
  let nearest = Infinity;
  for (const cop of police) {
    const d = Math.hypot(cop.x - player.x, cop.z - player.z);
    if (d < nearest) nearest = d;
  }
  const seen = nearest < 55;
  if (wanted.level > 0) {
    if (seen) {
      wanted.unseenFor = 0;
      wanted.decayTimer = 0;
    } else {
      wanted.unseenFor += dt;
      if (wanted.unseenFor > WANTED.UNSEEN_SECONDS) {
        wanted.decayTimer += dt;
        if (wanted.decayTimer >= WANTED.DECAY_SECONDS) {
          wanted.level -= 1;
          wanted.decayTimer = 0;
          wanted.unseenFor = 0;
        }
      }
    }
    // Boxed in at a crawl next to a cop: the bust meter fills.
    const crawling = Math.abs(player.speed) < 1.5;
    if (nearest < WANTED.BUST_RADIUS && crawling) {
      wanted.bust += WANTED.BUST_FILL_RATE * dt;
      if (wanted.bust >= 1) wanted.busted = true;
    } else {
      wanted.bust = Math.max(0, wanted.bust - dt * 0.4);
    }
  }
  if (player.health <= 0) wanted.wasted = true;
}

/** A busted Kai pays a fine and wakes at the precinct with a clean slate. */
export function resolveBusted(player, wanted) {
  const fine = Math.min(player.cash, 100);
  player.cash -= fine;
  player.health = 100;
  wanted.level = 0;
  wanted.bust = 0;
  wanted.busted = false;
  player.x = -27;
  player.z = -140;
  player.y = 0;
  if (player.car) {
    player.car.kind = 'parked';
    player.car = null;
    player.onFoot = true;
  }
  return fine;
}

/** A wasted Kai wakes at Bay General, lighter in the pocket. */
export function resolveWasted(player, wanted) {
  const bill = Math.min(player.cash, 150);
  player.cash -= bill;
  player.health = 100;
  wanted.level = 0;
  wanted.wasted = false;
  player.x = -27;
  player.z = -158;
  player.y = 0;
  if (player.car) {
    player.car.kind = 'parked';
    player.car = null;
    player.onFoot = true;
  }
  return bill;
}
