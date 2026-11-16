// Bots: five per team, waypoint routing, holds, rotations and a plant/defuse
// objective. Each bot decides at 5 Hz and moves every step; shooting is the
// same hitscan resolve the player uses, with reaction time and aim error so a
// bot that sees you first still has to earn the kill.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS, GRENADE, createWeaponState, weaponStep, weaponReady, weaponFire, weaponReload, weaponSpread } from './weapons.js';
import { makeMover } from './player.js';

const BOT_NAMES = {
  raiders: ['Vex', 'Rook', 'Juno', 'Mara'],
  wardens: ['Sable', 'Ivo', 'Kestrel', 'Dara', 'Nox'],
};
const EYE = 1.5;
const BODY_SPEED = 4.7;

function makeNameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(12,14,17,0.62)';
  ctx.beginPath();
  ctx.roundRect(28, 8, 200, 48, 8);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.7, 0.42, 1);
  return sprite;
}

function buildBody(team, name) {
  const color = team === 'raiders' ? PALETTE.raider : PALETTE.warden;
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.8, metalness: 0.1 });
  const skin = new THREE.MeshStandardMaterial({ color: '#c9a184', roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.32), suit);
  torso.position.y = 1.02;
  torso.userData.part = 'torso';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skin);
  head.position.y = 1.55;
  head.userData.part = 'head';
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.05), dark);
  visor.position.set(0, 1.56, 0.14);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), dark);
  legL.position.set(-0.14, 0.31, 0);
  legL.userData.part = 'legs';
  const legR = legL.clone();
  legR.position.x = 0.14;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), dark);
  gun.position.set(0.2, 1.12, -0.25);
  group.add(torso, head, visor, legL, legR, gun);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  const tag = makeNameTag(name, color);
  tag.position.y = 1.95;
  group.add(tag);
  return { group, torso, head, legL, legR, gun, tag, suit };
}

export function createBots(scene, world) {
  const mover = makeMover(world.colliders);
  const bots = [];
  const ray = new THREE.Raycaster();
  const tmpDir = new THREE.Vector3();
  const tmpEye = new THREE.Vector3();

  function addBot(team, index) {
    const name = BOT_NAMES[team][index];
    const body = buildBody(team, name);
    scene.add(body.group);
    const bot = {
      kind: 'bot', team, name, index,
      move: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, height: 1.72, eye: EYE, onGround: true, crouching: false },
      yaw: 0, pitch: 0,
      health: 100, armor: 0, alive: true,
      money: 800, kills: 0, deaths: 0,
      weapon: createWeaponState('p9'),
      grenades: 0,
      role: 'holder', site: 'A', carrier: false,
      state: 'idle', path: [], pathI: 0, holdPos: null, scanYaw: 0,
      enemy: null, enemyPos: { x: 0, y: 0, z: 0 }, lastSeen: -10,
      reactAt: 0, burstLeft: 0, burstPause: 0, aimErr: 0,
      blindUntil: 0, channel: null, channelT: 0,
      decideAt: 0, strafeDir: 1, strafeAt: 0,
      body, hitMeshes: [body.torso, body.head, body.legL, body.legR],
    };
    body.torso.userData.bot = bot;
    body.head.userData.bot = bot;
    body.legL.userData.bot = bot;
    body.legR.userData.bot = bot;
    // Stand at the team spawn until the first round resets positions.
    const spawns = team === 'raiders' ? world.raiderSpawns : world.wardenSpawns;
    bot.move.x = spawns[index][0];
    bot.move.z = spawns[index][1];
    bot.yaw = team === 'raiders' ? 0 : Math.PI;
    bot.body.group.position.set(bot.move.x, 0, bot.move.z);
    bot.body.group.rotation.y = bot.yaw;
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 4; i += 1) addBot('raiders', i);
  for (let i = 0; i < 5; i += 1) addBot('wardens', i);

  function buyFor(bot) {
    // Spend the round's money like a player would: rifle first, then armour,
    // then a Spark, then the marksman rifle when rich.
    const m = bot.money;
    let id = 'p9';
    if (m >= 4200 + 650) id = 'dmr12';
    else if (m >= 2700 + 650) id = 'ar77';
    else if (m >= 900) id = 'vk9';
    bot.money -= WEAPONS[id].price;
    bot.weapon = createWeaponState(id);
    if (bot.money >= 650) { bot.money -= 650; bot.armor = 50; }
    if (bot.money >= GRENADE.price) { bot.money -= GRENADE.price; bot.grenades = 1; }
  }

  function resetRound(round, spikeCarrier) {
    for (const bot of bots) {
      bot.alive = true;
      bot.health = 100;
      bot.armor = 0;
      bot.channel = null;
      bot.channelT = 0;
      bot.blindUntil = 0;
      bot.enemy = null;
      bot.path = [];
      bot.pathI = 0;
      bot.state = 'route';
      bot.body.group.rotation.set(0, 0, 0);
      bot.body.group.visible = true;
      bot.body.tag.visible = true;
      const spawns = bot.team === 'raiders' ? world.raiderSpawns : world.wardenSpawns;
      const s = spawns[bot.index];
      bot.move.x = s[0];
      bot.move.y = 0;
      bot.move.z = s[1];
      bot.move.vx = 0; bot.move.vy = 0; bot.move.vz = 0;
      bot.yaw = bot.team === 'raiders' ? 0 : Math.PI;
      bot.pitch = 0;
      buyFor(bot);
    }
    // Roles: one Raider carries the spike; Wardens split 2/2/1 across A, B, mid.
    const raiders = bots.filter((b) => b.team === 'raiders');
    raiders.forEach((b) => { b.carrier = false; });
    const carrier = spikeCarrier === 'player' ? null : raiders[spikeCarrier % raiders.length];
    if (carrier) carrier.carrier = true;
    const site = Math.random() < 0.5 ? 'A' : 'B';
    raiders.forEach((b) => { b.site = site; b.role = b.carrier ? 'carrier' : 'rusher'; });
    const wardens = bots.filter((b) => b.team === 'wardens');
    wardens.forEach((b, i) => {
      b.site = i < 2 ? 'A' : i < 4 ? 'B' : 'mid';
      b.role = 'holder';
    });
    return carrier;
  }

  function eyePos(bot, out) {
    out.set(bot.move.x, bot.move.y + bot.move.eye, bot.move.z);
    return out;
  }

  function canSee(bot, target, ctx) {
    const from = eyePos(bot, tmpEye);
    const to = target.eyePos;
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (dist > 58) return false;
    tmpDir.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
    ray.set(from, tmpDir);
    ray.far = dist;
    const hit = ray.intersectObjects(world.shootables, false)[0];
    return !hit;
  }

  function pickTarget(bot, ctx) {
    // Nearest visible enemy; the player counts like any bot.
    let best = null;
    let bestDist = Infinity;
    for (const e of ctx.enemiesOf(bot)) {
      if (!e.alive) continue;
      const d = Math.hypot(e.eyePos.x - bot.move.x, e.eyePos.z - bot.move.z);
      if (d < bestDist && canSee(bot, e, ctx)) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  function routeTo(bot, x, z) {
    bot.path = world.findPath(bot.move.x, bot.move.z, x, z);
    bot.pathI = 0;
    bot.state = 'route';
  }

  function sitePoint(bot, site, jitter) {
    const s = world.sites[site];
    const jx = (Math.random() * 2 - 1) * (jitter ?? 2.5);
    const jz = (Math.random() * 2 - 1) * (jitter ?? 2.5);
    return { x: s.x + jx, z: s.z + jz };
  }

  function decide(bot, ctx) {
    const now = ctx.time;
    // Bots only act while a round is live; between rounds they stand down.
    if (ctx.phase !== 'combat' && ctx.phase !== 'planted') { bot.state = 'idle'; return; }
    if (bot.channel) return;
    if (ctx.spike.planted) {
      if (bot.team === 'raiders') {
        // Defend the planted spike from a hold near the site.
        if (bot.state !== 'hold') {
          const p = sitePoint(bot, ctx.spike.site, 4);
          routeTo(bot, p.x, p.z);
          bot.holdPos = p;
        }
      } else {
        // Rotate to the site and defuse when close.
        const d = Math.hypot(ctx.spike.pos.x - bot.move.x, ctx.spike.pos.z - bot.move.z);
        if (d < 2.2) {
          bot.channel = 'defuse';
          bot.channelT = 5;
          bot.state = 'channel';
        } else if (bot.state !== 'route' || !bot.path.length) {
          routeTo(bot, ctx.spike.pos.x, ctx.spike.pos.z);
        }
      }
      return;
    }
    if (bot.team === 'raiders') {
      if (bot.carrier) {
        const s = world.sites[bot.site];
        const d = Math.hypot(s.x - bot.move.x, s.z - bot.move.z);
        if (d < 2.6 && !bot.enemy) {
          bot.channel = 'plant';
          bot.channelT = 3.2;
          bot.state = 'channel';
        } else if (bot.state !== 'route' || !bot.path.length) {
          routeTo(bot, s.x, s.z);
        }
      } else if (!bot.path.length) {
        const p = sitePoint(bot, bot.site, 3.5);
        routeTo(bot, p.x, p.z);
        bot.holdPos = p;
      }
    } else {
      // Wardens hold their site; rotate on a fresh noise, then return.
      if (bot.hear && now - bot.hear.at < 6) {
        const d = Math.hypot(bot.hear.x - bot.move.x, bot.hear.z - bot.move.z);
        if (d > 6 && bot.state !== 'route') routeTo(bot, bot.hear.x, bot.hear.z);
        if (d <= 6) bot.hear = null;
        return;
      }
      if (!bot.path.length && bot.state !== 'hold') {
        const p = bot.site === 'mid'
          ? { x: (Math.random() * 2 - 1) * 4, z: (Math.random() * 2 - 1) * 6 }
          : sitePoint(bot, bot.site, 3.5);
        routeTo(bot, p.x, p.z);
        bot.holdPos = p;
      }
    }
  }

  function stepBot(bot, dt, ctx) {
    const now = ctx.time;
    if (!bot.alive) return;
    weaponStep(bot.weapon, dt);
    const blinded = now < bot.blindUntil;
    // Bots only acquire targets and fight while a round is live.
    const live = ctx.phase === 'combat' || ctx.phase === 'planted';

    // Decision tick at 5 Hz, staggered by index.
    if (now >= bot.decideAt) {
      bot.decideAt = now + 0.2 + bot.index * 0.02;
      const target = blinded || !live ? null : pickTarget(bot, ctx);
      if (target && (!bot.enemy || target.ref !== bot.enemy.ref)) {
        bot.enemy = target;
        bot.reactAt = now + 0.35 + Math.random() * 0.35;
        bot.burstLeft = 0;
      } else if (target) {
        // Same target: refresh the eye-position snapshot, keep the timer.
        bot.enemy = target;
      } else if (!target) {
        bot.enemy = null;
      }
      if (!bot.enemy) decide(bot, ctx);
    }

    let wishX = 0;
    let wishZ = 0;
    let wantCrouch = false;
    let aimAt = null;

    if (bot.channel) {
      // Stand still and channel; the match watches channelT.
      bot.channelT -= dt;
      if (bot.channelT <= 0) ctx.onChannelDone(bot);
    } else if (bot.enemy && !blinded && live) {
      // Combat: face the enemy, strafe, fire in bursts after reacting.
      const e = bot.enemy;
      aimAt = e.eyePos;
      const dx = e.eyePos.x - bot.move.x;
      const dz = e.eyePos.z - bot.move.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (now > bot.strafeAt) {
        bot.strafeAt = now + 0.5 + Math.random() * 0.7;
        bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      const px = -dz / dist;
      const pz = dx / dist;
      wishX = px * bot.strafeDir * 0.7;
      wishZ = pz * bot.strafeDir * 0.7;
      if (dist > 26) { wishX += (dx / dist) * 0.5; wishZ += (dz / dist) * 0.5; }
      if (dist < 5) { wishX -= (dx / dist) * 0.6; wishZ -= (dz / dist) * 0.6; }
      if (now >= bot.reactAt) {
        if (bot.burstLeft <= 0) {
          if (bot.burstPause <= 0) {
            bot.burstLeft = bot.weapon.def.auto ? 3 + Math.floor(Math.random() * 3) : 1;
            bot.burstPause = bot.weapon.def.auto ? 0.45 + Math.random() * 0.4 : 0.5;
          } else bot.burstPause -= dt;
        }
        if (bot.burstLeft > 0 && weaponReady(bot.weapon)) {
          const err = 0.012 + dist * 0.00045 + (e.speed || 0) * 0.0016 + Math.hypot(bot.move.vx, bot.move.vz) * 0.002;
          const fired = weaponFire(bot.weapon);
          if (fired) {
            bot.burstLeft -= 1;
            ctx.shoot(bot, err);
          }
        }
      }
      if (bot.weapon.mag === 0) weaponReload(bot.weapon);
    } else if (bot.state === 'route' && bot.path.length) {
      const node = bot.path[bot.pathI];
      const dx = node.x - bot.move.x;
      const dz = node.z - bot.move.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.7) {
        bot.pathI += 1;
        if (bot.pathI >= bot.path.length) {
          bot.path = [];
          bot.state = bot.holdPos ? 'hold' : 'idle';
          bot.scanYaw = bot.yaw;
        }
      } else {
        wishX = dx / dist;
        wishZ = dz / dist;
        aimAt = { x: node.x, y: 0, z: node.z };
      }
    } else if (bot.state === 'hold') {
      // Scan the lane: slow yaw sweep.
      bot.scanYaw += dt * 0.5;
      bot.yaw = bot.scanYaw;
      wantCrouch = false;
    }

    if (blinded) {
      wishX = 0;
      wishZ = 0;
      aimAt = null;
    }

    // Turn the body toward the aim point (or the walk direction).
    if (aimAt) {
      const dx = aimAt.x - bot.move.x;
      const dz = aimAt.z - bot.move.z;
      const want = Math.atan2(-dx, -dz);
      let diff = want - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.min(1, dt * 7);
      bot.yaw += diff * turn;
      bot.pitch = 0;
    } else if (wishX || wishZ) {
      const want = Math.atan2(-wishX, -wishZ);
      let diff = want - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * Math.min(1, dt * 5);
    }

    mover.stepBody(bot.move, wishX, wishZ, false, wantCrouch, dt);
    bot.body.group.position.set(bot.move.x, bot.move.y, bot.move.z);
    bot.body.group.rotation.y = bot.yaw;
    const walking = Math.hypot(bot.move.vx, bot.move.vz) > 0.5;
    const swing = walking ? Math.sin(now * 9 + bot.index) * 0.35 : 0;
    bot.body.legL.rotation.x = swing;
    bot.body.legR.rotation.x = -swing;
    bot.body.group.position.y = bot.move.y + (walking ? Math.abs(Math.sin(now * 9 + bot.index)) * 0.03 : 0);
  }

  function damage(bot, amount, part) {
    if (!bot.alive) return false;
    let dmg = amount;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, dmg * 0.5);
      bot.armor -= absorbed;
      dmg -= absorbed;
    }
    bot.health -= dmg;
    bot.body.suit.emissive = new THREE.Color(PALETTE.danger);
    bot.body.suit.emissiveIntensity = 0.7;
    setTimeout(() => { bot.body.suit.emissiveIntensity = 0; }, 120);
    if (bot.health <= 0) {
      bot.alive = false;
      bot.deaths += 1;
      bot.body.group.rotation.x = -Math.PI / 2;
      bot.body.group.position.y = 0.15;
      bot.body.tag.visible = false;
      bot.channel = null;
      return true;
    }
    return false;
  }

  return {
    bots,
    buyFor,
    resetRound,
    damage,
    step(dt, ctx) {
      for (const bot of bots) stepBot(bot, dt, ctx);
    },
    aliveCount(team) {
      return bots.filter((b) => b.team === team && b.alive).length;
    },
    eyePos,
    hitMeshes() {
      const out = [];
      for (const b of bots) if (b.alive) out.push(...b.hitMeshes);
      return out;
    },
  };
}
