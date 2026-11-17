// Solara Bay — shared constants for the city, the cars, the player and the rules.
// One clear job: every number the rest of the game agrees on lives here.
export const CITY = {
  // Streets run at these coordinates on both axes (metres from the city centre).
  STREETS: [-189, -135, -81, -27, 27, 81, 135, 189],
  STREET_HALF: 7, // half the width of the asphalt
  BLOCK: 40, // block side length
  PITCH: 54, // street-to-street spacing
  EXTENT: 216, // half the city size; the sea wall sits just past it
  BLOCK_CENTERS: [-162, -108, -54, 0, 54, 108, 162],
};

export const PLAYER = {
  WALK_SPEED: 6,
  RUN_SPEED: 10,
  JUMP_SPEED: 7,
  RADIUS: 0.55,
  HEIGHT: 1.8,
  HEALTH_MAX: 100,
  PUNCH_DAMAGE: 15,
  PUNCH_RANGE: 2.2,
  PISTOL_DAMAGE: 34,
  PISTOL_RANGE: 90,
};

export const CAR = {
  LENGTH: 4.4,
  WIDTH: 2.0,
  ACCEL: 14,
  BRAKE: 26,
  REVERSE_ACCEL: 8,
  MAX_SPEED: 34,
  MAX_REVERSE: 9,
  TURN_RATE: 1.9, // radians per second at full lock, scaled by speed
  TRAFFIC_SPEED: 9,
  POLICE_SPEED: 30,
};

export const WANTED = {
  MAX: 5,
  DECAY_SECONDS: 8, // one star fades per this many seconds unseen
  UNSEEN_SECONDS: 14, // police must lose sight this long before decay starts
  BUST_RADIUS: 3.2, // a cop this close while the player crawls fills the bust meter
  BUST_FILL_RATE: 0.5, // per second at a standstill next to a cop
};

export const WORLD = {
  GRAVITY: 22,
  SUN_ELEVATION: 0.62, // late-afternoon sun, warm and low
  SUN_AZIMUTH: 0.8,
  FOG_NEAR: 180,
  FOG_FAR: 520,
  DAY_LENGTH: 1, // fixed golden hour; the city stays sun-soaked
};

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Wheels Up',
    brief: 'Kai needs wheels. The Comet GT is parked by the marina — take it.',
    steps: [
      { text: 'Reach the Comet GT at the marina', target: 'car' },
      { text: 'Drive to the docks', target: 'docks' },
    ],
    reward: 200,
  },
  {
    id: 'package',
    title: 'The Package',
    brief: 'A crate at the docks has Kai’s name on it. Pick it up, deliver it to the Skyline garage — and expect company.',
    steps: [
      { text: 'Pick up the package at the docks', target: 'docks' },
      { text: 'Deliver the package to the Skyline garage', target: 'garage' },
    ],
    reward: 500,
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    brief: 'The Solara Bay PD is all over Kai. Lose the heat, then get to the safehouse.',
    steps: [
      { text: 'Lose the wanted level', target: 'lose-heat' },
      { text: 'Reach the safehouse', target: 'safehouse' },
    ],
    reward: 800,
  },
];

// Named places on the map (x, z in metres). The story walks the player across the city.
export const PLACES = {
  marina: { x: -162, z: 190, label: 'Marina' },
  docks: { x: 162, z: 190, label: 'Docks' },
  garage: { x: 162, z: -162, label: 'Skyline Garage' },
  safehouse: { x: -162, z: -162, label: 'Safehouse' },
  plaza: { x: 0, z: 0, label: 'Solara Plaza' },
  hospital: { x: -27, z: -162, label: 'Bay General' },
};

export const START_CASH = 150;
export const SAVE_KEY = 'solara-bay-save-v1';
