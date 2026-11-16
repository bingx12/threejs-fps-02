// Procedural textures, drawn once on 2D canvases: no image files, no network.
// Concrete with speckle, corrugated steel, hazard chevrons, crate planks and a
// dusk sky gradient. Each is a THREE.CanvasTexture, reused by every mesh.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, base, flecks, count, rng) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i += 1) {
    const shade = flecks[Math.floor(rng() * flecks.length)];
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.08 + rng() * 0.16;
    const s = 1 + rng() * 3;
    ctx.fillRect(rng() * size, rng() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTextures() {
  const out = {};

  // Concrete floor: warm grey with speckle and faint expansion joints.
  {
    const [c, ctx] = canvas(512);
    const rng = mulberry32(11);
    speckle(ctx, 512, PALETTE.ground, ['#2e2e2c', '#4c4c48', '#555550'], 5200, rng);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 8);
    t.colorSpace = THREE.SRGBColorSpace;
    out.ground = t;
  }

  // Corrugated steel for containers and walls: vertical ribs with rust streaks.
  {
    const [c, ctx] = canvas(256);
    const rng = mulberry32(23);
    speckle(ctx, 256, PALETTE.steel, ['#39424c', '#5a6673', '#2c343d'], 2600, rng);
    for (let x = 0; x < 256; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 5, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + 8, 0, 3, 256);
    }
    for (let i = 0; i < 26; i += 1) {
      ctx.fillStyle = 'rgba(138,74,43,0.25)';
      const x = rng() * 256;
      ctx.fillRect(x, rng() * 80, 2 + rng() * 3, 60 + rng() * 160);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    out.steel = t;
  }

  // Crate planks: horizontal boards with gaps and stencilled numbers.
  {
    const [c, ctx] = canvas(256);
    const rng = mulberry32(37);
    speckle(ctx, 256, PALETTE.crate, ['#54452a', '#7d6a3e', '#3e331e'], 1800, rng);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    for (let y = 0; y <= 256; y += 42) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,228,216,0.5)';
    ctx.font = 'bold 44px monospace';
    ctx.fillText('12', 96, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    out.crate = t;
  }

  // Hazard chevrons for site markers and platform edges.
  {
    const [c, ctx] = canvas(256);
    ctx.fillStyle = PALETTE.hazard;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#17181a';
    for (let x = -256; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 256); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 64, 0); ctx.lineTo(x + 32, 256);
      ctx.closePath(); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    out.hazard = t;
  }

  // Dusk sky: vertical gradient, deep slate up top to burnt amber at the horizon.
  {
    const [c, ctx] = canvas(512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#101623');
    g.addColorStop(0.55, '#232c3d');
    g.addColorStop(0.82, '#6b4a33');
    g.addColorStop(1, '#c07a35');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const rng = mulberry32(91);
    ctx.fillStyle = 'rgba(240,168,48,0.9)';
    ctx.beginPath(); ctx.arc(256, 430, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(240,168,48,0.25)';
    ctx.beginPath(); ctx.arc(256, 430, 60, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.3})`;
      ctx.fillRect(rng() * 512, rng() * 220, 1.5, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    out.sky = t;
  }

  return out;
}
