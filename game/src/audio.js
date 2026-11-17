// Sound, all of it synthesized in the browser: engine, sirens, gunshots, pickups
// and a low-key bass line for the drive. No audio file is ever loaded.
export function makeAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    musicTimer: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.5;
  audio.master.connect(audio.ctx.destination);
  // Engine: a sawtooth whose pitch follows the speed, always running.
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 50;
  audio.engineGain = audio.ctx.createGain();
  audio.engineGain.gain.value = 0;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  audio.engineOsc.connect(filter);
  filter.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();
  audio.started = true;
  startMusic(audio);
}

export function setEngine(audio, speed, inCar) {
  if (!audio.ctx || !audio.engineOsc) return;
  const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) / 34 * 0.1) : 0;
  audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(45 + Math.abs(speed) * 3.2, audio.ctx.currentTime, 0.08);
}

function blip(audio, freq, dur, type, gain) {
  if (!audio.ctx || audio.muted) return;
  const osc = audio.ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(gain || 0.2, audio.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
  osc.connect(g);
  g.connect(audio.master);
  osc.start();
  osc.stop(audio.ctx.currentTime + dur);
}

export function sfxPickup(audio) {
  blip(audio, 660, 0.12, 'sine', 0.25);
  setTimeout(() => blip(audio, 990, 0.18, 'sine', 0.25), 90);
}

export function sfxMission(audio) {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(audio, f, 0.22, 'triangle', 0.25), i * 110));
}

export function sfxShot(audio) {
  if (!audio.ctx || audio.muted) return;
  const dur = 0.14;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const g = audio.ctx.createGain();
  g.gain.value = 0.5;
  src.connect(g);
  g.connect(audio.master);
  src.start();
}

export function sfxCrash(audio) {
  if (!audio.ctx || audio.muted) return;
  const dur = 0.25;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.7;
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const g = audio.ctx.createGain();
  g.gain.value = 0.5;
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.master);
  src.start();
}

export function sfxSiren(audio) {
  blip(audio, 720, 0.4, 'square', 0.06);
  setTimeout(() => blip(audio, 540, 0.4, 'square', 0.06), 420);
}

/** A slow bass line and hats, scheduled a bar at a time, sunset-drive mood. */
function startMusic(audio) {
  const bassNotes = [55, 55, 65.4, 49];
  let bar = 0;
  const beatMs = 480;
  function scheduleBar() {
    if (!audio.ctx || audio.muted) {
      audio.musicTimer = setTimeout(scheduleBar, beatMs * 4);
      return;
    }
    const root = bassNotes[bar % bassNotes.length];
    for (let b = 0; b < 4; b++) {
      setTimeout(() => blip(audio, root, 0.4, 'triangle', 0.12), b * beatMs);
      setTimeout(() => blip(audio, 6000, 0.03, 'square', 0.02), b * beatMs + beatMs / 2);
    }
    bar += 1;
    audio.musicTimer = setTimeout(scheduleBar, beatMs * 4);
  }
  scheduleBar();
}
