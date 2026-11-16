// Depot 12: the map. A 56 x 44 m industrial yard with three lanes, two plant
// sites and cover worth fighting over. Every box is a collider for movement and
// a surface bullets stop on. Waypoints form the graph bots route on.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

const SITES = {
  A: { letter: 'A', name: 'Warehouse', x: -19, z: -15, r: 5.2 },
  B: { letter: 'B', name: 'Rail Yard', x: 19, z: -15, r: 5.2 },
};

// Waypoint graph: lane junctions, corners, site approaches and spawns.
const WAYPOINTS = [
  [-24, 16], [-16, 16], [-8, 16], [0, 17], [8, 16], [16, 16], [24, 16],
  [-24, 8], [-16, 8], [-8, 8], [0, 8], [8, 8], [16, 8], [24, 8],
  [-24, 0], [-14, 0], [-5, 0], [5, 0], [14, 0], [24, 0],
  [-24, -8], [-14, -8], [-5, -8], [5, -8], [14, -8], [24, -8],
  [-19, -14], [-12, -14], [-24, -14], [-8, -14],
  [19, -14], [12, -14], [24, -14], [8, -14],
  [-19, -19], [0, -19], [19, -19],
  [-2, -4], [2, -4],
];

const RAIDER_SPAWNS = [[-6, 19], [-3, 19.5], [0, 19], [3, 19.5], [6, 19]];
const WARDEN_SPAWNS = [[-6, -19.5], [-3, -19], [0, -19.5], [3, -19], [6, -19.5]];

export function createWorld(scene) {
  const textures = createTextures();
  const group = new THREE.Group();
  scene.add(group);

  const mat = {
    ground: new THREE.MeshStandardMaterial({ map: textures.ground, roughness: 0.95, metalness: 0.02 }),
    concrete: new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.92, metalness: 0.03 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: PALETTE.concreteDark, roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ map: textures.steel, roughness: 0.6, metalness: 0.35 }),
    rust: new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.8, metalness: 0.15 }),
    rustLight: new THREE.MeshStandardMaterial({ color: PALETTE.rustLight, roughness: 0.75, metalness: 0.2 }),
    crate: new THREE.MeshStandardMaterial({ map: textures.crate, roughness: 0.9, metalness: 0.02 }),
    hazard: new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.85 }),
  };

  const colliders = [];
  const shootables = [];
  const footprints = [];

  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      const c = new THREE.Box3().setFromObject(mesh);
      colliders.push(c);
      footprints.push({ minX: c.min.x, maxX: c.max.x, minZ: c.min.z, maxZ: c.max.z, top: c.max.y });
    }
    shootables.push(mesh);
    return mesh;
  }

  // Floor and the sky dome.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(56, 44), mat.ground);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Perimeter walls, 4.5 m high.
  box(56.8, 4.5, 0.6, 0, 2.25, -22.3, 'concrete');
  box(56.8, 4.5, 0.6, 0, 2.25, 22.3, 'concrete');
  box(0.6, 4.5, 44, -28.3, 2.25, 0, 'concrete');
  box(0.6, 4.5, 44, 28.3, 2.25, 0, 'concrete');

  // Site A warehouse: back wall, side wall, roof pillars and a jumpable platform.
  box(14, 4.5, 0.6, -19, 2.25, -21.4, 'steel');
  box(0.6, 4.5, 10, -26.4, 2.25, -15, 'steel');
  box(1.0, 4.5, 1.0, -13, 2.25, -20.5, 'rust');
  box(1.0, 4.5, 1.0, -25, 2.25, -20.5, 'rust');
  box(6, 0.9, 4, -19, 0.45, -19, 'concreteDark');
  box(2.4, 1.1, 1.2, -14.5, 0.55, -12, 'crate');
  box(1.2, 1.1, 1.2, -23.5, 0.55, -11.5, 'crate');
  box(6, 2.6, 2.4, -22, 1.3, -17.5, 'rustLight');

  // Site B rail yard: boxcar, rails and stacked crates.
  box(14, 4.5, 0.6, 19, 2.25, -21.4, 'steel');
  box(0.6, 4.5, 10, 26.4, 2.25, -15, 'steel');
  box(7, 2.6, 2.6, 21, 1.3, -18.5, 'steel');
  box(2.4, 1.1, 1.2, 14.5, 0.55, -12, 'crate');
  box(1.2, 1.1, 2.4, 23.5, 0.55, -11.5, 'crate');
  box(1.2, 2.2, 1.2, 16, 1.1, -18, 'crate');
  // Rails: thin dark strips, visual only.
  for (const z of [-16.4, -15.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.22), mat.steelDark);
    rail.position.set(19, 0.04, z);
    rail.receiveShadow = true;
    group.add(rail);
  }

  // Mid: container canyon with two lanes through it.
  box(6, 2.6, 2.4, -4, 1.3, -4, 'rust');
  box(6, 2.6, 2.4, 4, 1.3, 4, 'steel');
  box(2.4, 2.6, 6, -1, 1.3, 0, 'rustLight');
  box(1.2, 1.1, 1.2, -7, 0.55, -2, 'crate');
  box(1.2, 1.1, 1.2, 7, 0.55, 2, 'crate');
  box(2.4, 1.1, 1.2, 0, 0.55, -7.5, 'crate');
  box(2.4, 1.1, 1.2, 0, 0.55, 7.5, 'crate');

  // Lane cover: crates and low walls so every lane has a fight in it.
  box(2.4, 1.1, 1.2, -20, 0.55, 8, 'crate');
  box(2.4, 1.1, 1.2, -20, 0.55, -2, 'crate');
  box(1.2, 1.1, 2.4, -24, 0.55, 2, 'crate');
  box(3, 1.2, 0.6, -16, 0.6, 12, 'concreteDark');
  box(2.4, 1.1, 1.2, 20, 0.55, 8, 'crate');
  box(2.4, 1.1, 1.2, 20, 0.55, -2, 'crate');
  box(1.2, 1.1, 2.4, 24, 0.55, 2, 'crate');
  box(3, 1.2, 0.6, 16, 0.6, 12, 'concreteDark');
  box(2.4, 1.1, 1.2, -10, 0.55, 12, 'crate');
  box(2.4, 1.1, 1.2, 10, 0.55, 12, 'crate');
  box(4, 1.2, 0.6, 0, 0.6, -12, 'concreteDark');
  box(1.2, 2.2, 1.2, -8, 1.1, -12, 'crate');
  box(1.2, 2.2, 1.2, 8, 1.1, -12, 'crate');

  // Site markers: hazard floor strips and a big letter on the ground.
  for (const key of Object.keys(SITES)) {
    const s = SITES[key];
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 2, 0.5), mat.hazard);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(s.x, 0.02, s.z - s.r);
    strip.receiveShadow = true;
    group.add(strip);
    const letter = makeLetterSprite(key, key === 'A' ? PALETTE.raider : PALETTE.warden);
    letter.position.set(s.x, 2.6, s.z);
    group.add(letter);
  }

  // Lighting: low amber sun, cool sky fill, warm bounce from the south.
  const skyLight = new THREE.HemisphereLight(new THREE.Color('#8fa3c0'), new THREE.Color('#3a3128'), 1.05);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb45e'), 2.8);
  sun.position.set(-24, 26, 18);
  sun.target.position.set(4, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5a6b8a'), 0.65);
  fill.position.set(20, 12, -14);
  scene.add(fill);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 42, 110);

  // Waypoint graph: link nodes within 11 m when the straight walk is clear.
  const nodes = WAYPOINTS.map(([x, z]) => ({ x, z, links: [] }));
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 11 || dist < 0.01) continue;
      if (segmentBlocked(a.x, a.z, b.x, b.z)) continue;
      a.links.push(j);
      b.links.push(i);
    }
  }

  function segmentBlocked(x1, z1, x2, z2) {
    for (const f of footprints) {
      if (f.top > 1.6) continue; // tall cover blocks sight, not feet: walk around it
      if (segmentsCrossBox(x1, z1, x2, z2, f)) return true;
    }
    return false;
  }

  function segmentsCrossBox(x1, z1, x2, z2, f) {
    // 2D segment vs AABB, with a 0.45 m margin for a body.
    const m = 0.45;
    const minX = f.minX - m;
    const maxX = f.maxX + m;
    const minZ = f.minZ - m;
    const maxZ = f.maxZ + m;
    const dx = x2 - x1;
    const dz = z2 - z1;
    // Slab method, written plainly.
    let tmin = 0;
    let tmax = 1;
    const axes = [
      { d: dx, o: x1, lo: minX, hi: maxX },
      { d: dz, o: z1, lo: minZ, hi: maxZ },
    ];
    for (const ax of axes) {
      if (Math.abs(ax.d) < 1e-9) {
        if (ax.o < ax.lo || ax.o > ax.hi) return false;
      } else {
        let ta = (ax.lo - ax.o) / ax.d;
        let tb = (ax.hi - ax.o) / ax.d;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        tmin = Math.max(tmin, ta);
        tmax = Math.min(tmax, tb);
        if (tmin > tmax) return false;
      }
    }
    return tmin <= 1 && tmax >= 0 && tmin <= tmax;
  }

  // BFS shortest path on the waypoint graph.
  function findPath(fromX, fromZ, toX, toZ) {
    let start = -1;
    let goal = -1;
    let bestStart = Infinity;
    let bestGoal = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const dStart = Math.hypot(nodes[i].x - fromX, nodes[i].z - fromZ);
      const dGoal = Math.hypot(nodes[i].x - toX, nodes[i].z - toZ);
      if (dStart < bestStart) { bestStart = dStart; start = i; }
      if (dGoal < bestGoal) { bestGoal = dGoal; goal = i; }
    }
    if (start === -1 || goal === -1) return [{ x: toX, z: toZ }];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [start];
    prev[start] = start;
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      for (const next of nodes[cur].links) {
        if (prev[next] === -1) {
          prev[next] = cur;
          queue.push(next);
        }
      }
    }
    if (prev[goal] === -1) return [{ x: toX, z: toZ }];
    const path = [];
    let cur = goal;
    while (cur !== start) {
      path.unshift({ x: nodes[cur].x, z: nodes[cur].z });
      cur = prev[cur];
    }
    path.push({ x: toX, z: toZ });
    return path;
  }

  return {
    colliders,
    shootables,
    footprints,
    sites: SITES,
    nodes,
    findPath,
    raiderSpawns: RAIDER_SPAWNS,
    wardenSpawns: WARDEN_SPAWNS,
    group,
  };
}

function makeLetterSprite(letter, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,22,26,0.55)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(3.2, 3.2, 1);
  return sprite;
}
