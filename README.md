# Solara Bay — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff6b35)](https://make.fun/bounty/gta6-01)
[![ref](https://img.shields.io/badge/ref-01tnmm85-blue)](https://make.fun)

A complete open-world crime game in the spirit of GTA 6, built from scratch for
[make.fun's GTA 6 bounty](https://make.fun/bounty/gta6-01). Everything is original:
the city of Solara Bay, its people, its cars, its story and its sounds.

## The game

Kai Mercer owes the wrong people money. Three jobs stand between him and a clean
slate: steal the Comet GT at the marina, move a package across town with the Solara
Bay PD on his tail, and lose the heat to reach the safehouse. Then free roam.

- **A city to explore on foot and by car** — 8×8 streets, towers, palms, the marina
  and the docks, traffic that stops at red lights, pedestrians on the sidewalks.
- **Cars to steal and drive** — walk up to any parked car, press E, and go. Arcade
  handling with a chase camera.
- **A wanted level and police** — crime raises the heat; police cars spawn, chase
  and ram; get boxed in at a crawl and you are busted.
- **Missions and a story** — three jobs with waypoints, a beacon, payouts and a
  story-complete screen; progress saves to localStorage.
- **Combat** — fists and a pistol, with sparks, panicking crowds and consequences.
- **A HUD with a minimap** — cash, health, wanted stars, the objective, a live
  top-down map with the waypoint and police blips, and a bust meter.
- **Polish** — golden-hour sun with long shadows, neon signs, a synth engine hum,
  sirens and a bass line, all generated in the browser. No audio or image file is
  loaded; every texture is painted on canvas at boot.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD move / drive · mouse look (click to lock) · Shift run · E steal / exit car ·
Space jump · F punch · 1 pistol, click to shoot · P save · M mute · Esc pause.

## How it is built

- `game/index.html` — the page, the HUD and the screens.
- `game/src/` — one file per job: `config` (numbers), `random` (seeded RNG),
  `textures` (canvas-painted art), `city` (the streets and towers), `vehicles`
  (cars, traffic and police AI), `people` (pedestrians), `player` (Kai and the
  camera), `wanted` (the heat), `missions` (the story), `combat` (fists and the
  pistol), `hud` (the HUD and minimap), `audio` (synth sound), `save`
  (localStorage), `world` (the simulation step), `render` (light and sky),
  `shots` (the staged screenshots), `main` (boot and the loop).
- `game/vendor/three.module.min.js` — three.js, vendored.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output`
  and writes the dossier with the kit's library.
- `screenshots/` — four real renders of the game's own code.

## License

MIT — see `LICENSE`.
