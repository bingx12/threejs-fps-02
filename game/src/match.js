// The match: rounds, economy, the spike and the win conditions. All match
// state lives here, in one place; main.js drives it and bots read it.
import { WEAPONS, GRENADE, createWeaponState } from './weapons.js';

const BUY_SECONDS = 15;
const ROUND_SECONDS = 100;
const PLANT_SECONDS = 3.2;
const DEFUSE_SECONDS = 5;
const FUSE_SECONDS = 35;
const WIN_ROUNDS = 7;
const MAX_ROUNDS = 13;

export function createMatch(deps) {
  const { player, bots, hud, audio, world } = deps;
  const state = {
    phase: 'buy', // buy | combat | planted | roundEnd | matchEnd
    round: 1,
    scoreR: 0,
    scoreW: 0,
    timer: BUY_SECONDS,
    spike: { carrier: null, planted: false, site: null, pos: { x: 0, z: 0 }, fuse: 0 },
    lossStreak: { raiders: 0, wardens: 0 },
    playerPlant: 0,
    playerDefuse: 0,
    lastBeepAt: 0,
    started: false,
  };

  function aliveOf(team) {
    if (team === 'raiders') return (player.alive ? 1 : 0) + bots.aliveCount('raiders');
    return bots.aliveCount('wardens');
  }

  function award(winner) {
    const loser = winner === 'raiders' ? 'wardens' : 'raiders';
    state.lossStreak[loser] += 1;
    state.lossStreak[winner] = 0;
    const lossBonus = Math.min(3400, 1900 + (state.lossStreak[loser] - 1) * 500);
    const give = (person, amount) => { person.money += amount; };
    if (winner === 'raiders') {
      give(player, 3250);
      for (const b of bots.bots) if (b.team === 'raiders') give(b, 3250);
      for (const b of bots.bots) if (b.team === 'wardens') give(b, lossBonus);
    } else {
      give(player, lossBonus);
      for (const b of bots.bots) if (b.team === 'raiders') give(b, lossBonus);
      for (const b of bots.bots) if (b.team === 'wardens') give(b, 3250);
    }
  }

  function startRound() {
    state.phase = 'buy';
    state.timer = BUY_SECONDS;
    state.spike = { carrier: null, planted: false, site: null, pos: { x: 0, z: 0 }, fuse: 0 };
    state.playerPlant = 0;
    state.playerDefuse = 0;
    // Player resets to spawn with a fresh sidearm; bought guns are re-bought.
    player.health = 100;
    player.armor = 0;
    player.alive = true;
    player.weapon = createWeaponState('p9');
    player.grenades = 0;
    player.move.x = 0;
    player.move.z = 19;
    player.move.y = 0;
    player.move.vx = 0; player.move.vy = 0; player.move.vz = 0;
    player.yaw = 0;
    player.pitch = 0;
    // The spike goes to a random Raider; the player carries it every third round.
    const carrier = state.round % 3 === 0 ? 'player' : Math.floor(Math.random() * 4);
    const botCarrier = bots.resetRound(state.round, carrier === 'player' ? 'player' : carrier);
    state.spike.carrier = carrier === 'player' ? player : botCarrier;
    hud.setScore(state.scoreR, state.scoreW, state.round);
    hud.setMoney(player.money);
    hud.setHealth(player.health, player.armor);
    hud.setAmmo(player.weapon.mag, player.weapon.reserve, 'p9', player.grenades);
    hud.plantProgress(null);
    hud.showBuy(player.money, ['p9']);
    hud.banner(`ROUND ${state.round}`, state.round % 3 === 0 ? 'You carry the spike — plant it at A or B' : 'Buy phase — press B for the shop', 3000);
  }

  function startMatch() {
    state.scoreR = 0;
    state.scoreW = 0;
    state.round = 1;
    state.lossStreak = { raiders: 0, wardens: 0 };
    player.money = 800;
    player.kills = 0;
    player.deaths = 0;
    for (const b of bots.bots) { b.money = 800; b.kills = 0; b.deaths = 0; }
    state.started = true;
    startRound();
  }

  function endRound(winner, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return;
    state.phase = 'roundEnd';
    state.timer = 4;
    if (winner === 'raiders') state.scoreR += 1;
    else state.scoreW += 1;
    award(winner);
    hud.hideBuy();
    hud.plantProgress(null);
    const youWon = winner === 'raiders';
    hud.banner(youWon ? 'RAIDERS TAKE THE ROUND' : 'WARDENS HOLD THE YARD', reason, 3400);
    if (youWon) audio.roundWin(); else audio.roundLose();
    hud.setScore(state.scoreR, state.scoreW, state.round);
    hud.setMoney(player.money);
    if (state.scoreR >= WIN_ROUNDS || state.scoreW >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.phase = 'matchEnd';
      state.timer = 999;
      const matchWinner = state.scoreR > state.scoreW ? 'raiders' : state.scoreW > state.scoreR ? 'wardens' : 'draw';
      const text = matchWinner === 'draw'
        ? `Draw — ${state.scoreR} : ${state.scoreW}`
        : matchWinner === 'raiders'
          ? `Raiders take Depot 12 — ${state.scoreR} : ${state.scoreW}`
          : `Wardens hold Depot 12 — ${state.scoreR} : ${state.scoreW}`;
      setTimeout(() => hud.showOverlay('match', text), 3600);
    }
  }

  function onKill(killer, victim, weaponId, headshot) {
    killer.kills += 1;
    victim.deaths += 1;
    if (killer !== victim) killer.money += 300;
    if (killer === player) hud.setMoney(player.money);
    hud.killfeed(killer.name, victim.name, weaponId === 'spark' ? 'Spark' : (WEAPONS[weaponId]?.name ?? weaponId), headshot, killer.team, victim.team);
    if (victim === player) {
      player.alive = false;
      audio.hurt();
      deps.onPlayerDeath();
    }
    if (victim === state.spike.carrier && !state.spike.planted) {
      // The spike drops where the carrier fell; a living Raider picks it up.
      state.spike.carrier = null;
      state.spike.pos = { x: victim.move.x, z: victim.move.z };
      hud.banner('SPIKE DROPPED', 'A Raider must pick it up', 2200);
    }
    const r = aliveOf('raiders');
    const w = aliveOf('wardens');
    hud.setAlive(r, w);
    if (state.phase === 'combat' || state.phase === 'planted') {
      if (r === 0) endRound('wardens', state.spike.planted ? 'Spike carrier eliminated — defused by default' : 'Raiders eliminated');
      else if (w === 0 && !state.spike.planted) endRound('raiders', 'Wardens eliminated');
      else if (w === 0 && state.spike.planted) endRound('raiders', 'Wardens eliminated — spike stands');
    }
  }

  function onChannelDone(bot) {
    if (bot.channel === 'plant') {
      bot.channel = null;
      state.spike.planted = true;
      state.spike.site = bot.site;
      state.spike.pos = { x: world.sites[bot.site].x, z: world.sites[bot.site].z };
      state.spike.fuse = FUSE_SECONDS;
      state.phase = 'planted';
      state.timer = FUSE_SECONDS;
      state.lastBeepAt = FUSE_SECONDS;
      hud.banner('SPIKE PLANTED', `Detonation in ${FUSE_SECONDS}s — Wardens must defuse`, 3000);
      audio.plantBeep(true);
    } else if (bot.channel === 'defuse') {
      bot.channel = null;
      endRound('wardens', 'Spike defused');
    }
  }

  function playerPlantTick(dt, holding, nearSite) {
    if (state.phase !== 'combat' || state.spike.carrier !== player || state.spike.planted) return;
    if (holding && nearSite) {
      state.playerPlant += dt / PLANT_SECONDS;
      hud.plantProgress(state.playerPlant, 'PLANTING SPIKE — hold E');
      if (state.playerPlant >= 1) {
        state.playerPlant = 0;
        state.spike.planted = true;
        state.spike.site = nearSite;
        state.spike.pos = { x: world.sites[nearSite].x, z: world.sites[nearSite].z };
        state.spike.fuse = FUSE_SECONDS;
        state.phase = 'planted';
        state.timer = FUSE_SECONDS;
        state.lastBeepAt = FUSE_SECONDS;
        hud.banner('SPIKE PLANTED', `Detonation in ${FUSE_SECONDS}s — hold the site`, 3000);
        audio.plantBeep(true);
      }
    } else {
      if (state.playerPlant > 0) hud.plantProgress(null);
      state.playerPlant = 0;
    }
  }

  function playerDefuseTick(dt, holding) {
    if (state.phase !== 'planted' || player.team !== 'wardens') return;
    const d = Math.hypot(state.spike.pos.x - player.move.x, state.spike.pos.z - player.move.z);
    if (holding && d < 2.4) {
      state.playerDefuse += dt / DEFUSE_SECONDS;
      hud.plantProgress(state.playerDefuse, 'DEFUSING — hold E');
      if (state.playerDefuse >= 1) {
        state.playerDefuse = 0;
        endRound('wardens', 'Spike defused');
      }
    } else {
      if (state.playerDefuse > 0) hud.plantProgress(null);
      state.playerDefuse = 0;
    }
  }

  function pickupSpike() {
    // A living Raider standing on the dropped spike picks it up.
    if (state.spike.planted || state.spike.carrier || state.phase !== 'combat') return;
    const d = Math.hypot(state.spike.pos.x - player.move.x, state.spike.pos.z - player.move.z);
    if (d < 1.6 && player.alive) {
      state.spike.carrier = player;
      hud.banner('SPIKE RECOVERED', 'Plant it at A or B', 1800);
      return;
    }
    for (const b of bots.bots) {
      if (b.team !== 'raiders' || !b.alive || b.carrier) continue;
      const bd = Math.hypot(state.spike.pos.x - b.move.x, state.spike.pos.z - b.move.z);
      if (bd < 1.6) {
        b.carrier = true;
        b.site = Math.random() < 0.5 ? 'A' : 'B';
        state.spike.carrier = b;
        return;
      }
    }
  }

  function buy(playerId, itemId) {
    if (state.phase !== 'buy') return false;
    if (itemId === 'armor') {
      if (player.money < 650 || player.armor >= 50) return false;
      player.money -= 650;
      player.armor = 50;
    } else if (itemId === 'spark') {
      if (player.money < GRENADE.price || player.grenades >= 2) return false;
      player.money -= GRENADE.price;
      player.grenades += 1;
    } else {
      const def = WEAPONS[itemId];
      if (!def || player.money < def.price) return false;
      player.money -= def.price;
      player.weapon = createWeaponState(itemId);
      deps.onEquip(itemId);
    }
    hud.setMoney(player.money);
    hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.id, player.grenades);
    hud.refreshBuy(player.money, [player.weapon.def.id, ...(player.armor > 0 ? ['armor'] : []), ...(player.grenades > 0 ? ['spark'] : [])]);
    audio.buy();
    return true;
  }

  function step(dt) {
    if (!state.started) return;
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.phase = 'combat';
        state.timer = ROUND_SECONDS;
        hud.hideBuy();
        hud.banner('GO', 'Plant the spike or eliminate the Wardens', 1600);
        audio.click();
      }
    } else if (state.phase === 'combat') {
      state.timer -= dt;
      pickupSpike();
      if (state.timer <= 0) endRound('wardens', 'Time expired — Wardens hold');
    } else if (state.phase === 'planted') {
      state.timer -= dt;
      state.spike.fuse = state.timer;
      if (state.timer <= state.lastBeepAt - 1) {
        state.lastBeepAt = state.timer;
        audio.plantBeep(false);
      }
      if (state.timer <= 0) {
        audio.explosion(0);
        endRound('raiders', 'Spike detonated');
      }
    } else if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.round += 1;
        startRound();
      }
    }
    hud.setTimer(state.timer, state.phase);
  }

  return {
    state,
    startMatch,
    startRound,
    endRound,
    onKill,
    onChannelDone,
    playerPlantTick,
    playerDefuseTick,
    buy,
    step,
    aliveOf,
  };
}
