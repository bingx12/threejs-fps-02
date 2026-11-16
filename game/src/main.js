// IRONHOLD — Depot 12. Boot and the one loop: a fixed 60 Hz simulation
// feeding a render at the display's rate. Combat resolves here: one hitscan
// ray per bullet against the world, the bots and the player, with headshots,
// falloff, tracers and noise the bots hear.
// ?shot=buy|fight|plant|end with &seed=N stages a deterministic frame for a
// capture, renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import {
  WEAPONS, createWeaponState, weaponStep, weaponReady, weaponFire,
  weaponReload, weaponSpread, createViewModel, createTracers, createGrenades,
} from './weapons.js';
import { createBots } from './bots.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMatch } from './match.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const audio = createAudio();
const hud = createHud(world);
const playerCore = createPlayer(world.colliders);
const player = Object.assign(playerCore, {
  name: 'You', team: 'raiders',
  health: 100, armor: 0, alive: true,
  weapon: createWeaponState('p9'), money: 800, grenades: 0,
  kills: 0, deaths: 0,
});
const bots = createBots(scene, world);
const viewModel = createViewModel(camera);
const tracers = createTracers(scene);
const grenades = createGrenades(scene, world.colliders);
const input = createInput(renderer.domElement, onLockChange);

const match = createMatch({
  player, bots, hud, audio, world,
  onEquip: (id) => viewModel.equip(id),
  onPlayerDeath: () => {
    hud.showOverlay('dead');
    if (document.pointerLockElement) document.exitPointerLock();
  },
});

const raycaster = new THREE.Raycaster();
const dirV = new THREE.Vector3();
const eyeV = new THREE.Vector3();
const muzzleV = new THREE.Vector3();
const hitV = new THREE.Vector3();
let elapsed = 0;
let started = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let owned = ['p9'];
let spectate = null;
let fov = 74;

hud.setAmmo(player.weapon.mag, player.weapon.reserve, 'p9', 0);
hud.setMoney(player.money);
hud.setHealth(player.health, player.armor);
hud.setAlive(5, 5);
hud.onPlay(() => {
  audio.unlock();
  if (shot) return;
  if (match.state.phase === 'matchEnd' || !match.state.started) match.startMatch();
  input.requestLock();
});
hud.onBuy((id) => {
  if (match.buy(player, id)) {
    if (WEAPONS[id] && !owned.includes(id)) owned.push(id);
  } else audio.denied();
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    if (match.state.phase === 'buy') hud.showBuy(player.money, owned);
  } else if (player.alive && match.state.phase !== 'matchEnd') {
    hud.showOverlay(started ? 'paused' : 'start');
  }
}

function syncCamera() {
  if (spectate && !player.alive) {
    const b = spectate;
    camera.position.set(b.move.x, b.move.y + b.move.eye, b.move.z);
    camera.rotation.set(0, b.yaw, 0, 'YXZ');
    return;
  }
  camera.position.set(player.move.x, player.move.y + player.move.eye, player.move.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

function playerEye(out) {
  return player.eyePos(out);
}

// Ray vs the player's capsule: head sphere plus torso box, by hand, so no
// invisible mesh has to ride along with the camera.
function rayHitsPlayer(origin, dir, maxDist) {
  const eye = playerEye(eyeV);
  const headC = { x: eye.x, y: eye.y - 0.12, z: eye.z };
  const tHead = raySphere(origin, dir, headC, 0.19, maxDist);
  const torsoMin = { x: eye.x - 0.27, y: eye.y - 0.75, z: eye.z - 0.18 };
  const torsoMax = { x: eye.x + 0.27, y: eye.y - 0.1, z: eye.z + 0.18 };
  const tTorso = rayBox(origin, dir, torsoMin, torsoMax, maxDist);
  const legsMin = { x: eye.x - 0.27, y: eye.y - 1.55, z: eye.z - 0.18 };
  const legsMax = { x: eye.x + 0.27, y: eye.y - 0.75, z: eye.z + 0.18 };
  const tLegs = rayBox(origin, dir, legsMin, legsMax, maxDist);
  let best = null;
  if (tHead != null) best = { dist: tHead, part: 'head' };
  if (tTorso != null && (!best || tTorso < best.dist)) best = { dist: tTorso, part: 'torso' };
  if (tLegs != null && (!best || tLegs < best.dist)) best = { dist: tLegs, part: 'legs' };
  return best;
}

function raySphere(o, d, c, r, maxDist) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t <= maxDist ? t : null;
}

function rayBox(o, d, min, max, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const axes = [
    { d: d.x, o: o.x, lo: min.x, hi: max.x },
    { d: d.y, o: o.y, lo: min.y, hi: max.y },
    { d: d.z, o: o.z, lo: min.z, hi: max.z },
  ];
  for (const ax of axes) {
    if (Math.abs(ax.d) < 1e-9) {
      if (ax.o < ax.lo || ax.o > ax.hi) return null;
    } else {
      let ta = (ax.lo - ax.o) / ax.d;
      let tb = (ax.hi - ax.o) / ax.d;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      tmin = Math.max(tmin, ta);
      tmax = Math.min(tmax, tb);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

// One bullet: origin, direction, spread cone, the shooter and its weapon.
// Returns the hit, if any, after tracers, sound, damage and the kill feed.
function resolveShot(shooter, origin, direction, spread, weaponId) {
  const def = WEAPONS[weaponId];
  window.__ironhold.debug.shots += 1;
  const dx = direction.x + (rng() * 2 - 1) * spread;
  const dy = direction.y + (rng() * 2 - 1) * spread;
  const dz = direction.z + (rng() * 2 - 1) * spread;
  dirV.set(dx, dy, dz).normalize();
  raycaster.set(origin, dirV);
  raycaster.far = def.range;
  const targets = world.shootables.concat(bots.hitMeshes());
  const hit = raycaster.intersectObjects(targets, false)[0];
  let end = hitV.set(origin.x + dirV.x * def.range, origin.y + dirV.y * def.range, origin.z + dirV.z * def.range);
  let victim = null;
  let part = null;
  let dist = def.range;
  if (hit) {
    end = hit.point;
    dist = hit.distance;
    if (hit.object.userData.bot) {
      victim = hit.object.userData.bot;
      part = hit.object.userData.part ?? 'torso';
      if (victim === shooter) window.__ironhold.debug.selfHits += 1;
      else window.__ironhold.debug.botHits += 1;
    }
  }
  // Bots can hit the player; the player never shoots themself.
  if (shooter !== player && player.alive) {
    const pHit = rayHitsPlayer(origin, dirV, dist);
    if (pHit) {
      window.__ironhold.debug.playerHits += 1;
      victim = player;
      part = pHit.part;
      dist = pHit.dist;
      end = hitV.set(origin.x + dirV.x * dist, origin.y + dirV.y * dist, origin.z + dirV.z * dist);
    }
  }
  if (shooter === player) tracers.spawn(viewModel.muzzleWorld(muzzleV), end);
  else tracers.spawn(origin, end);
  const shotDist = shooter === player ? 0 : Math.hypot(origin.x - player.move.x, origin.z - player.move.z);
  audio.shot(weaponId, shotDist);
  for (const b of bots.bots) {
    if (b === shooter || !b.alive) continue;
    if (Math.hypot(b.move.x - origin.x, b.move.z - origin.z) < 34) b.hear = { x: origin.x, z: origin.z, at: elapsed };
  }
  if (!victim) return null;
  let dmg = def.damage * (part === 'head' ? def.headMult : part === 'legs' ? def.legMult : 1);
  dmg *= 1 - Math.min(0.4, (dist / def.range) * 0.4);
  if (victim === player) {
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, dmg * 0.5);
      player.armor -= absorbed;
      dmg -= absorbed;
    }
    player.health -= dmg;
    hud.setHealth(player.health, player.armor);
    audio.hurt();
    const ang = Math.atan2(origin.x - player.move.x, origin.z - player.move.z) - player.yaw;
    hud.damageFrom((ang * 180) / Math.PI);
    if (player.health <= 0) {
      player.health = 0;
      match.onKill(shooter, player, weaponId, part === 'head');
    }
  } else {
    const killed = bots.damage(victim, dmg, part);
    if (shooter === player) {
      hud.hitMarker(killed);
      audio.hit(killed);
    }
    if (killed) match.onKill(shooter, victim, weaponId, part === 'head');
  }
  return { victim, part, dist };
}

function enemiesOf(bot) {
  const out = [];
  if (bot.team === 'wardens' && player.alive) {
    out.push({
      kind: 'player', ref: player, alive: true,
      eyePos: { x: player.move.x, y: player.move.y + player.move.eye, z: player.move.z },
      speed: player.groundSpeed(),
    });
  }
  for (const b of bots.bots) {
    if (b.team === bot.team || !b.alive) continue;
    out.push({
      kind: 'bot', ref: b, alive: true,
      eyePos: { x: b.move.x, y: b.move.y + b.move.eye, z: b.move.z },
      speed: Math.hypot(b.move.vx, b.move.vz),
    });
  }
  return out;
}

function botShoot(bot, err) {
  if (!bot.enemy) return;
  const from = bots.eyePos(bot, new THREE.Vector3());
  const to = bot.enemy.eyePos;
  dirV.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
  resolveShot(bot, from, dirV, err, bot.weapon.def.id);
}

function throwGrenade() {
  if (player.grenades <= 0 || !player.alive) return;
  player.grenades -= 1;
  hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.id, player.grenades);
  camera.getWorldDirection(dirV);
  const from = playerEye(new THREE.Vector3());
  grenades.throw(from, dirV, (pos) => {
    audio.flash();
    for (const b of bots.bots) {
      if (!b.alive) continue;
      const d = Math.hypot(b.move.x - pos.x, b.move.z - pos.z);
      if (d > 28) continue;
      const eye = bots.eyePos(b, new THREE.Vector3());
      raycaster.set(eye, new THREE.Vector3(pos.x - eye.x, pos.y - eye.y, pos.z - eye.z).normalize());
      raycaster.far = d;
      if (raycaster.intersectObjects(world.shootables, false)[0]) continue;
      b.blindUntil = elapsed + 1.5 + (1 - d / 28) * 2;
    }
    const pd = Math.hypot(player.move.x - pos.x, player.move.z - pos.z);
    if (pd < 26) {
      camera.getWorldDirection(dirV);
      const facing = dirV.x * (pos.x - player.move.x) + dirV.z * (pos.z - player.move.z);
      if (facing > 0) hud.flashScreen(0.9 * (1 - pd / 30));
    }
  });
}

function step(dt) {
  elapsed += dt;
  const phase = match.state.phase;
  if (player.alive) {
    playerCore.step(dt, input.state.keys);
    weaponStep(player.weapon, dt);
    const pressed = input.takePressed();
    const buyHidden = document.getElementById('buy').hidden;
    for (const code of pressed) {
      if (code === 'KeyR') { if (weaponReload(player.weapon)) audio.reload(); }
      if (code === 'KeyB' && phase === 'buy') {
        if (document.getElementById('buy').hidden) hud.showBuy(player.money, owned);
        else hud.hideBuy();
      }
      if (code === 'KeyG') throwGrenade();
      if (code === 'Tab') {
        const rows = [{ name: 'You', team: 'raiders', kills: player.kills, deaths: player.deaths, money: player.money }];
        for (const b of bots.bots) rows.push({ name: b.name, team: b.team, kills: b.kills, deaths: b.deaths, money: b.money });
        hud.showBoard(rows);
      }
      if (code === 'Digit1' && buyHidden) equipOwned('p9');
      if (code === 'Digit2' && buyHidden) equipOwned('vk9');
      if (code === 'Digit3' && buyHidden) equipOwned('ar77');
      if (code === 'Digit4' && buyHidden) equipOwned('dmr12');
      if (!buyHidden) {
        const map = { Digit1: 'vk9', Digit2: 'ar77', Digit3: 'dmr12', Digit4: 'armor', Digit5: 'spark' };
        if (map[code] && match.buy(player, map[code]) && WEAPONS[map[code]] && !owned.includes(map[code])) owned.push(map[code]);
      }
    }
    if (!input.state.keys.has('Tab')) hud.hideBoard();
    const aiming = input.state.aiming && player.weapon.def.id !== 'p9';
    const look = input.takeLook();
    playerCore.look(look.x, look.y);
    if (input.state.firing && weaponReady(player.weapon) && phase !== 'buy') {
      if (weaponFire(player.weapon)) {
        camera.getWorldDirection(dirV);
        const spread = weaponSpread(player.weapon, playerCore.groundSpeed(), playerCore.move.crouching, aiming);
        resolveShot(player, playerEye(new THREE.Vector3()), dirV, spread, player.weapon.def.id);
        playerCore.recoil(player.weapon.def.kick, (rng() * 2 - 1) * 0.004);
        viewModel.fire();
      }
    }
    if (player.weapon.mag === 0 && input.state.firing) audio.dryFire();
    // Plant / defuse on E.
    const holdingE = input.state.keys.has('KeyE');
    let nearSite = null;
    for (const key of Object.keys(world.sites)) {
      const s = world.sites[key];
      if (Math.hypot(s.x - player.move.x, s.z - player.move.z) < s.r) nearSite = key;
    }
    if (player.team === 'raiders') match.playerPlantTick(dt, holdingE, nearSite);
    else match.playerDefuseTick(dt, holdingE);
    // ADS zoom.
    const targetFov = aiming ? 74 / player.weapon.def.zoom : 74;
    fov += (targetFov - fov) * Math.min(1, dt * 12);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    const spreadPx = 4 + weaponSpread(player.weapon, playerCore.groundSpeed(), playerCore.move.crouching, aiming) * 900;
    hud.setCrosshair(spreadPx);
    viewModel.step(dt, player.weapon.reloadLeft > 0, aiming);
  } else if (input.takeClicked()) {
    // Spectate: click cycles the living Raider.
    const alive = bots.bots.filter((b) => b.team === 'raiders' && b.alive);
    if (alive.length) {
      const i = spectate ? alive.indexOf(spectate) : -1;
      spectate = alive[(i + 1) % alive.length];
    }
  }
  if (!player.alive && !spectate) {
    const alive = bots.bots.filter((b) => b.team === 'raiders' && b.alive);
    if (alive.length) spectate = alive[0];
  }
  if (player.alive) spectate = null;

  const ctx = {
    time: elapsed,
    phase,
    spike: match.state.spike,
    enemiesOf,
    shoot: botShoot,
    onChannelDone: (bot) => match.onChannelDone(bot),
  };
  bots.step(dt, ctx);
  grenades.step(dt);
  tracers.step(dt);
  match.step(dt);
  hud.setHealth(player.health, player.armor);
  hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.id, player.grenades);
  hud.setAlive(match.aliveOf('raiders'), match.aliveOf('wardens'));
  hud.drawMinimap(player, bots.bots, match.state.spike);
}

function equipOwned(id) {
  if (!owned.includes(id) || player.weapon.def.id === id) return;
  player.weapon = createWeaponState(id);
  viewModel.equip(id);
  audio.click();
  hud.setAmmo(player.weapon.mag, player.weapon.reserve, id, player.grenades);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function aimAtPoint(x, y, z) {
  const dx = x - player.move.x;
  const dy = y - (player.move.y + player.move.eye);
  const dz = z - player.move.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
}

function runShot(name) {
  hud.hideOverlay();
  match.startMatch();
  player.money = 4200;
  owned = ['p9', 'ar77'];
  player.weapon = createWeaponState('ar77');
  viewModel.equip('ar77');
  if (name === 'buy') {
    player.move.x = 0;
    player.move.z = 18;
    player.yaw = Math.PI;
    player.pitch = 0;
    settle(30);
    hud.showBuy(player.money, owned);
    hud.setTimer(match.state.timer, 'buy');
    aimAtPoint(0, 1.4, -6);
  } else if (name === 'fight') {
    match.state.phase = 'combat';
    match.state.timer = 80;
    hud.hideBuy();
    hud.hideBanner();
    // A-long, open lane: the player faces two Wardens in the open.
    player.move.x = -20;
    player.move.z = 12;
    player.yaw = 0;
    settle(30);
    const wardens = bots.bots.filter((b) => b.team === 'wardens');
    wardens[0].move.x = -20; wardens[0].move.z = 0;
    wardens[1].move.x = -17; wardens[1].move.z = -4;
    wardens[2].move.x = -23; wardens[2].move.z = -6;
    settle(10);
    aimAtPoint(wardens[0].move.x, 1.4, wardens[0].move.z);
    for (let i = 0; i < 3; i += 1) {
      camera.getWorldDirection(dirV);
      resolveShot(player, playerEye(new THREE.Vector3()), dirV, 0, 'ar77');
      player.weapon.mag -= 1;
      settle(i < 2 ? 4 : 1);
    }
    hud.hitMarker(false);
    hud.setAmmo(player.weapon.mag, player.weapon.reserve, 'ar77', 0);
  } else if (name === 'plant') {
    match.state.phase = 'combat';
    match.state.timer = 55;
    hud.hideBuy();
    hud.hideBanner();
    player.move.x = -14;
    player.move.z = -9;
    player.yaw = Math.PI * 0.75;
    const raiders = bots.bots.filter((b) => b.team === 'raiders');
    raiders[0].move.x = -20; raiders[0].move.z = -14;
    raiders[0].carrier = true;
    const wardens = bots.bots.filter((b) => b.team === 'wardens');
    wardens[0].move.x = -13; wardens[0].move.z = -18;
    wardens[1].move.x = -22; wardens[1].move.z = -19;
    settle(20);
    match.state.playerPlant = 0.6;
    hud.plantProgress(0.6, 'PLANTING SPIKE — hold E');
    aimAtPoint(-19, 1.4, -15);
  } else {
    // end: a round just won, scoreboard up, the yard behind it.
    match.state.scoreR = 3;
    match.state.scoreW = 2;
    match.state.round = 6;
    match.state.phase = 'roundEnd';
    hud.hideBuy();
    hud.hideBanner();
    player.move.x = -6;
    player.move.z = 12;
    player.yaw = 0;
    const wardens = bots.bots.filter((b) => b.team === 'wardens');
    wardens[0].alive = false;
    wardens[0].body.group.rotation.x = -Math.PI / 2;
    wardens[0].body.group.position.y = 0.15;
    wardens[0].body.tag.visible = false;
    settle(20);
    hud.setScore(3, 2, 6);
    const rows = [{ name: 'You', team: 'raiders', kills: 3, deaths: 1, money: 5100 }];
    for (const b of bots.bots) rows.push({ name: b.name, team: b.team, kills: b.kills, deaths: b.deaths, money: b.money });
    hud.showBoard(rows);
    aimAtPoint(-2, 1.4, -6);
  }
  hud.setScore(match.state.scoreR, match.state.scoreW, match.state.round);
  hud.setAlive(match.aliveOf('raiders'), match.aliveOf('wardens'));
  hud.setMoney(player.money);
  hud.setHealth(player.health, player.armor);
  syncCamera();
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__ironhold = { match, player, bots, world, hud, audio, debug: { shots: 0, botHits: 0, selfHits: 0, playerHits: 0 }, get elapsed() { return elapsed; } };

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
