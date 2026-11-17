// The HUD: cash, health, wanted stars, the mission line, the speedometer, the
// toast messages — and the minimap that draws the city from above. One clear job:
// everything Kai sees that is not the 3D world.
import { CITY, PLACES } from './config.js';
import { currentTarget, objectiveText } from './missions.js';

export function buildHud() {
  return {
    cash: document.getElementById('hud-cash'),
    health: document.getElementById('hud-health-fill'),
    stars: document.getElementById('hud-stars'),
    mission: document.getElementById('hud-mission'),
    speed: document.getElementById('hud-speed'),
    hint: document.getElementById('hud-hint'),
    toast: document.getElementById('hud-toast'),
    crosshair: document.getElementById('hud-crosshair'),
    bust: document.getElementById('hud-bust-fill'),
    map: document.getElementById('minimap'),
    mapCtx: document.getElementById('minimap').getContext('2d'),
    toastTimer: 0,
  };
}

export function showToast(hud, text, seconds) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  hud.toastTimer = seconds || 4;
}

export function updateHud(hud, world, dt) {
  const player = world.player;
  const wanted = world.wanted;
  hud.cash.textContent = `$${Math.floor(player.cash)}`;
  hud.health.style.width = `${Math.max(0, player.health)}%`;
  hud.health.style.background = player.health > 50 ? '#37c978' : player.health > 25 ? '#f5a623' : '#e74c3c';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < wanted.level ? '★' : '☆';
  hud.stars.textContent = stars;
  hud.stars.style.color = wanted.level > 0 ? '#ffd94d' : 'rgba(255,255,255,0.35)';
  hud.mission.textContent = objectiveText(world.missions);
  const target = currentTarget(world.missions);
  if (target && world.missions.distance) {
    hud.mission.textContent += ` — ${Math.round(world.missions.distance)}m`;
  }
  const kmh = Math.round(Math.abs(player.speed || 0) * 3.6);
  hud.speed.textContent = player.onFoot ? '' : `${kmh} km/h`;
  hud.crosshair.style.display = player.armed && player.onFoot ? 'block' : 'none';
  hud.bust.parentElement.style.display = wanted.bust > 0.02 ? 'block' : 'none';
  hud.bust.style.width = `${Math.min(100, wanted.bust * 100)}%`;
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toast.style.opacity = '0';
  }
  drawMinimap(hud, world);
}

/** The minimap: streets, the sea, the player arrow, police and the waypoint. */
function drawMinimap(hud, world) {
  const ctx = hud.mapCtx;
  const S = 200;
  const scale = S / (CITY.EXTENT * 2 + 40);
  const toMap = (x, z) => [(x + CITY.EXTENT + 20) * scale, (z + CITY.EXTENT + 20) * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, S, S);
  // sea at the bottom (south)
  ctx.fillStyle = '#1d5a74';
  const [, seaY] = toMap(0, CITY.EXTENT + 8);
  ctx.fillRect(0, seaY, S, S - seaY);
  // streets
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 5;
  for (const s of CITY.STREETS) {
    const [x] = toMap(s, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
    const [, z] = toMap(0, s);
    ctx.beginPath();
    ctx.moveTo(0, z);
    ctx.lineTo(S, z);
    ctx.stroke();
  }
  // blocks
  ctx.fillStyle = '#232a33';
  for (const bx of CITY.BLOCK_CENTERS) {
    for (const bz of CITY.BLOCK_CENTERS) {
      if (bx === 0 && bz === 0) continue;
      const [x, z] = toMap(bx - 20, bz - 20);
      ctx.fillRect(x, z, 40 * scale, 40 * scale);
    }
  }
  // waypoint
  const target = currentTarget(world.missions);
  if (target) {
    const [x, y] = toMap(target.x, target.z);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // police blips
  ctx.fillStyle = '#4d8dff';
  for (const cop of world.police) {
    const [x, y] = toMap(cop.x, cop.z);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // player arrow, rotated to the heading
  const [px, py] = toMap(world.player.x, world.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(world.player.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The hint line under the crosshair: the one action Kai can take right now. */
export function updateHint(hud, world, stealable) {
  const player = world.player;
  if (!player.onFoot) {
    hud.hint.textContent = 'W/S drive · A/D steer · E get out · Space handbrake';
    return;
  }
  if (stealable) {
    hud.hint.textContent = `E — steal the ${stealable.name || 'car'}`;
  } else if (player.pistol) {
    hud.hint.textContent = 'Click — shoot · F — punch · 1 — holster · Shift — run';
  } else {
    hud.hint.textContent = 'WASD move · Shift run · Space jump · F punch';
  }
}
