# threejs-fps-02

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/bingx12/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/bingx12/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

IRONHOLD — Depot 12: a round-based tactical FPS in three.js. Two teams of five fight short rounds in a dusk industrial yard: Raiders plant the spike at Warehouse (A) or Rail Yard (B), Wardens hold the yard. Money earned each round buys rifles, armour and Spark grenades in the buy phase; gunfire rewards stopping to aim — recoil, spread bloom and headshots decide fights. Bots route through three lanes on a waypoint graph, hold angles, rotate on gunfire, plant and defuse. Built for the make.fun "Make the best three.js tactical FPS" bounty, $1,000 in USDC.

## Run it

```sh
node serve.ts
# open http://localhost:8080 — click to play, single-player against bots
```

No build step, no network request: `game/` is plain static files, three.js 0.187.0 vendored under `game/vendor/three/`. Screenshots are real renders of the game, taken headless with `?shot=buy|fight|plant|end`.

## How it plays

- **Rounds** — 15 s buy phase, 100 s round, first to 7. Win by elimination, spike detonation (35 s fuse), defuse, or the clock (Wardens win on time).
- **Economy** — start $800, +$300 per kill, +$3,250 for a round win, loss bonus from $1,900 rising $500 per consecutive loss.
- **Arsenal** — P9 Vulture (free), VK-9 Rattler SMG ($900), AR-77 Longshot rifle ($2,700), DMR-12 Warden marksman ($4,200), Kevlar ($650), Spark flash grenade ($300).
- **Gunplay** — hitscan with headshots (×4), falloff, recoil and spread that punish firing on the move; crouching and right-click aim steady the shot. Tracers, muzzle flash, hit markers and a damage-direction indicator.
- **Bots** — waypoint routing, lane holds, rotations on heard gunfire, spike carrier plants, Wardens defuse; reaction time and aim error keep fights fair.
- **Map** — Depot 12: three lanes, two sites, containers, crates and a warehouse platform, procedural canvas textures, low amber sun over cold slate.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with `vendor/makefun-threejs.ts`.
- `game/index.html` — the game shell and HUD.
- `game/src/` — one job per module: `world` (map, waypoints), `player` (movement), `weapons` (guns, tracers, grenades), `bots` (AI), `match` (rounds, economy, spike), `hud` (DOM, minimap), `audio` (synth SFX), `input`, `textures`, `palette`, `main` (loop and combat).
- `game/vendor/three/` — three.js 0.187.0, byte for byte from the kit.
- `screenshots/` — four real renders of the game.
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=k6eq9xtw&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
