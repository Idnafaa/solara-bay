// Solara Bay — boot, input, the game loop and the screens. One clear job: run
// the game, from the title screen to the last mission and back to free roam.
import * as THREE from 'three';
import { createRenderer, createScene } from './render.js';
import { createWorld, stepWorld, nearestStealableCar, enterCar, exitCar, shoot, punch } from './world.js';
import { updateCamera } from './player.js';
import { addHeat, resolveBusted, resolveWasted } from './wanted.js';
import { buildHud, updateHud, updateHint, showToast } from './hud.js';
import { ensureAudio, sfxPickup, sfxMission, sfxShot } from './audio.js';
import { saveGame, loadGame, applySave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const { scene } = createScene();
const world = createWorld(scene, SEED);
const hud = buildHud();
// A handle for play-testing and debugging (read-only from the console).
window.__solara = world;

const input = {
  keys: new Set(),
  camYaw: Math.PI * 0.75,
  camPitch: 0.28,
};

let screen = 'title'; // title | play | pause | complete | busted | wasted
let shotScreen = null;

const $ = (id) => document.getElementById(id);

function showOnly(id) {
  for (const el of ['screen-title', 'screen-pause', 'screen-complete', 'screen-busted', 'screen-wasted']) {
    $(el).style.display = el === id ? 'flex' : 'none';
  }
}

function startGame(fromSave) {
  ensureAudio(world.audio);
  world.frozen = false;
  if (fromSave) {
    const data = loadGame();
    if (data) {
      applySave(world, data);
      showToast(hud, 'Save loaded — welcome back to Solara Bay', 4);
    }
  }
  screen = 'play';
  showOnly(null);
  $('hud').style.display = 'block';
  canvas.requestPointerLock?.();
}

function openPause() {
  if (screen !== 'play') return;
  screen = 'pause';
  showOnly('screen-pause');
  document.exitPointerLock?.();
}

function closePause() {
  screen = 'play';
  showOnly(null);
  canvas.requestPointerLock?.();
}

function endRun(kind, amount) {
  screen = kind;
  showOnly(kind === 'busted' ? 'screen-busted' : 'screen-wasted');
  $(kind === 'busted' ? 'busted-fine' : 'wasted-bill').textContent = `$${amount}`;
  document.exitPointerLock?.();
}

function drainEvents() {
  while (world.events.length > 0) {
    const ev = world.events.shift();
    if (ev.type === 'step-done') {
      sfxPickup(world.audio);
      if (ev.mission.id === 'wheels') {
        world.player.pistol = true;
        world.player.armed = true;
        showToast(hud, 'A pistol in the crate. Press 1 to holster, click to shoot.', 5);
      }
    } else if (ev.type === 'mission-done') {
      world.player.cash += ev.reward;
      sfxMission(world.audio);
      showToast(hud, `${ev.mission.title} complete — +$${ev.reward}`, 5);
      if (ev.next && ev.next.id === 'package') {
        addHeat(world.wanted, 2);
        showToast(hud, 'The cops are onto the delivery — lose them or outrun them', 5);
      }
      saveGame(world);
    } else if (ev.type === 'story-done') {
      world.player.cash += ev.reward;
      sfxMission(world.audio);
      saveGame(world);
      screen = 'complete';
      $('complete-cash').textContent = `$${Math.floor(world.player.cash)}`;
      showOnly('screen-complete');
      document.exitPointerLock?.();
    } else if (ev.type === 'heat') {
      addHeat(world.wanted, ev.amount);
    } else if (ev.type === 'toast') {
      showToast(hud, ev.text, 4);
    } else if (ev.type === 'busted') {
      endRun('busted', resolveBusted(world.player, world.wanted));
    } else if (ev.type === 'wasted') {
      endRun('wasted', resolveWasted(world.player, world.wanted));
    }
  }
}

// --- Input ---
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  input.keys.add(e.code);
  if (screen === 'play') {
    if (e.code === 'KeyE') {
      if (world.player.onFoot) {
        const car = nearestStealableCar(world.player, world.cars);
        if (car) {
          enterCar(world.player, car);
          if (car.kind === 'player' && car.name !== 'Comet GT') addHeat(world.wanted, 1);
          ensureAudio(world.audio);
        }
      } else {
        exitCar(world.player);
      }
    }
    if (e.code === 'KeyF') punch(world, world.player);
    if (e.code === 'Digit1' && world.player.pistol) world.player.armed = !world.player.armed;
    if (e.code === 'KeyM') world.audio.muted = !world.audio.muted;
    if (e.code === 'KeyP') {
      if (saveGame(world)) showToast(hud, 'Game saved', 2);
    }
    if (e.code === 'Escape') openPause();
  } else if (screen === 'pause' && e.code === 'Escape') {
    closePause();
  }
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));

let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('mousedown', (e) => {
  if (screen !== 'play') return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  if (world.player.armed && world.player.onFoot) {
    if (shoot(world, scene, world.combat, camera)) sfxShot(world.audio);
  }
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    input.camYaw -= e.movementX * 0.0032;
    input.camPitch = Math.max(0.05, Math.min(1.1, input.camPitch + e.movementY * 0.0024));
    return;
  }
  if (!dragging) return;
  input.camYaw -= (e.clientX - lastX) * 0.005;
  input.camPitch = Math.max(0.05, Math.min(1.1, input.camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Buttons ---
$('btn-start').addEventListener('click', () => startGame(false));
const saved = loadGame();
if (saved) {
  $('btn-continue').style.display = 'inline-block';
  $('btn-continue').addEventListener('click', () => startGame(true));
}
$('btn-resume').addEventListener('click', closePause);
$('btn-save-quit').addEventListener('click', () => {
  saveGame(world);
  screen = 'title';
  showOnly('screen-title');
  $('hud').style.display = 'none';
  $('btn-continue').style.display = 'inline-block';
});
$('btn-free-roam').addEventListener('click', () => {
  screen = 'play';
  showOnly(null);
  canvas.requestPointerLock?.();
});
$('btn-busted-ok').addEventListener('click', () => {
  screen = 'play';
  showOnly(null);
  canvas.requestPointerLock?.();
});
$('btn-wasted-ok').addEventListener('click', () => {
  screen = 'play';
  showOnly(null);
  canvas.requestPointerLock?.();
});

// --- Shot mode: stage one frame and stop, for the screenshots. ---
if (SHOT) {
  const staged = stageShot(SHOT, world);
  shotScreen = staged.screen;
  input.camYaw = staged.camYaw;
  input.camPitch = staged.camPitch;
  if (staged.camDist) input.camDist = staged.camDist;
  if (shotScreen === 'title') showOnly('screen-title');
  else if (shotScreen === 'complete') {
    showOnly('screen-complete');
    $('complete-cash').textContent = `$${Math.floor(world.player.cash)}`;
  } else {
    showOnly(null);
  }
  $('hud').style.display = 'block';
  updateCamera(camera, world.player, input, 0.016, world.colliders);
  updateHud(hud, world, 0.016);
  updateHint(hud, world, nearestStealableCar(world.player, world.cars));
  for (let i = 0; i < 3; i++) renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  // --- The live loop ---
  showOnly('screen-title');
  let last = performance.now();
  let titleOrbit = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (screen === 'title') {
      // The city lives behind the title: traffic rolls, the camera drifts.
      titleOrbit += dt * 0.03;
      input.camYaw = titleOrbit;
      input.camPitch = 0.32;
      world.player.x = -150;
      world.player.z = 178;
      stepWorld(world, { keys: new Set(), camYaw: input.camYaw, camPitch: input.camPitch }, dt);
      updateCamera(camera, world.player, input, dt, world.colliders);
    } else if (screen === 'play') {
      stepWorld(world, input, dt);
      drainEvents();
      updateCamera(camera, world.player, input, dt, world.colliders);
      updateHud(hud, world, dt);
      updateHint(hud, world, nearestStealableCar(world.player, world.cars));
    } else {
      updateCamera(camera, world.player, input, dt, world.colliders);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
