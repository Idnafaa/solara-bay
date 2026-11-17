// Deterministic randomness: mulberry32. Every staged screenshot and every traffic
// pattern in the game draws from a seeded generator, so the same seed replays the
// same city, the same traffic and the same frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function choice(rng, ...items) {
  return items[Math.floor(rng() * items.length)];
}
