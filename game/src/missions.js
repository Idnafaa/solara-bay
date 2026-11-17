// Missions and the story of Kai Mercer: three jobs across Solara Bay, each a chain
// of objectives with a waypoint, a payout and a beat of the plot. One clear job:
// what Kai has to do next, and what it pays.
import { MISSIONS, PLACES } from './config.js';

export function makeMissionState() {
  return {
    index: 0, // which job in MISSIONS
    step: 0, // which objective inside the job
    done: false, // the whole story is finished
    distance: 0,
    arrived: false,
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] ?? null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  return mission ? mission.steps[state.step] : null;
}

/** Where the current objective points: a map coordinate and a label. */
export function currentTarget(state) {
  const step = currentStep(state);
  if (!step) return null;
  switch (step.target) {
    case 'car': return { x: -170, z: 182, label: 'Comet GT' };
    case 'docks': return { x: PLACES.docks.x, z: PLACES.docks.z - 8, label: 'Docks' };
    case 'garage': return { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Skyline Garage' };
    case 'safehouse': return { x: PLACES.safehouse.x, z: PLACES.safehouse.z, label: 'Safehouse' };
    case 'lose-heat': return null;
    default: return null;
  }
}

/**
 * Advance the story when Kai reaches the objective (or loses the heat).
 * Returns an event describing what happened, or null.
 */
export function stepMissions(state, player, wanted) {
  const mission = currentMission(state);
  if (!mission || state.done) return null;
  const step = mission.steps[state.step];
  if (step.target === 'lose-heat') {
    if (wanted.level === 0) {
      return advance(state, mission);
    }
    return null;
  }
  const target = currentTarget(state);
  if (!target) return null;
  const d = Math.hypot(player.x - target.x, player.z - target.z);
  state.distance = d;
  if (d < 6 && !state.arrived) {
    state.arrived = true;
    return advance(state, mission);
  }
  if (d >= 8) state.arrived = false;
  return null;
}

function advance(state, mission) {
  state.step += 1;
  state.arrived = false;
  if (state.step >= mission.steps.length) {
    const reward = mission.reward;
    state.index += 1;
    state.step = 0;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      return { type: 'story-done', reward, mission };
    }
    return { type: 'mission-done', reward, mission, next: MISSIONS[state.index] };
  }
  return { type: 'step-done', mission };
}

/** The objective line the HUD shows right now. */
export function objectiveText(state) {
  if (state.done) return 'Story complete — Solara Bay is yours. Free roam.';
  const mission = currentMission(state);
  const step = currentStep(state);
  if (!mission || !step) return '';
  return `${mission.title}: ${step.text}`;
}
