// The DOM HUD: health, ammo, money, timer, score, kill feed, buy menu,
// scoreboard, minimap and overlays. It never touches the simulation; main.js
// and match.js push numbers in and read callbacks out.
import { PALETTE, WEAPON_NAMES } from './palette.js';

const BUY_ITEMS = [
  { id: 'vk9', key: '1', price: 900 },
  { id: 'ar77', key: '2', price: 2700 },
  { id: 'dmr12', key: '3', price: 4200 },
  { id: 'armor', key: '4', price: 650 },
  { id: 'spark', key: '5', price: 300 },
];

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const els = {
    crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    healthNum: $('health-num'), healthBar: $('health-bar'),
    armorNum: $('armor-num'), armorBar: $('armor-bar'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), weaponName: $('weapon-name'),
    nades: $('nades'), money: $('money'),
    timer: $('timer'), timerLabel: $('timer-label'),
    scoreR: $('score-r'), scoreW: $('score-w'), roundNum: $('round-num'),
    aliveR: $('alive-r'), aliveW: $('alive-w'),
    killfeed: $('killfeed'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    buy: $('buy'), buyList: $('buy-list'), buyMoney: $('buy-money'),
    board: $('board'), boardRows: $('board-rows'),
    plant: $('plant'), plantFill: $('plant-fill'), plantLabel: $('plant-label'),
    flash: $('flash'), damage: $('damage'), vignette: $('vignette'),
    overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayCopy: $('overlay-copy'),
    play: $('play'), minimap: $('minimap'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let hitTimer = 0;
  let bannerTimer = 0;
  let last = {};
  let buyHandler = null;

  function setText(el, key, value) {
    if (last[key] !== value) {
      last[key] = value;
      el.textContent = value;
    }
  }

  return {
    setHealth(hp, armor) {
      setText(els.healthNum, 'hp', String(Math.max(0, Math.ceil(hp))));
      setText(els.armorNum, 'ar', String(Math.max(0, Math.ceil(armor))));
      els.healthBar.style.width = `${Math.max(0, hp)}%`;
      els.armorBar.style.width = `${Math.max(0, Math.min(100, armor * 2))}%`;
      els.healthBar.style.background = hp <= 30 ? PALETTE.danger : PALETTE.health;
      els.vignette.style.opacity = hp <= 30 ? String(0.55 - hp / 100) : '0';
    },
    setAmmo(mag, reserve, weaponId, grenades) {
      setText(els.ammoMag, 'mag', String(mag));
      setText(els.ammoReserve, 'res', `/ ${reserve}`);
      setText(els.weaponName, 'wn', WEAPON_NAMES[weaponId] ?? weaponId);
      setText(els.nades, 'nd', grenades > 0 ? `◉ ${grenades}` : '');
    },
    setMoney(n) { setText(els.money, 'money', `$${n}`); },
    setTimer(sec, phase) {
      const s = Math.max(0, Math.ceil(sec));
      setText(els.timer, 'timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      setText(els.timerLabel, 'tlabel', phase === 'buy' ? 'BUY PHASE' : phase === 'planted' ? 'SPIKE ARMED' : 'ROUND');
      els.timer.style.color = s <= 10 && phase !== 'buy' ? PALETTE.danger : PALETTE.ink;
    },
    setScore(r, w, round) {
      setText(els.scoreR, 'sr', String(r));
      setText(els.scoreW, 'sw', String(w));
      setText(els.roundNum, 'rn', `ROUND ${round}`);
    },
    setAlive(r, w) {
      setText(els.aliveR, 'ar', '●'.repeat(r) + '○'.repeat(Math.max(0, 5 - r)));
      setText(els.aliveW, 'aw', '●'.repeat(w) + '○'.repeat(Math.max(0, 5 - w)));
    },
    killfeed(killer, victim, weapon, headshot, killerTeam, victimTeam) {
      const div = document.createElement('div');
      div.className = 'feed-row';
      const kc = killerTeam === 'raiders' ? 'var(--raider)' : 'var(--warden)';
      const vc = victimTeam === 'raiders' ? 'var(--raider)' : 'var(--warden)';
      div.innerHTML = `<b style="color:${kc}">${killer}</b> <span class="feed-weapon">${headshot ? '◉ ' : ''}${weapon}</span> <b style="color:${vc}">${victim}</b>`;
      els.killfeed.prepend(div);
      while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
      setTimeout(() => div.remove(), 6000);
    },
    hitMarker(kill) {
      els.hitmarker.classList.add('on');
      els.hitmarker.style.transform = kill
        ? 'translate(-50%,-50%) rotate(45deg) scale(1.3)'
        : 'translate(-50%,-50%) rotate(45deg)';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => els.hitmarker.classList.remove('on'), 110);
    },
    damageFrom(angleDeg) {
      els.damage.style.transform = `rotate(${angleDeg}deg)`;
      els.damage.classList.add('on');
      setTimeout(() => els.damage.classList.remove('on'), 450);
    },
    flashScreen(strength) {
      els.flash.style.opacity = String(Math.min(1, strength));
      setTimeout(() => { els.flash.style.opacity = '0'; }, 60);
      setTimeout(() => { els.flash.style.opacity = '0'; }, 500);
    },
    banner(title, sub, holdMs = 2600) {
      els.bannerTitle.textContent = title;
      els.bannerSub.textContent = sub ?? '';
      els.banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => els.banner.classList.remove('on'), holdMs);
    },
    hideBanner() {
      clearTimeout(bannerTimer);
      els.banner.classList.remove('on');
    },
    plantProgress(frac, label) {
      if (frac == null) { els.plant.hidden = true; return; }
      els.plant.hidden = false;
      els.plantLabel.textContent = label;
      els.plantFill.style.width = `${Math.round(frac * 100)}%`;
    },
    setCrosshair(px) {
      els.crosshair.style.setProperty('--gap', `${px}px`);
    },
    showBuy(money, owned) {
      els.buyMoney.textContent = `$${money}`;
      els.buyList.innerHTML = '';
      for (const item of BUY_ITEMS) {
        const name = item.id === 'armor' ? 'Kevlar vest' : item.id === 'spark' ? 'Spark grenade' : WEAPON_NAMES[item.id];
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'buy-row';
        row.dataset.id = item.id;
        const afford = money >= item.price;
        const has = owned.includes(item.id);
        row.disabled = !afford || has;
        row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${name}</span><span class="buy-price">${has ? 'OWNED' : '$' + item.price}</span>`;
        row.addEventListener('click', () => buyHandler && buyHandler(item.id));
        els.buyList.appendChild(row);
      }
      els.buy.hidden = false;
    },
    hideBuy() { els.buy.hidden = true; },
    refreshBuy(money, owned) {
      if (!els.buy.hidden) this.showBuy(money, owned);
    },
    onBuy(handler) { buyHandler = handler; },
    showBoard(rows) {
      els.boardRows.innerHTML = '';
      for (const r of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:${r.team === 'raiders' ? 'var(--raider)' : 'var(--warden)'}">${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td><td>$${r.money}</td>`;
        els.boardRows.appendChild(tr);
      }
      els.board.hidden = false;
    },
    hideBoard() { els.board.hidden = true; },
    showOverlay(mode, extra) {
      const copy = {
        start: ['IRONHOLD', 'Depot 12 — Raiders plant the spike, Wardens hold the yard. First to 7 rounds takes the yard.', 'Click to play'],
        paused: ['IRONHOLD', 'Paused. Click to resume.', 'Click to resume'],
        dead: ['You are down', 'Spectating a teammate — click to cycle the view.', 'Spectate'],
        match: ['Yard taken', extra ?? '', 'Play again'],
      }[mode];
      els.overlayTitle.textContent = copy[0];
      els.overlayCopy.textContent = copy[1];
      els.play.textContent = copy[2];
      els.overlay.hidden = false;
      els.play.focus();
    },
    hideOverlay() { els.overlay.hidden = true; },
    onPlay(handler) { els.play.addEventListener('click', handler); },
    drawMinimap(player, bots, spike) {
      const ctx = mapCtx;
      const W = 176;
      const H = 138;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(16,18,22,0.78)';
      ctx.fillRect(0, 0, W, H);
      const sx = (x) => ((x + 28.5) / 57) * W;
      const sz = (z) => ((z + 22.5) / 45) * H;
      ctx.fillStyle = 'rgba(154,160,168,0.55)';
      for (const f of world.footprints) {
        if (f.top < 0.5) continue;
        ctx.fillRect(sx(f.minX), sz(f.minZ), Math.max(1, sx(f.maxX) - sx(f.minX)), Math.max(1, sz(f.maxZ) - sz(f.minZ)));
      }
      for (const key of Object.keys(world.sites)) {
        const s = world.sites[key];
        ctx.strokeStyle = key === 'A' ? PALETTE.raider : PALETTE.warden;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx(s.x), sz(s.z), 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(key, sx(s.x), sz(s.z) - 10);
      }
      if (spike && spike.planted) {
        ctx.fillStyle = PALETTE.danger;
        ctx.beginPath();
        ctx.arc(sx(spike.pos.x), sz(spike.pos.z), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const b of bots) {
        if (!b.alive) continue;
        ctx.fillStyle = b.team === 'raiders' ? PALETTE.raider : PALETTE.warden;
        ctx.beginPath();
        ctx.arc(sx(b.move.x), sz(b.move.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (player.alive) {
        ctx.fillStyle = '#ffffff';
        ctx.save();
        ctx.translate(sx(player.move.x), sz(player.move.z));
        ctx.rotate(-player.yaw);
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
