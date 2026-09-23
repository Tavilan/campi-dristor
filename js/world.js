// Builds the 3D Dristor from assets/map.json (converted from OpenStreetMap).
import * as THREE from 'three';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// ---------- Facade textures: one tile = 2 windows wide x 1 floor high (6.4m x 2.9m)
const PATCH = ['#f2c6a0', '#b7d7c9', '#f0e08a', '#e8b4b8', '#a9c4e0', '#f4f1e8', '#d8b4e2', '#ffd9a0'];
function facadeAtlas(variant) {
  // atlas: 8 columns x 8 rows of random tiles; UVs wrap across it so the pattern looks irregular
  const TW = 128, TH = 64, C = 8, Rr = 8;
  return canvasTex(TW * C, TH * Rr, (g) => {
    const wall = ['#ddd2bb', '#cfc7ba', '#e5dac4', '#d4c8ae'][variant % 4];
    for (let r = 0; r < Rr; r++) for (let c = 0; c < C; c++) {
      const x = c * TW, y = r * TH;
      g.fillStyle = Math.random() < 0.22 ? pick(PATCH) : wall; g.fillRect(x, y, TW, TH);
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, y + TH - 2, TW, 2); if (c % 2 === 0) g.fillRect(x, y, 2, TH);
      const balcony = (variant + c) % 3 === 0;
      if (balcony) {
        const closed = Math.random() < 0.72;
        if (closed) {
          g.fillStyle = pick(['#f6f6f2', '#f6f6f2', '#7a4e2d', '#6f7f88', '#9ad0b0', '#c9c9c0']); g.fillRect(x + 6, y + 8, TW - 12, TH - 10);
          g.fillStyle = Math.random() < .25 ? '#ffe7a0' : '#5d7a93'; for (let k = 0; k < 4; k++) g.fillRect(x + 11 + k * 28, y + 12, 24, 22);
          g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 6, y + 38, TW - 12, 3);
        } else {
          g.fillStyle = '#4a4744'; g.fillRect(x + 6, y + 6, TW - 12, TH - 10);
          g.fillStyle = '#8c8680'; g.fillRect(x + 6, y + 34, TW - 12, TH - 38);
          if (Math.random() < .55) { g.strokeStyle = '#222'; g.beginPath(); g.moveTo(x + 10, y + 14); g.lineTo(x + TW - 10, y + 14); g.stroke();
            for (let k = 0; k < 6; k++) { g.fillStyle = pick(['#e33', '#39f', '#fff', '#fc0', '#6c6', '#f6a']); g.fillRect(x + 14 + k * 17, y + 14, 10, 12 + Math.random() * 8); } }
        }
      } else {
        for (const wx of [x + 14, x + 72]) {
          g.fillStyle = '#ebe7de'; g.fillRect(wx, y + 12, 42, 40);
          g.fillStyle = Math.random() < .22 ? '#ffe28a' : '#56718a'; g.fillRect(wx + 3, y + 15, 36, 34);
          g.fillStyle = '#ebe7de'; g.fillRect(wx + 20, y + 15, 2, 34);
          if (Math.random() < .2) { g.fillStyle = '#f2f2f2'; g.fillRect(wx - 6, y + 44, 20, 13); g.fillStyle = '#999'; g.fillRect(wx - 3, y + 47, 14, 2); g.fillRect(wx - 3, y + 51, 14, 2); }
          if (Math.random() < .08) { g.fillStyle = '#e6e6e6'; g.beginPath(); g.ellipse(wx + 38, y + 18, 8, 10, -.4, 0, 7); g.fill(); }
        }
      }
      // grime
      const gr = g.createLinearGradient(0, y, 0, y + TH); gr.addColorStop(0, 'rgba(70,60,50,0)'); gr.addColorStop(1, 'rgba(70,60,50,.08)');
      g.fillStyle = gr; g.fillRect(x, y, TW, TH);
    }
  });
}
const garageTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2; i++) {
    const x = i * 128 + 10; g.fillStyle = pick(['#6b7f5a', '#8a5a3a', '#5a6a8a', '#999', '#a33']); g.fillRect(x, 30, 108, 98);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 36; y < 128; y += 9) g.fillRect(x, y, 108, 2);
    g.fillStyle = 'rgba(120,60,20,.35)'; g.fillRect(x + Math.random() * 60, 60 + Math.random() * 40, 30, 20);
  }
  g.fillStyle = '#e0245e'; g.font = 'italic 900 22px sans-serif'; g.fillText(pick(['NU PARCAȚI', 'CÂMPI 67', 'VÂND', 'OCUPAT']), 20, 22);
});
garageTex.wrapS = garageTex.wrapT = THREE.RepeatWrapping;

// ---------- Shop signs (generic names, no real brands)
const SIGN = {
  fast_food: ['SHAORMA', 'CU DE TOATE · NON-STOP', '#d7263d', '#ffd23f'], restaurant: ['RESTAURANT', 'MICI · BERE · MANELE', '#8b1e1e', '#fff'],
  pharmacy: ['FARMACIE', '', '#1f9d55', '#fff', 1], chemist: ['FARMACIE', 'NON-STOP', '#18a0d8', '#fff', 1],
  pawnbroker: ['AMANET', 'AUR · TELEFOANE · 24/24', '#111', '#ffd23f'], money_lender: ['AMANET', 'CUMPĂRĂM ORICE', '#ffd23f', '#111'],
  bookmaker: ['PARIURI', 'PONTUL ZILEI: 6-7', '#0b3d91', '#fff'], lottery: ['LOTO', '6 DIN 49', '#0b7d3b', '#fff'],
  gambling: ['PĂCĂNELE', 'JACKPOT 67.000', '#5b1fa8', '#ff5fe0'], casino: ['CASINO', 'SLOTS · RULETĂ', '#1a1a1a', '#ff2d55'],
  convenience: ['NON-STOP', 'ALIMENTARA', '#f28c28', '#fff'], supermarket: ['SUPERMARKET', 'OFERTE', '#c8102e', '#fff'],
  bakery: ['PATISERIE', 'COVRIGI CALZI', '#8b5a2b', '#ffe7b0'], cafe: ['CAFENEA', 'ESPRESSO 6,7 LEI', '#3b2a1a', '#ffd23f'],
  bar: ['BAR', 'BERE LA HALBĂ', '#3b2a1a', '#ffd23f'], pub: ['BAR', 'LA MOO DENG', '#3b2a1a', '#ffd23f'],
  hairdresser: ['FRIZERIE', 'TUNS 67 LEI', '#c0392b', '#fff'], bank: ['BANCĂ', 'CREDITE RAPIDE', '#0a4a7a', '#fff'],
  mobile_phone: ['TELEFOANE', 'SH · SERVICE', '#e6007e', '#fff'], butcher: ['MĂCELĂRIE', 'MICI · CÂRNAȚI', '#9b1d20', '#fff'],
  alcohol: ['BĂUTURI', 'NON-STOP', '#5c0f2e', '#ffd23f'], clothes: ['HAINE', 'SECOND HAND', '#555', '#fff'],
  kiosk: ['CHIOȘC', 'ZIARE · ȚIGĂRI', '#ffd23f', '#111'], florist: ['FLORI', '', '#e2336b', '#fff'],
  greengrocer: ['LEGUME', 'FRUCTE', '#2e7d32', '#fff'], optician: ['OPTICĂ', 'OCHELARI', '#2c3e50', '#fff'],
  fuel: ['BENZINĂRIE', 'CAFEA · HOT-DOG', '#2c3e50', '#ffd23f'], dentist: ['DENTIST', 'FĂRĂ DURERE (ZICE)', '#fff', '#1a6fb3'],
  default: ['MAGAZIN', 'MIXT', '#6d6d6d', '#fff'],
};
const signCache = {};
export function signMaterial(kind) {
  const key = SIGN[kind] ? kind : 'default';
  if (signCache[key]) return signCache[key];
  const [t, s, bg, fg, cross] = SIGN[key];
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    g.font = '900 62px Trebuchet MS, sans-serif'; g.fillText(t, w / 2 + (cross ? 36 : 0), s ? 48 : 66, w - 110);
    if (s) { g.font = 'bold 26px Trebuchet MS, sans-serif'; g.fillText(s, w / 2 + (cross ? 36 : 0), 100, w - 110); }
    if (cross) { g.fillStyle = fg; g.fillRect(52, 22, 22, 84); g.fillRect(21, 53, 84, 22); }
  });
  return (signCache[key] = new THREE.MeshStandardMaterial({ map: tex, emissive: '#fff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.5 }));
}

// ---------- Geometry helpers
function pushQuad(pos, uv, col, a, b, c, d, ua, ub, uc, ud, color) {
  // a,b,c,d are [x,y,z]; two triangles a-b-c, a-c-d
  for (const [p, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) { pos.push(...p); uv.push(...u); col.push(...color); }
}
function geo(pos, uv, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const tmpC = new THREE.Color();
function colorArr(hex, jitter = 0) { tmpC.set(hex); if (jitter) tmpC.offsetHSL(0, 0, (Math.random() - .5) * jitter); return [tmpC.r, tmpC.g, tmpC.b]; }

// ---------- Collision grid (building footprints as polygons)
export class Collider {
  constructor(cell = 24) { this.cell = cell; this.grid = new Map(); this.polys = []; }
  key(ix, iz) { return ix * 100000 + iz; }
  add(pts, data) {
    const id = this.polys.length; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    this.polys.push({ pts, data, box: [x0, z0, x1, z1] });
    for (let ix = Math.floor(x0 / this.cell); ix <= Math.floor(x1 / this.cell); ix++)
      for (let iz = Math.floor(z0 / this.cell); iz <= Math.floor(z1 / this.cell); iz++) {
        const k = this.key(ix, iz); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(id);
      }
  }
  near(x, z) {
    const ids = this.grid.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    return ids ? ids.map(i => this.polys[i]) : [];
  }
  static inside(pts, x, z) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  }
  // push a circle (x,z,r) out of any polygon; returns corrected [x,z]
  resolve(x, z, r, maxH = Infinity, y = 0) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const p of this.near(x, z)) {
        if (p.data && p.data.h !== undefined && y > p.data.h) continue;   // above a low roof (garages): walk on top
        const [bx0, bz0, bx1, bz1] = p.box;
        if (x < bx0 - r || x > bx1 + r || z < bz0 - r || z > bz1 + r) continue;
        const pts = p.pts, ins = Collider.inside(pts, x, z);
        let best = 1e9, bx = 0, bz = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, az] = pts[j], [cx, cz] = pts[i];
          const ex = cx - ax, ez = cz - az, L2 = ex * ex + ez * ez || 1;
          let t = ((x - ax) * ex + (z - az) * ez) / L2; t = Math.max(0, Math.min(1, t));
          const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
          if (d < best) { best = d; bx = px; bz = pz; }
        }
        if (ins || best < r) {
          let nx = x - bx, nz = z - bz, L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
          if (ins) { nx = -nx; nz = -nz; }
          const push = ins ? best + r : r - best;
          x += nx * push; z += nz * push; moved = true;
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }
  // height of roof under point (for garages you can climb), else 0
  groundAt(x, z, y) {
    let g = 0;
    for (const p of this.near(x, z)) if (p.data && p.data.walkable && p.data.h <= y + 0.6 && Collider.inside(p.pts, x, z)) g = Math.max(g, p.data.h);
    return g;
  }
}

// ---------- Build the world
export async function buildWorld(scene, url = 'assets/map.json') {
  const M = await (await fetch(url)).json();
  const D = (a) => a.map(([x, z]) => [x / 10, z / 10]);
  const collider = new Collider();
  const world = new THREE.Group(); scene.add(world);
  const R = M.radius;

  // Ground
  const groundTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a9a48f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = pick(['#9c9782', '#b3ae98', '#8f9a6e', '#a29d86']); g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }, [R / 6, R / 6]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 400, 64), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);

  // Areas (parks, water, parking, markets...)
  const AREA_COL = { park: '#6fae4f', grass: '#86b85e', play: '#c9a27a', pitch: '#4f9a4a', water: '#4d8fb5', parking: '#6d6a66', market: '#b8a991', retail: '#a8a39a', garages: '#8f8a80', school: '#b9ad8f', rail: '#8b8176', construction: '#b39b76' };
  const AREA_Y = { water: 0.03, park: 0.05, grass: 0.05, play: 0.06, pitch: 0.07, parking: 0.04, market: 0.045, retail: 0.035, garages: 0.035, school: 0.035, rail: 0.035, construction: 0.04 };
  { const pos = [], col = [];
    for (const a of M.areas) {
      const pts = D(a.p); if (pts.length < 3) continue;
      const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { continue; }
      const y = AREA_Y[a.k] ?? 0.03, c = colorArr(AREA_COL[a.k] || '#999', 0.04);
      for (const t of tris) for (const i of [t[0], t[2], t[1]]) { pos.push(contour[i].x, y, contour[i].y); col.push(...c); }
      if (a.k === 'water') collider.add(pts, { water: true });
    }
    const m = new THREE.Mesh(geo(pos, null, col), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    m.receiveShadow = true; world.add(m); }

  // Roads: sidewalk band + asphalt ribbon + round joints + lane markings
  { const pos = [], col = [], mpos = [];
    const ASPH = { primary: '#4a4a4f', trunk: '#4a4a4f', secondary: '#4f4f54', tertiary: '#55555a', residential: '#5d5b5c', service: '#66635f', living_street: '#66635f',
      footway: '#b3aca0', path: '#a89f8a', pedestrian: '#b8b0a2', cycleway: '#8a5a50', steps: '#aaa' };
    const band = (pts, w, y, c) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; let dx = x2 - x1, dz = z2 - z1; const L = Math.hypot(dx, dz) || 1; const nx = -dz / L * w / 2, nz = dx / L * w / 2;
        pos.push(x1 + nx, y, z1 + nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz, x1 + nx, y, z1 + nz, x2 - nx, y, z2 - nz, x1 - nx, y, z1 - nz);
        for (let k = 0; k < 6; k++) col.push(...c);
      }
      for (let pi = 1; pi < pts.length - 1; pi++) { const [x, z] = pts[pi]; // joint disc at bends
        const n = 6; for (let k = 0; k < n; k++) { const a1 = k / n * Math.PI * 2, a2 = (k + 1) / n * Math.PI * 2;
          pos.push(x, y, z, x + Math.cos(a2) * w / 2, y, z + Math.sin(a2) * w / 2, x + Math.cos(a1) * w / 2, y, z + Math.sin(a1) * w / 2); for (let j = 0; j < 3; j++) col.push(...c); }
      }
    };
    const order = ['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'service', 'living_street', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'trunk'];
    const sorted = [...M.roads].sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
    // sidewalks first (under everything)
    for (const r of sorted) if (r.w >= 7) band(D(r.p), r.w + 5, 0.06, colorArr('#a7a198'));
    sorted.forEach((r, i) => band(D(r.p), r.w, 0.08 + order.indexOf(r.k) * 0.004, colorArr(ASPH[r.k] || '#5d5b5c', 0.02)));
    // markings on big roads
    for (const r of M.roads) if (['primary', 'secondary', 'trunk', 'tertiary'].includes(r.k)) {
      const pts = D(r.p);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1); const ux = (x2 - x1) / L, uz = (z2 - z1) / L;
        const offs = r.w >= 14 ? [-r.w / 4, 0, r.w / 4] : [0];
        for (const off of offs) for (let s = 0; s < L - 3; s += 9) {
          const ox = -uz * off, oz = ux * off, ax = x1 + ux * s + ox, az = z1 + uz * s + oz, bx = ax + ux * 3, bz = az + uz * 3, hw = off === 0 && r.w >= 14 ? 0.18 : 0.1, nx = -uz * hw, nz = ux * hw;
          if (off === 0 && r.w >= 14) { mpos.push(ax + nx, .2, az + nz, x1 + ux * (s + 9) + ox + nx, .2, z1 + uz * (s + 9) + oz + nz, x1 + ux * (s + 9) + ox - nx, .2, z1 + uz * (s + 9) + oz - nz, ax + nx, .2, az + nz, x1 + ux * (s + 9) + ox - nx, .2, z1 + uz * (s + 9) + oz - nz, ax - nx, .2, az - nz); }
          else mpos.push(ax + nx, .2, az + nz, bx + nx, .2, bz + nz, bx - nx, .2, bz - nz, ax + nx, .2, az + nz, bx - nx, .2, bz - nz, ax - nx, .2, az - nz);
        }
      }
    }
    const rm = new THREE.Mesh(geo(pos, null, col), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
    rm.receiveShadow = true; world.add(rm);
    const mm = new THREE.Mesh(geo(mpos), new THREE.MeshBasicMaterial({ color: '#e8e4d8', side: THREE.DoubleSide })); world.add(mm);
    // tram rails
    const rp = [];
    for (const r of M.rails) { const pts = D(r.p); for (const off of [-0.72, 0.72]) for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1) || 1; const nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
      const a = [x1 + nx * off, z1 + nz * off], b = [x2 + nx * off, z2 + nz * off], w = .07;
      rp.push(a[0] + nx * w, .22, a[1] + nz * w, b[0] + nx * w, .22, b[1] + nz * w, b[0] - nx * w, .22, b[1] - nz * w, a[0] + nx * w, .22, a[1] + nz * w, b[0] - nx * w, .22, b[1] - nz * w, a[0] - nx * w, .22, a[1] - nz * w); } }
    if (rp.length) world.add(new THREE.Mesh(geo(rp), new THREE.MeshStandardMaterial({ color: '#8a8580', metalness: .8, roughness: .3 })));
  }

  // Buildings: extruded footprints. Facades use an atlas addressed in meters.
  const facadeMats = [0, 1, 2, 3].map(v => { const t = facadeAtlas(v); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.95 }); });
  const CH = 160, chunks = new Map();
  const chunkOf = (x, z) => { const k = Math.floor(x / CH) + ':' + Math.floor(z / CH); if (!chunks.has(k)) chunks.set(k, { buckets: facadeMats.map(() => ({ pos: [], uv: [], col: [] })), garage: { pos: [], uv: [], col: [] }, plain: { pos: [], uv: [], col: [] }, roof: { pos: [], col: [] } }); return chunks.get(k); };
  const WALLC = ['#ffffff', '#fff6e8', '#f2f2ff', '#fff0f0', '#f0fff4', '#fffbe0'];
  const signs = []; // later
  const buildingsOut = [];
  M.buildings.forEach((b, bi) => {
    const pts = D(b.p); const h = b.h; const n = pts.length;
    let cx0 = 0, cz0 = 0; for (const [x, z] of pts) { cx0 += x; cz0 += z; } const ch = chunkOf(cx0 / n, cz0 / n);
    const { buckets, garage, plain, roof } = ch;
    const isGarage = b.k === 'garage' || b.k === 'garages' || (h < 3.6 && b.l <= 1);
    const special = ['church', 'school', 'retail', 'commercial', 'kindergarten', 'industrial', 'warehouse', 'hospital', 'office', 'supermarket'].includes(b.k);
    const tgt = isGarage ? garage : special ? plain : buckets[bi % 4];
    const tint = colorArr(isGarage ? '#ffffff' : pick(WALLC));
    let per = hash(bi) * 64;
    for (let i = 0; i < n; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n]; const L = Math.hypot(x2 - x1, z2 - z1);
      // footprint is CCW in (x,z) with z south => outward normal is to the right; push quad wound for outward facing
      const u1 = per / (isGarage ? 8 : 6.4 * 8), u2 = (per + L) / (isGarage ? 8 : 6.4 * 8), v1 = 0, v2 = isGarage ? 1 : h / (2.9 * 8);
      pushQuad(tgt.pos, tgt.uv, tgt.col, [x1, 0, z1], [x1, h, z1], [x2, h, z2], [x2, 0, z2], [u1, v1], [u1, v2], [u2, v2], [u2, v1], tint);
      per += L;
    }
    // roof
    const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
    let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) {}
    const rc = colorArr(isGarage ? '#5a5652' : '#77726c', 0.06);
    for (const t of tris) for (const i of [t[0], t[2], t[1]]) { roof.pos.push(contour[i].x, h, contour[i].y); roof.col.push(...rc); }
    collider.add(pts, { h, walkable: isGarage, building: bi });
    buildingsOut.push({ pts, h, kind: b.k, name: b.n, shop: b.s, garage: isGarage });
  });
  const addMesh = (g, mat, shadow = true) => { if (!g.attributes.position.count) return; const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; world.add(m); return m; };
  // check winding once: if normals point inward, flip all wall buckets
  const garageMat = new THREE.MeshStandardMaterial({ map: garageTex, vertexColors: true, roughness: 1 });
  const plainMat = new THREE.MeshStandardMaterial({ color: '#d9d2c4', vertexColors: true, roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  for (const ch of chunks.values()) {
    ch.buckets.forEach((b, i) => b.pos.length && addMesh(geo(b.pos, b.uv, b.col), facadeMats[i]));
    if (ch.garage.pos.length) addMesh(geo(ch.garage.pos, ch.garage.uv, ch.garage.col), garageMat);
    if (ch.plain.pos.length) addMesh(geo(ch.plain.pos, ch.plain.uv, ch.plain.col), plainMat);
    if (ch.roof.pos.length) addMesh(geo(ch.roof.pos, null, ch.roof.col), roofMat, false);
  }

  // POIs: sign on the nearest wall of the nearest building
  const pois = M.pois.map(p => ({ ...p, x: p.x / 10, z: p.z / 10 }));
  const signGeo = new THREE.PlaneGeometry(1, 1);
  const SHOPLIKE = new Set([...Object.keys(SIGN), 'vacant', 'clothes', 'shoes', 'jewelry', 'cosmetics', 'beauty', 'perfumery', 'clinic', 'gift', 'books', 'hardware', 'furniture', 'electronics', 'car_repair', 'variety_store', 'pastry', 'tobacco', 'travel_agency', 'laundry', 'pet', 'toys']);
  function placeSign(p, kind) {
    if (!p.wall) return null;
    const w = p.wall, sw = Math.min(6, w.L * 0.8), s = new THREE.Mesh(signGeo, signMaterial(kind));
    s.scale.set(sw, sw / 4, 1);
    s.position.set(w.px + w.nx * 0.12, Math.min(3.6, w.h - 0.5), w.pz + w.nz * 0.12);
    s.lookAt(s.position.x + w.nx, s.position.y, s.position.z + w.nz);
    world.add(s); return s;
  }
  for (const p of pois) {
    if (!SHOPLIKE.has(p.k)) continue;
    let best = null;
    for (const poly of collider.near(p.x, p.z).concat(collider.near(p.x + 12, p.z), collider.near(p.x - 12, p.z), collider.near(p.x, p.z + 12), collider.near(p.x, p.z - 12))) {
      if (!poly.data || poly.data.building === undefined) continue;
      const pts = poly.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [ax, az] = pts[j], [cx, cz] = pts[i]; const ex = cx - ax, ez = cz - az, L2 = ex * ex + ez * ez; if (L2 < 16) continue;
        let t = ((p.x - ax) * ex + (p.z - az) * ez) / L2; t = Math.max(0.15, Math.min(0.85, t));
        const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(p.x - px, p.z - pz);
        if (!best || d < best.d) best = { d, px, pz, ex, ez, L: Math.sqrt(L2), h: poly.data.h };
      }
    }
    if (!best || best.d > 25) continue;
    const nx = best.ez / best.L, nz = -best.ex / best.L; // outward (right side of CCW edge)
    p.wall = { px: best.px, pz: best.pz, nx, nz, h: best.h, L: best.L };
    p.door = [best.px + nx * 1.8, best.pz + nz * 1.8];
    if (SIGN[p.k]) { p.signed = true; placeSign(p, p.k === 'casino' ? 'gambling' : p.k); }
  }

  // Trees in parks and along residential streets (instanced)
  { const trunkG = new THREE.CylinderGeometry(0.15, 0.22, 2.4, 4, 1, true); trunkG.translate(0, 1.2, 0);
    const crownG = new THREE.IcosahedronGeometry(1.6, 0); crownG.translate(0, 3.4, 0);
    const spots = [];
    for (const a of M.areas) if (a.k === 'park' || a.k === 'grass' || a.k === 'school') {
      const pts = D(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const cnt = Math.min(250, ((x1 - x0) * (z1 - z0)) / 120);
      for (let i = 0; i < cnt; i++) { const x = rand(x0, x1), z = rand(z0, z1); if (Collider.inside(pts, x, z) && !collider.near(x, z).some(p => p.data?.building !== undefined && Collider.inside(p.pts, x, z))) spots.push([x, z]); }
    }
    for (const r of M.roads) if (r.k === 'residential' || r.k === 'tertiary' || r.k === 'secondary') {
      const pts = D(r.p);
      for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1); const nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
        for (let s = 6; s < L; s += rand(10, 22)) for (const side of [-1, 1]) if (Math.random() < 0.6) {
          const off = r.w / 2 + 2.2, x = x1 + (x2 - x1) * s / L + nx * off * side, z = z1 + (z2 - z1) * s / L + nz * off * side;
          if (!collider.near(x, z).some(p => Collider.inside(p.pts, x, z))) spots.push([x, z]);
        } }
    }
    const N = Math.min(spots.length, 2600);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#7b5a3c', roughness: 1 }), N);
    const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9, flatShading: true }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
    for (let i = 0; i < N; i++) { const [x, z] = spots[i]; const s = rand(0.75, 1.35);
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6)), sv.set(s, s * rand(.9, 1.2), s));
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, new THREE.Color().setHSL(rand(.22, .32), rand(.35, .55), rand(.3, .42)));
      collider.add([[x - .3, z - .3], [x + .3, z - .3], [x + .3, z + .3], [x - .3, z + .3]], { tree: true, h: 99 });
    }
    crowns.castShadow = trunks.castShadow = true; world.add(trunks, crowns); }

  // Poles with tangled cables along big roads
  { const poleG = new THREE.CylinderGeometry(0.12, 0.17, 8, 6); poleG.translate(0, 4, 0);
    const spots = [];
    for (const r of M.roads) if (['primary', 'secondary', 'tertiary', 'trunk'].includes(r.k)) {
      const pts = D(r.p);
      for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1); const nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
        for (let s = 0; s < L; s += 30) spots.push([x1 + (x2 - x1) * s / L + nx * (r.w / 2 + 1), z1 + (z2 - z1) * s / L + nz * (r.w / 2 + 1), (x2 - x1) / L, (z2 - z1) / L]); }
    }
    const poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: '#a8a8a0' }), spots.length);
    const m4 = new THREE.Matrix4(); const cpos = [];
    spots.forEach(([x, z, ux, uz], i) => {
      poles.setMatrixAt(i, m4.makeTranslation(x, 0, z));
      collider.add([[x - .2, z - .2], [x + .2, z - .2], [x + .2, z + .2], [x - .2, z + .2]], { pole: true, h: 99 });
      const nCab = 3 + (i % 4);
      for (let c = 0; c < nCab; c++) { const y0 = 6 + c * 0.35, sag = 0.6 + ((i * 7 + c * 3) % 10) / 6; let px = x, pz = z, py = y0;
        for (let k = 1; k <= 8; k++) { const u = k / 8, nx2 = x + ux * 30 * u, nz2 = z + uz * 30 * u, ny = y0 - Math.sin(u * Math.PI) * sag;
          const w = 0.025; cpos.push(px, py, pz, nx2, ny, nz2, nx2, ny - w * 2, nz2, px, py, pz, nx2, ny - w * 2, nz2, px, py - w * 2, pz); px = nx2; py = ny; pz = nz2; } }
    });
    world.add(poles);
    if (cpos.length) world.add(new THREE.Mesh(geo(cpos), new THREE.MeshBasicMaterial({ color: '#161616', side: THREE.DoubleSide }))); }

  // Parked Dacias along residential streets (instanced, colored)
  const carSpots = [];
  { const body = new THREE.BoxGeometry(1.75, 0.75, 4.2); body.translate(0, 0.62, 0);
    const cab = new THREE.BoxGeometry(1.55, 0.6, 2.1); cab.translate(0, 1.28, 0.1);
    const car = mergeGeos([body, cab]);
    for (const r of M.roads) if (r.k === 'residential' || r.k === 'service' || r.k === 'tertiary') {
      const pts = D(r.p);
      for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]; const L = Math.hypot(x2 - x1, z2 - z1); if (L < 8) continue; const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = -uz, nz = ux;
        for (let s = 4; s < L - 4; s += 5.2) if (Math.random() < 0.45) { const side = Math.random() < .5 ? -1 : 1, off = r.w / 2 - 1.1;
          const x = x1 + ux * s + nx * off * side, z = z1 + uz * s + nz * off * side; if (collider.near(x, z).some(p => p.data?.building !== undefined && Collider.inside(p.pts, x, z))) continue;
          carSpots.push([x, z, Math.atan2(ux, uz)]); } }
    }
    const N = Math.min(carSpots.length, 1500);
    const cars = new THREE.InstancedMesh(car, new THREE.MeshStandardMaterial({ roughness: .35, metalness: .3 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const COLS = ['#f4f4f4', '#d7263d', '#1b4f9c', '#2e8b57', '#c0c0c0', '#8a8d91', '#f2a900', '#222', '#5b2c1d'];
    for (let i = 0; i < N; i++) { const [x, z, a] = carSpots[i]; m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1));
      cars.setMatrixAt(i, m4); cars.setColorAt(i, new THREE.Color(pick(COLS)));
      const c = Math.cos(a), s = Math.sin(a), hw = .9, hl = 2.1; collider.add([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]), { car: true, h: 1.9, walkable: true }); }
    cars.castShadow = true; world.add(cars); }

  return { M, world, collider, pois, placeSign, buildings: buildingsOut, roads: M.roads.map(r => ({ ...r, pts: D(r.p) })), areas: M.areas.map(a => ({ ...a, pts: D(a.p) })), radius: R };
}

export function mergeGeos(geos) {
  const pos = [], nor = [];
  for (const g0 of geos) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
