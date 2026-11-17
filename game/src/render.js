// The renderer: a golden-hour sky, a warm low sun with long shadows, and the
// fog that melts the city into the sea haze. One clear job: light the city.
import * as THREE from 'three';
import { WORLD, CITY } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  // Late-afternoon sky: warm peach overhead, melting into sea haze at the edges.
  scene.background = new THREE.Color('#ffc98f');
  scene.fog = new THREE.Fog('#f2b98a', WORLD.FOG_NEAR, WORLD.FOG_FAR);

  const sun = new THREE.DirectionalLight('#ffd9a8', 2.6);
  const el = WORLD.SUN_ELEVATION;
  const az = WORLD.SUN_AZIMUTH;
  sun.position.set(
    Math.cos(az) * Math.cos(el) * 300,
    Math.sin(el) * 300,
    Math.sin(az) * Math.cos(el) * 300,
  );
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -CITY.EXTENT - 40;
  sun.shadow.camera.right = CITY.EXTENT + 40;
  sun.shadow.camera.top = CITY.EXTENT + 40;
  sun.shadow.camera.bottom = -CITY.EXTENT - 40;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const sky = new THREE.HemisphereLight('#ffe3c0', '#5a4a3a', 0.85);
  scene.add(sky);

  return { scene, sun };
}
