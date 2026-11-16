// Weapons: the numbers, the state machine and the view models. Hitscan guns:
// a shot spends a round, rolls spread and recoil, and main.js resolves the ray.
// One grenade, the Spark, blinds what looks at it. Bots use the same state.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 Vulture', price: 0, auto: false, mag: 12, reserve: 48,
    damage: 26, headMult: 4, legMult: 0.75, rate: 0.16, reload: 1.2,
    spreadStill: 0.004, spreadMove: 0.03, kick: 0.011, zoom: 1.15, range: 60,
  },
  vk9: {
    id: 'vk9', name: 'VK-9 Rattler', price: 900, auto: true, mag: 25, reserve: 100,
    damage: 22, headMult: 4, legMult: 0.75, rate: 0.08, reload: 1.8,
    spreadStill: 0.006, spreadMove: 0.036, kick: 0.009, zoom: 1.2, range: 55,
  },
  ar77: {
    id: 'ar77', name: 'AR-77 Longshot', price: 2700, auto: true, mag: 30, reserve: 90,
    damage: 30, headMult: 4, legMult: 0.75, rate: 0.1, reload: 2.1,
    spreadStill: 0.003, spreadMove: 0.03, kick: 0.013, zoom: 1.35, range: 80,
  },
  dmr12: {
    id: 'dmr12', name: 'DMR-12 Warden', price: 4200, auto: false, mag: 10, reserve: 30,
    damage: 78, headMult: 4, legMult: 0.75, rate: 0.55, reload: 2.6,
    spreadStill: 0.0012, spreadMove: 0.02, kick: 0.03, zoom: 2.4, range: 120,
  },
};

export const GRENADE = { id: 'spark', name: 'Spark grenade', price: 300 };

export function createWeaponState(id) {
  const def = WEAPONS[id];
  return {
    def, mag: def.mag, reserve: def.reserve, cooldown: 0, reloadLeft: 0,
    bloom: 0,
  };
}

export function weaponStep(state, dt) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.bloom = Math.max(0, state.bloom - dt * 0.09);
  if (state.reloadLeft > 0) {
    state.reloadLeft = Math.max(0, state.reloadLeft - dt);
    if (state.reloadLeft === 0) {
      const need = state.def.mag - state.mag;
      const take = Math.min(need, state.reserve);
      state.mag += take;
      state.reserve -= take;
    }
  }
}

export function weaponReady(state) {
  return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
}

export function weaponFire(state) {
  if (!weaponReady(state)) return false;
  state.mag -= 1;
  state.cooldown = state.def.rate;
  state.bloom = Math.min(0.05, state.bloom + state.def.rate * 0.09);
  return true;
}

export function weaponReload(state) {
  if (state.reloadLeft > 0 || state.mag === state.def.mag || state.reserve === 0) return false;
  state.reloadLeft = state.def.reload;
  return true;
}

export function weaponSpread(state, speed, crouched, aiming) {
  const base = state.def.spreadStill + Math.min(1, speed / 5.4) * state.def.spreadMove;
  let spread = base + state.bloom;
  if (crouched) spread *= 0.75;
  if (aiming) spread *= 0.55;
  return spread;
}

// The player's view model: one box-built gun per weapon, a muzzle flash and a
// light. Only the equipped gun is visible; kick and reload are animated here.
export function createViewModel(camera) {
  const dark = new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, roughness: 0.55, metalness: 0.4 });
  const mid = new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.5, metalness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.7, metalness: 0.1 });
  const accent = new THREE.MeshStandardMaterial({ color: PALETTE.accent, roughness: 0.5, metalness: 0.3 });

  function buildGun(kind) {
    const g = new THREE.Group();
    const add = (w, h, d, x, y, z, material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    if (kind === 'p9') {
      add(0.07, 0.09, 0.3, 0, 0, -0.1, mid);
      add(0.06, 0.12, 0.09, 0, -0.09, 0.05, dark);
      add(0.05, 0.03, 0.05, 0, 0.06, -0.24, accent);
    } else if (kind === 'vk9') {
      add(0.08, 0.09, 0.42, 0, 0, -0.12, mid);
      add(0.05, 0.05, 0.3, 0, 0.02, -0.4, dark);
      add(0.07, 0.14, 0.1, 0, -0.1, 0.02, wood);
      add(0.05, 0.1, 0.06, 0, -0.04, -0.2, dark);
    } else if (kind === 'ar77') {
      add(0.09, 0.1, 0.46, 0, 0, -0.14, mid);
      add(0.045, 0.045, 0.42, 0, 0.025, -0.5, dark);
      add(0.06, 0.07, 0.18, 0, -0.02, 0.16, dark);
      add(0.05, 0.12, 0.08, 0, -0.1, 0, dark);
      add(0.06, 0.04, 0.12, 0, 0.07, -0.1, dark);
    } else {
      add(0.09, 0.11, 0.6, 0, 0, -0.18, mid);
      add(0.05, 0.05, 0.5, 0, 0.03, -0.62, dark);
      add(0.06, 0.07, 0.18, 0, -0.02, 0.2, dark);
      add(0.07, 0.05, 0.16, 0, 0.08, -0.2, dark);
      add(0.05, 0.12, 0.08, 0, -0.11, 0.02, dark);
    }
    g.position.set(0.24, -0.24, -0.52);
    g.scale.setScalar(0.85);
    g.visible = false;
    camera.add(g);
    return g;
  }

  const guns = { p9: buildGun('p9'), vk9: buildGun('vk9'), ar77: buildGun('ar77'), dmr12: buildGun('dmr12') };
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.2, -1.05);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.24, -0.18, -0.7);
  camera.add(flashLight);

  let current = 'p9';
  let kick = 0;
  let flashLeft = 0;
  let reloadPhase = 0;
  let ads = 0;
  guns.p9.visible = true;

  const muzzle = new THREE.Vector3();
  return {
    equip(id) {
      if (!guns[id]) return;
      guns[current].visible = false;
      current = id;
      guns[current].visible = true;
      kick = 0;
      reloadPhase = 0;
    },
    fire() {
      kick = 0.06;
      flashLeft = 0.06;
    },
    step(dt, reloading, aiming) {
      kick += (0 - kick) * Math.min(1, dt * 13);
      flashLeft = Math.max(0, flashLeft - dt);
      const g = guns[current];
      g.position.z = -0.52 + kick;
      g.rotation.x = kick * 2.4;
      ads += ((aiming ? 1 : 0) - ads) * Math.min(1, dt * 14);
      g.position.x = 0.24 - ads * 0.24;
      g.position.y = -0.24 + ads * 0.05;
      if (reloading) {
        reloadPhase = Math.min(1, reloadPhase + dt * 1.4);
        g.rotation.x = -0.5 * Math.sin(reloadPhase * Math.PI);
      } else if (reloadPhase > 0) {
        reloadPhase = 0;
        g.rotation.x = kick * 2.4;
      }
      flash.visible = flashLeft > 0;
      if (flashLeft > 0) flash.rotation.z = flashLeft * 40;
      flashLight.intensity = flashLeft > 0 ? 16 : 0;
    },
    muzzleWorld(out) {
      guns[current].updateWorldMatrix(true, false);
      out.set(0.24, -0.19, -1.05);
      return camera.localToWorld(out);
    },
  };
}

// Tracers: a pool of fading lines, reused so a firefight allocates nothing.
export function createTracers(scene) {
  const pool = [];
  const mat = new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 24; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, mat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    pool.push({ line, life: 0 });
  }
  let next = 0;
  return {
    spawn(from, to) {
      const t = pool[next];
      next = (next + 1) % pool.length;
      const pos = t.line.geometry.attributes.position.array;
      pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
      pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.visible = true;
      t.line.material.opacity = 0.85;
      t.life = 0.12;
    },
    step(dt) {
      for (const t of pool) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
        else t.line.material.opacity = Math.max(0, (t.life / 0.12) * 0.85);
      }
    },
  };
}

// Thrown Spark grenades: a small ball with gravity and a bounce, then a flash.
// onDetonate(pos) is called once; the match decides who is blinded.
export function createGrenades(scene, colliders) {
  const geo = new THREE.SphereGeometry(0.07, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.accent, roughness: 0.4, metalness: 0.5, emissive: PALETTE.accent, emissiveIntensity: 0.4 });
  const items = [];
  const probe = new THREE.Box3();
  return {
    throw(from, dir, onDetonate) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from);
      scene.add(mesh);
      items.push({ mesh, vx: dir.x * 13, vy: dir.y * 13 + 3.5, vz: dir.z * 13, fuse: 1.3, onDetonate });
    },
    step(dt) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const g = items[i];
        g.vy -= 16 * dt;
        g.mesh.position.x += g.vx * dt;
        g.mesh.position.y += g.vy * dt;
        g.mesh.position.z += g.vz * dt;
        const p = g.mesh.position;
        probe.min.set(p.x - 0.07, p.y - 0.07, p.z - 0.07);
        probe.max.set(p.x + 0.07, p.y + 0.07, p.z + 0.07);
        for (const c of colliders) {
          if (probe.intersectsBox(c)) {
            if (p.x < c.min.x || p.x > c.max.x) g.vx *= -0.4;
            if (p.z < c.min.z || p.z > c.max.z) g.vz *= -0.4;
            if (p.y < c.min.y || p.y > c.max.y) g.vy = Math.abs(g.vy) * 0.4;
            p.y = Math.max(p.y, c.max.y + 0.07);
          }
        }
        if (p.y < 0.07) { p.y = 0.07; g.vy = Math.abs(g.vy) * 0.35; g.vx *= 0.7; g.vz *= 0.7; }
        g.fuse -= dt;
        if (g.fuse <= 0) {
          scene.remove(g.mesh);
          items.splice(i, 1);
          g.onDetonate(p.clone());
        }
      }
    },
  };
}
