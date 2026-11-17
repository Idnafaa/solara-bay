// Saving: Kai's cash, story progress and position, kept in localStorage so a
// run survives closing the tab. One clear job: save and load, nothing else.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      cash: Math.floor(world.player.cash),
      health: world.player.health,
      missionIndex: world.missions.index,
      missionStep: world.missions.step,
      storyDone: world.missions.done,
      pistol: world.player.pistol,
      x: world.player.x,
      z: world.player.z,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(world, data) {
  world.player.cash = data.cash;
  world.player.health = data.health || 100;
  world.player.pistol = !!data.pistol;
  world.player.armed = !!data.pistol;
  world.missions.index = data.missionIndex || 0;
  world.missions.step = data.missionStep || 0;
  world.missions.done = !!data.storyDone;
  world.player.x = data.x;
  world.player.z = data.z;
  world.player.y = 0;
}
