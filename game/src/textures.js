// Procedural textures, drawn on canvas at boot. The city never loads an image file:
// every facade, road and sign is painted here, so the game stays fully offline.
import * as THREE from 'three';
import { mulberry32 } from './random.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

/** A building facade: rows of windows, some lit gold, on a tinted plaster base. */
export function buildingTexture(variant, base) {
  const rng = mulberry32(1000 + variant * 77);
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // faint plaster noise
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rng() * 0.05})`;
    ctx.fillRect(rng() * 128, rng() * 256, 2 + rng() * 6, 2 + rng() * 6);
  }
  const cols = 4;
  const rows = 9;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.24;
      ctx.fillStyle = lit ? '#ffd98a' : '#1d2a3a';
      ctx.fillRect(c * w + 5, r * h + 7, w - 10, h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(c * w + 5, r * h + 7, w - 10, 3);
    }
  }
  // ground-floor shopfront
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 232, 128, 24);
  ctx.fillStyle = 'rgba(255,214,130,0.85)';
  ctx.fillRect(8, 238, 112, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt with a faint centre wear line, tiled across the road plane. */
export function asphaltTexture() {
  const rng = mulberry32(42);
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#33363b';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.09})`;
    ctx.fillRect(rng() * 256, rng() * 256, 3, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pale sidewalk slabs with expansion joints. */
export function sidewalkTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#9a938a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 32);
    ctx.lineTo(128, i * 32);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Warm beach sand for the marina edge. */
export function sandTexture() {
  const rng = mulberry32(7);
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#d9c08f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(120,90,40,${rng() * 0.12})`;
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A glowing shop sign with the given words, drawn as an emissive texture. */
export function signTexture(text, fg, bg) {
  const [canvas, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = fg;
  ctx.shadowBlur = 14;
  ctx.fillStyle = fg;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round sprite used for muzzle flashes, sparks and the waypoint beacon. */
export function glowTexture() {
  const [canvas, ctx] = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,220,140,0.85)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
