// Dristor details: courtyards between blocks (scara entrances, carpet beaters, clothes lines, playgrounds,
// fenced front gardens, tyre flower beds, pensioners' tables, trees), facade clutter (AC units, dishes),
// metro entrances, market halls, park furniture, lake pier and rooftop billboards with parody ads.
// Everything small is merged into per-chunk static meshes so the draw-call count stays low on phones.
import * as THREE from 'three';
import { Collider, canvasTex } from './world.js';
import { PARODY } from './brands.js';

function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const CH = 200;
export const TRI = {};

// ---------- template = flat arrays (pos, nor, col) built from primitive parts with rotation
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
function tpl(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); g.applyMatrix4(_m);
    _c.set(hex);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(_c.r, _c.g, _c.b);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col) };
}
class Batch {
  constructor(mat, { shadow = true } = {}) { this.mat = mat; this.shadow = shadow; this.ch = new Map(); }
  add(t, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, tint) {
    const k = Math.floor(x / CH) + ':' + Math.floor(z / CH);
    let c = this.ch.get(k); if (!c) this.ch.set(k, c = { pos: [], nor: [], col: [] });
    const cs = Math.cos(ry), sn = Math.sin(ry), tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
    const P = t.pos, N = t.nor, C = t.col; TRI[t.name || '?'] = (TRI[t.name || '?'] || 0) + P.length / 9;
    for (let i = 0; i < P.length; i += 3) {
      const px = P[i] * sx, py = P[i + 1] * sy, pz = P[i + 2] * sz;
      c.pos.push(x + px * cs + pz * sn, y + py, z - px * sn + pz * cs);
      const nx = N[i] / sx, ny = N[i + 1] / sy, nz = N[i + 2] / sz, L = Math.hypot(nx, ny, nz) || 1;
      c.nor.push((nx * cs + nz * sn) / L, ny / L, (-nx * sn + nz * cs) / L);
      c.col.push(C[i] * tr, C[i + 1] * tg, C[i + 2] * tb);
    }
  }
  finish(parent) {
    for (const c of this.ch.values()) {
      if (!c.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c.col, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.mat); m.castShadow = this.shadow; m.receiveShadow = true; parent.add(m); (this.out || (this.out = [])).push(m);
    }
  }
}
const col3 = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 6), CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const UBOX = tpl([[BOX, '#ffffff', 0, 0.5, 0]]);   // unit box standing on the ground, tinted per use

export function buildDetails(W, opts = {}) {
  const { world, collider } = W, M = W.M, Q = opts.quality || 'high', LOW = Q === 'low';
  const root = new THREE.Group(); root.name = 'details'; world.add(root);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55 });
  const B = new Batch(mat), BM = new Batch(metal), BS = new Batch(mat, { shadow: false }), BF = new Batch(metal, { shadow: false }), BN = new Batch(mat, { shadow: false });
  const RAIL = tpl([[BOX, '#ffffff', 0, 0, 0, 0, 0, 0, 1, 0.045, 0.045]]), POST = tpl([[BOX, '#ffffff', 0, 0.5, 0, 0, 0, 0, 0.05, 1.0, 0.05]]), PANEL = tpl([[BOX, '#6f6f6a', 0, 0.9, 0, 0, 0, 0, 1, 1.8, 0.03]]), FCOL = col3('#3f6b3a');
  const box = (x, z, a, hw, hl, h, data = {}) => { const c = Math.cos(a), s = Math.sin(a); collider.add([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]), { h, ...data }); };
  const stats = {};
  const count = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };

  // ---------- spatial helpers
  const segGrid = new Map(), SG = 16;
  for (const r of W.roads) { const hw = r.w / 2 + (r.w >= 7 ? 2.5 : 0.3); const pts = r.pts;
    for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
      const s = { x1, z1, x2, z2, hw, k: r.k, w: r.w };
      for (let gx = Math.floor((Math.min(x1, x2) - hw - 3) / SG); gx <= Math.floor((Math.max(x1, x2) + hw + 3) / SG); gx++)
        for (let gz = Math.floor((Math.min(z1, z2) - hw - 3) / SG); gz <= Math.floor((Math.max(z1, z2) + hw + 3) / SG); gz++) { const k = gx * 10000 + gz; if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push(s); } } }
  // distance to the nearest road edge (sidewalk included), capped at SG
  function roadDist(x, z) {
    const L = segGrid.get(Math.floor(x / SG) * 10000 + Math.floor(z / SG)); if (!L) return SG;
    let best = SG;
    for (const s of L) { const ex = s.x2 - s.x1, ez = s.z2 - s.z1, L2 = ex * ex + ez * ez || 1; let t = ((x - s.x1) * ex + (z - s.z1) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - s.x1 - ex * t, z - s.z1 - ez * t) - s.hw; if (d < best) best = d; }
    return best;
  }
  function nearestRoad(x, z, minW = 0) {
    let best = null; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const L = segGrid.get((Math.floor(x / SG) + dx) * 10000 + Math.floor(z / SG) + dz); if (!L) continue;
      for (const s of L) { if (s.w < minW) continue; const ex = s.x2 - s.x1, ez = s.z2 - s.z1, L2 = ex * ex + ez * ez || 1; let t = ((x - s.x1) * ex + (z - s.z1) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - s.x1 - ex * t, z - s.z1 - ez * t); if (!best || d < best.d) best = { d, s, px: s.x1 + ex * t, pz: s.z1 + ez * t }; } }
    return best;
  }
  const areaGrid = new Map(), AG = 40;
  W.areas.forEach((a, i) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of a.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = Math.floor(x0 / AG); gx <= Math.floor(x1 / AG); gx++) for (let gz = Math.floor(z0 / AG); gz <= Math.floor(z1 / AG); gz++) { const k = gx * 10000 + gz; if (!areaGrid.has(k)) areaGrid.set(k, []); areaGrid.get(k).push(i); } });
  function areaAt(x, z) { const L = areaGrid.get(Math.floor(x / AG) * 10000 + Math.floor(z / AG)); if (!L) return null; for (const i of L) { const a = W.areas[i]; if (Collider.inside(a.pts, x, z)) return a.k; } return null; }
  // free = not inside/too close to anything solid already in the collider
  function free(x, z, r = 1) {
    for (const p of collider.near(x, z)) { const [bx0, bz0, bx1, bz1] = p.box; if (x < bx0 - r || x > bx1 + r || z < bz0 - r || z > bz1 + r) continue;
      if (Collider.inside(p.pts, x, z)) return false;
      const pts = p.pts; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, az] = pts[j], [cx, cz] = pts[i]; const ex = cx - ax, ez = cz - az, L2 = ex * ex + ez * ez || 1; let t = ((x - ax) * ex + (z - az) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - ax - ex * t, z - az - ez * t) < r) return false; } }
    return true;
  }
  const occ = new Set(), OG = 3; const occKey = (x, z) => Math.floor(x / OG) * 100000 + Math.floor(z / OG);
  const claim = (x, z, r = 1) => { for (let dx = -r; dx <= r; dx += OG) for (let dz = -r; dz <= r; dz += OG) occ.add(occKey(x + dx, z + dz)); };
  const claimed = (x, z) => occ.has(occKey(x, z));
  const BAD_AREAS = new Set(['parking', 'water', 'pitch', 'market', 'retail', 'rail', 'pool', 'construction', 'pier']);
  const yardOK = (x, z, clr = 2) => roadDist(x, z) > 1.2 && W.offRoad(x, z, 1.5) && !claimed(x, z) && !BAD_AREAS.has(areaAt(x, z)) && free(x, z, clr) && Math.hypot(x, z) < W.radius - 20;

  // ---------- templates
  const T = {};
  T.canopy = tpl([[BOX, '#cfc8bb', 0, 2.75, 0.75, 0, 0, 0, 2.8, 0.18, 1.5],
    [BOX, '#3d3027', 0, 1.15, 0.03, 0, 0, 0, 1.5, 2.3, 0.06], [BOX, '#6d8aa0', 0, 1.4, 0.07, 0, 0, 0, 1.2, 1.4, 0.02],
    [BOX, '#a39d93', 0, 0.1, 0.6, 0, 0, 0, 2.2, 0.2, 1.2], [BOX, '#555', 0.95, 1.5, 0.08, 0, 0, 0, 0.18, 0.28, 0.05]]);
  T.bench = tpl([[BOX, '#7b5a36', 0, 0.45, 0, 0, 0, 0, 1.8, 0.07, 0.42], [BOX, '#7b5a36', 0, 0.78, -0.2, -0.15, 0, 0, 1.8, 0.32, 0.05],
    [BOX, '#b9b3a8', -0.75, 0.21, 0, 0, 0, 0, 0.14, 0.42, 0.42], [BOX, '#b9b3a8', 0.75, 0.21, 0, 0, 0, 0, 0.14, 0.42, 0.42]]);
  T.beater = tpl([[BOX, '#5f7d8c', -1.5, 1.05, 0, 0, 0, 0, 0.08, 2.1, 0.08], [BOX, '#5f7d8c', 1.5, 1.05, 0, 0, 0, 0, 0.08, 2.1, 0.08],
    [BOX, '#5f7d8c', 0, 2.05, 0, 0, 0, 0, 3.0, 0.07, 0.07], [BOX, '#5f7d8c', 0, 1.35, 0, 0, 0, 0, 3.0, 0.06, 0.06],
    [BOX, '#b0413e', 0.3, 1.7, 0, 0, 0, 0, 1.6, 0.7, 0.02]]);                                              // a rug waiting to be beaten
  T.dryer = (() => { const p = [[CYL, '#8b8f86', -2.6, 1.1, 0, 0, 0, 0, 0.07, 2.2, 0.07], [CYL, '#8b8f86', 2.6, 1.1, 0, 0, 0, 0, 0.07, 2.2, 0.07],
    [CYL, '#8b8f86', -2.6, 2.15, 0, Math.PI / 2, 0, 0, 0.05, 1.3, 0.05], [CYL, '#8b8f86', 2.6, 2.15, 0, Math.PI / 2, 0, 0, 0.05, 1.3, 0.05]];
    for (const z of [-0.4, 0.4]) p.push([BOX, '#dddddd', 0, 2.12, z, 0, 0, 0, 5.2, 0.015, 0.015]);
    const cl = ['#e33', '#39f', '#fff', '#fc0', '#6c6', '#f6a', '#fff', '#333'];
    for (let i = 0; i < 5; i++) p.push([BOX, cl[i % cl.length], -1.8 + i * 0.85, 1.85, i % 2 ? 0.4 : -0.4, 0, 0, 0, 0.45, 0.5, 0.02]);
    return tpl(p); })();
  T.bins = tpl([[BOX, '#2f7d3a', -1.3, 0.6, 0, 0, 0, 0, 1.2, 1.2, 1.0], [BOX, '#f2c200', 0, 0.6, 0, 0, 0, 0, 1.2, 1.2, 1.0], [BOX, '#1b5fae', 1.3, 0.6, 0, 0, 0, 0, 1.2, 1.2, 1.0],
    [BOX, '#256330', -1.3, 1.25, 0, 0, 0, 0, 1.25, 0.1, 1.05], [BOX, '#c9a100', 0, 1.25, 0, 0, 0, 0, 1.25, 0.1, 1.05], [BOX, '#154a86', 1.3, 1.25, 0, 0, 0, 0, 1.25, 0.1, 1.05],
    [BOX, '#6b5b4b', 0.5, 0.15, 0.9, 0.3, 0.4, 0, 0.6, 0.3, 0.4]]);                                          // the obligatory bag on the ground
  T.tyre = tpl([[new THREE.TorusGeometry(0.42, 0.14, 4, 7), '#f4f4f4', 0, 0.14, 0, Math.PI / 2], [new THREE.IcosahedronGeometry(0.3, 0), '#d94c7a', 0, 0.3, 0, 0, 0, 0, 1, 0.8, 1]]);
  T.table = tpl([[BOX, '#8a8074', 0, 0.75, 0, 0, 0, 0, 1.4, 0.08, 0.9], [BOX, '#9e978b', 0, 0.37, 0, 0, 0, 0, 0.18, 0.75, 0.18], [BOX, '#e8e2d0', 0, 0.8, 0, 0, 0, 0, 0.5, 0.02, 0.5],
    [BOX, '#7b5a36', 0, 0.45, -1.0, 0, 0, 0, 1.6, 0.07, 0.35], [BOX, '#7b5a36', 0, 0.45, 1.0, 0, 0, 0, 1.6, 0.07, 0.35], [BOX, '#9e978b', 0, 0.22, -1.0, 0, 0, 0, 0.14, 0.44, 0.3], [BOX, '#9e978b', 0, 0.22, 1.0, 0, 0, 0, 0.14, 0.44, 0.3]]);
  T.bush = tpl([[new THREE.IcosahedronGeometry(0.8, 0), '#4d7a36', 0, 0.6, 0, 0, 0, 0, 1.2, 0.8, 1.0]]);
  T.swing = tpl([[CYL, '#c0392b', -1.6, 1.15, -0.55, 0.45, 0, 0, 0.09, 2.5, 0.09], [CYL, '#c0392b', -1.6, 1.15, 0.55, -0.45, 0, 0, 0.09, 2.5, 0.09],
    [CYL, '#c0392b', 1.6, 1.15, -0.55, 0.45, 0, 0, 0.09, 2.5, 0.09], [CYL, '#c0392b', 1.6, 1.15, 0.55, -0.45, 0, 0, 0.09, 2.5, 0.09], [CYL, '#c0392b', 0, 2.25, 0, 0, 0, Math.PI / 2, 0.09, 3.3, 0.09],
    [BOX, '#999', -0.9, 1.35, 0, 0, 0, 0, 0.03, 1.8, 0.03], [BOX, '#999', -0.3, 1.35, 0, 0, 0, 0, 0.03, 1.8, 0.03], [BOX, '#f2c200', -0.6, 0.45, 0, 0, 0, 0, 0.7, 0.06, 0.3],
    [BOX, '#999', 0.3, 1.35, 0, 0, 0, 0, 0.03, 1.8, 0.03], [BOX, '#999', 0.9, 1.35, 0, 0, 0, 0, 0.03, 1.8, 0.03], [BOX, '#2e8b57', 0.6, 0.45, 0, 0, 0, 0, 0.7, 0.06, 0.3]]);
  T.slide = tpl([[BOX, '#1b5fae', 0, 1.5, -1.2, 0, 0, 0, 1.0, 0.08, 1.0], [CYL, '#888', -0.45, 0.75, -1.65, 0, 0, 0, 0.07, 1.5, 0.07], [CYL, '#888', 0.45, 0.75, -1.65, 0, 0, 0, 0.07, 1.5, 0.07],
    [CYL, '#888', -0.45, 0.75, -0.75, 0, 0, 0, 0.07, 1.5, 0.07], [CYL, '#888', 0.45, 0.75, -0.75, 0, 0, 0, 0.07, 1.5, 0.07], [BOX, '#e33', 0, 0.8, 0.45, -0.62, 0, 0, 0.7, 0.05, 2.6],
    [BOX, '#e33', -0.37, 0.95, 0.45, -0.62, 0, 0, 0.05, 0.25, 2.6], [BOX, '#e33', 0.37, 0.95, 0.45, -0.62, 0, 0, 0.05, 0.25, 2.6], [BOX, '#888', 0, 0.8, -2.2, 0.35, 0, 0, 0.5, 0.05, 1.9]]);
  T.globe = (() => { const ico = new THREE.IcosahedronGeometry(1.3, 0); const pos = ico.attributes.position; const seen = new Set(), p = [];
    for (let i = 0; i < pos.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
      const A = new THREE.Vector3().fromBufferAttribute(pos, a), Bv = new THREE.Vector3().fromBufferAttribute(pos, b); if (A.y < -0.2 && Bv.y < -0.2) continue;
      const key = [A, Bv].map(v => v.toArray().map(n => n.toFixed(2)).join(',')).sort().join('|'); if (seen.has(key)) continue; seen.add(key);
      const mid = A.clone().add(Bv).multiplyScalar(0.5), dir = Bv.clone().sub(A), L = dir.length(); const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); const e = new THREE.Euler().setFromQuaternion(qq);
      p.push([CYL, ['#e33', '#f2c200', '#1b5fae', '#2e8b57'][p.length % 4], mid.x, mid.y + 1.1, mid.z, e.x, e.y, e.z, 0.05, L, 0.05]); }
    return tpl(p); })();
  T.sandbox = tpl([[BOX, '#8b5a2b', 0, 0.15, -1.2, 0, 0, 0, 2.5, 0.3, 0.12], [BOX, '#8b5a2b', 0, 0.15, 1.2, 0, 0, 0, 2.5, 0.3, 0.12], [BOX, '#8b5a2b', -1.2, 0.15, 0, 0, 0, 0, 0.12, 0.3, 2.5], [BOX, '#8b5a2b', 1.2, 0.15, 0, 0, 0, 0, 0.12, 0.3, 2.5], [BOX, '#d8c28a', 0, 0.1, 0, 0, 0, 0, 2.3, 0.18, 2.3]]);
  T.spring = tpl([[CYL8, '#888', 0, 0.25, 0, 0, 0, 0, 0.18, 0.5, 0.18], [new THREE.IcosahedronGeometry(0.35, 0), '#f2c200', 0, 0.7, 0, 0, 0, 0, 1.4, 0.8, 0.8], [new THREE.IcosahedronGeometry(0.18, 0), '#f2c200', 0.45, 0.95, 0]]);
  T.fence = tpl([[BOX, '#3f6b3a', 0, 0.45, 0, 0, 0, 0, 1, 0.04, 0.04], [BOX, '#3f6b3a', 0, 0.85, 0, 0, 0, 0, 1, 0.04, 0.04], [BOX, '#3f6b3a', 0.48, 0.5, 0, 0, 0, 0, 0.05, 1.0, 0.05]]);
  T.fenceTall = tpl([[BOX, '#6f6f6a', 0, 0.9, 0, 0, 0, 0, 1, 1.8, 0.03], [BOX, '#444', 0.48, 0.95, 0, 0, 0, 0, 0.06, 1.9, 0.06]]);
  T.ac = tpl([[BOX, '#e4e4df', 0, 0.28, 0.16, 0, 0, 0, 0.8, 0.55, 0.3]]);
  T.dish = tpl([[new THREE.ConeGeometry(0.33, 0.14, 7, 1, true), '#dcdcdc', 0, 0.35, 0.25, -Math.PI / 2 + 0.5, 0, 0]]);
  T.lampPark = tpl([[BOX, '#3a3f44', 0, 1.9, 0, 0, 0, 0, 0.1, 3.8, 0.1], [new THREE.IcosahedronGeometry(0.24, 0), '#fff6d8', 0, 3.9, 0]]);
  T.stall = tpl([[BOX, '#9aa0a3', 0, 2.6, 0, 0.12, 0, 0, 3.2, 0.06, 2.6], [CYL, '#777', -1.5, 1.3, -1.2, 0, 0, 0, 0.07, 2.6, 0.07], [CYL, '#777', 1.5, 1.3, -1.2, 0, 0, 0, 0.07, 2.6, 0.07],
    [CYL, '#777', -1.5, 1.2, 1.2, 0, 0, 0, 0.07, 2.4, 0.07], [CYL, '#777', 1.5, 1.2, 1.2, 0, 0, 0, 0.07, 2.4, 0.07], [BOX, '#b58b5a', 0, 0.85, 0.6, 0, 0, 0, 3.0, 0.08, 1.0], [BOX, '#8b6b4a', 0, 0.42, 0.6, 0, 0, 0, 2.9, 0.84, 0.9]]);
  T.crates = tpl([[BOX, '#c49a5c', -1.0, 1.0, 0.6, 0, 0, 0, 0.55, 0.25, 0.4], [BOX, '#c49a5c', -0.35, 1.0, 0.6, 0, 0, 0, 0.55, 0.25, 0.4], [BOX, '#c49a5c', 0.3, 1.0, 0.6, 0, 0, 0, 0.55, 0.25, 0.4], [BOX, '#c49a5c', 0.95, 1.0, 0.6, 0, 0, 0, 0.55, 0.25, 0.4],
    [BOX, '#e53935', -1.0, 1.15, 0.6, 0, 0, 0, 0.5, 0.1, 0.35], [BOX, '#f9a825', -0.35, 1.15, 0.6, 0, 0, 0, 0.5, 0.1, 0.35], [BOX, '#43a047', 0.3, 1.15, 0.6, 0, 0, 0, 0.5, 0.1, 0.35], [BOX, '#ef6c00', 0.95, 1.15, 0.6, 0, 0, 0, 0.5, 0.1, 0.35]]);
  T.boat = tpl([[BOX, '#f4f4f4', 0, 0.35, 0, 0, 0, 0, 1.4, 0.4, 2.4], [BOX, '#1b5fae', 0, 0.62, -0.3, 0, 0, 0, 1.2, 0.16, 0.9], [new THREE.SphereGeometry(0.35, 8, 6), '#f4f4f4', 0, 1.0, 1.0, 0, 0, 0, 0.8, 1.2, 0.8], [CYL, '#f4f4f4', 0, 0.8, 0.9, 0.3, 0, 0, 0.12, 0.9, 0.12]]);
  T.fountain = tpl([[CYL8, '#bdb6a8', 0, 0.3, 0, 0, 0, 0, 7, 0.6, 7], [CYL8, '#4d8fb5', 0, 0.55, 0, 0, 0, 0, 6.4, 0.1, 6.4], [CYL8, '#bdb6a8', 0, 1.0, 0, 0, 0, 0, 0.7, 1.4, 0.7], [CYL8, '#bdb6a8', 0, 1.7, 0, 0, 0, 0, 2.0, 0.15, 2.0], [new THREE.ConeGeometry(0.25, 1.4, 8), '#cfe8f5', 0, 2.5, 0]]);
  T.kiosk = tpl([[BOX, '#e9e3d4', 0, 1.3, 0, 0, 0, 0, 2.6, 2.6, 2.0], [BOX, '#6d8aa0', 0, 1.5, 1.01, 0, 0, 0, 2.2, 1.2, 0.02], [BOX, '#1b4f9c', 0, 2.75, 0, 0, 0, 0, 2.8, 0.3, 2.2], [BOX, '#fff', 0, 2.75, 1.11, 0, 0, 0, 2.3, 0.22, 0.01]]);

  for (const k in T) T[k].name = k; RAIL.name = 'rail'; POST.name = 'post'; PANEL.name = 'panel';
  const tint = (hex) => col3(hex);
  const TREEC = ['#4f7a36', '#5d8a3b', '#6b8f3e', '#48702f', '#557f38', '#7a9a45', '#4a6f33', '#9a9a3a'];

  // ---------- 1) residential blocks: scara entrances, front gardens, carpet beaters, clothes lines, bins
  const trees = [];   // [x, z, type(0 round, 1 poplar, 2 fruit), scale, colour]
  const blocks = W.buildings.filter(b => !b.garage && !b.special && !b.plainKind && b.h > 8 && b.levels >= 4);
  const plaques = [];
  for (const b of blocks) {
    const pts = b.pts, n = pts.length;
    const edges = []; for (let i = 0; i < n; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n]; const L = Math.hypot(x2 - x1, z2 - z1); if (L < 10) continue;
      edges.push({ L, x1, z1, x2, z2, ex: (x2 - x1) / L, ez: (z2 - z1) / L, nx: (z2 - z1) / L, nz: -(x2 - x1) / L, mx: (x1 + x2) / 2, mz: (z1 + z2) / 2 }); }
    if (!edges.length) continue;
    edges.sort((a, c) => c.L - a.L);
    // the two long sides: entrances on the side that faces the nearer street/alley
    const e0 = edges[0], e1 = edges.find(e => e !== e0 && Math.abs(e.ex * e0.ex + e.ez * e0.ez) > 0.9 && (e.nx * e0.nx + e.nz * e0.nz) < 0) || null;
    const rd = (e) => { let d = 0; for (const t of [0.25, 0.5, 0.75]) d += roadDist(e.x1 + (e.x2 - e.x1) * t + e.nx * 10, e.z1 + (e.z2 - e.z1) * t + e.nz * 10); return d; };
    const front = e1 && rd(e1) < rd(e0) ? e1 : e0, back = front === e0 ? e1 : e0;
    const nSc = Math.max(1, Math.round(front.L / 24));
    const letters = 'ABCDEFGH';
    for (let k = 0; k < nSc; k++) {
      const t = (k + 0.5) / nSc * front.L, x = front.x1 + front.ex * t, z = front.z1 + front.ez * t, a = Math.atan2(front.nx, front.nz);
      B.add(T.canopy, x + front.nx * 0.02, 0, z + front.nz * 0.02, a); count('scari');
      claim(x + front.nx * 3, z + front.nz * 3, 3);
      if (b.name && /^(Bl|Bloc)/i.test(b.name)) plaques.push({ x: x + front.ex * 1.1 + front.nx * 0.07, z: z + front.ez * 1.1 + front.nz * 0.07, a, text: b.name.replace(/^Bloc\s*/i, 'Bl. ').replace(/^Bl\.?\s*/i, 'Bl. ') + ' · Sc. ' + letters[k % 8] });
      // benches either side of the door (the pensioners' observation post)
      for (const sd of [-1, 1]) if (hash(b.id * 7 + k * 3 + sd) < 0.55) { const bx = x + front.ex * sd * 3.2 + front.nx * 2.2, bz = z + front.ez * sd * 3.2 + front.nz * 2.2; if (free(bx, bz, 0.8) && roadDist(bx, bz) > 0.5) { BN.add(T.bench, bx, 0, bz, a); box(bx, bz, a, 0.9, 0.25, 0.9); count('bench'); } }
      if (hash(b.id * 13 + k) < 0.35) { const bx = x + front.ex * 6 + front.nx * 4, bz = z + front.ez * 6 + front.nz * 4; if (yardOK(bx, bz, 1.5)) { BN.add(T.bins, bx, 0, bz, a); box(bx, bz, a, 2, 0.6, 1.3); claim(bx, bz, 3); count('bins'); } }
    }
    // front gardens with low green fences on the back side (ground-floor flats' little plots)
    if (back && back.L > 14 && hash(b.id * 3.3) < 0.6) {
      const depth = 3 + hash(b.id) * 2.5, a = Math.atan2(back.ex, back.ez);
      { const fl = back.L - 2, fx = back.x1 + back.ex * (1 + fl / 2) + back.nx * depth, fz = back.z1 + back.ez * (1 + fl / 2) + back.nz * depth;
        if (roadDist(fx, fz) > 0.5) { BF.add(RAIL, fx, 0.45, fz, a + Math.PI / 2, fl, 1, 1, FCOL); BF.add(RAIL, fx, 0.85, fz, a + Math.PI / 2, fl, 1, 1, FCOL);
          for (let s = 1; s <= back.L - 1; s += 3.5) BF.add(POST, back.x1 + back.ex * s + back.nx * depth, 0, back.z1 + back.ez * s + back.nz * depth, a, 1, 1, 1, FCOL); } }
      for (let s = 2; s < back.L - 2; s += 2.2) { const x = back.x1 + back.ex * s + back.nx * (depth * 0.5), z = back.z1 + back.ez * s + back.nz * (depth * 0.5); if (roadDist(x, z) < 0.5) continue;
        const r = hash(b.id * 17 + s); if (r < 0.22) B.add(T.bush, x, 0, z, r * 9, 0.8 + r, 0.8 + r, 0.8 + r, tint(TREEC[(r * 7) | 0])); else if (r < 0.27) BN.add(T.tyre, x, 0, z, r * 5); else if (r < 0.34) trees.push([x, z, 2, 0.7 + r * 0.5, r]); }
      const [ax, az] = [back.x1 + back.nx * depth, back.z1 + back.nz * depth], [bx2, bz2] = [back.x2 + back.nx * depth, back.z2 + back.nz * depth];
      collider.add([[back.x1, back.z1], [back.x2, back.z2], [bx2, bz2], [ax, az]], { h: 0.95 }); count('gardens');
      for (let s = 0; s < back.L; s += 3) claim(back.x1 + back.ex * s + back.nx * depth / 2, back.z1 + back.ez * s + back.nz * depth / 2, depth / 2 + 1);
    }
    // carpet beater and clothes dryer somewhere in front, 9-20 m out
    for (const [tp, pr, hw, hl] of [[T.beater, 0.75, 1.6, 0.2], [T.dryer, 0.5, 2.7, 0.7]]) {
      if (hash(b.id * (tp === T.beater ? 5 : 11)) > pr) continue;
      for (let tries = 0; tries < 8; tries++) { const t = hash(b.id * 29 + tries) * front.L, out = 9 + hash(b.id * 31 + tries) * 11;
        const x = front.x1 + front.ex * t + front.nx * out, z = front.z1 + front.ez * t + front.nz * out, a = Math.atan2(front.ex, front.ez) + Math.PI / 2;
        if (!yardOK(x, z, 2.5)) continue; BM.add(tp, x, 0, z, a); box(x, z, a, hw, hl, 2.2); claim(x, z, 4); count(tp === T.beater ? 'beater' : 'dryer'); break; }
    }
    // facade clutter: AC units under windows, satellite dishes on balconies
    for (const e of edges) { if (e.L < 8) continue; const floors = b.levels;
      for (let f = 1; f < floors; f++) for (let s = 2; s < e.L - 1.5; s += 3.2) { const r = hash(b.id * 101 + f * 17 + s * 3 + e.L);
        if (r > (LOW ? 0.015 : 0.028)) continue; const y = 3.0 + (f - 1) * 2.75 + 0.15, isAc = r < (LOW ? 0.012 : 0.022);
        BS.add(isAc ? T.ac : T.dish, e.x1 + e.ex * s, y, e.z1 + e.ez * s, Math.atan2(e.nx, e.nz)); count(isAc ? 'ac' : 'dish'); } }
  }

  // ---------- 2) yard trees + bushes + pensioners' tables on a jittered grid around each block
  const MAXT = LOW ? 2500 : 6500;
  for (const b of blocks) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of b.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const pad = 22, step = 7;
    for (let x = x0 - pad; x <= x1 + pad; x += step) for (let z = z0 - pad; z <= z1 + pad; z += step) {
      const jx = x + (hash(x * 3.1 + z) - 0.5) * 4, jz = z + (hash(z * 1.7 - x) - 0.5) * 4;
      if (trees.length >= MAXT) break;
      if (claimed(jx, jz)) continue;
      const r = hash(jx * 12.9898 + jz * 78.233);
      if (r > 0.42) continue;
      if (!yardOK(jx, jz, r < 0.3 ? 3 : 2)) { occ.add(occKey(jx, jz)); continue; }
      occ.add(occKey(jx, jz));
      if (r < 0.3) { trees.push([jx, jz, r < 0.07 ? 1 : 0, 0.8 + hash(jx) * 0.7, hash(jz)]); }
      else if (r < 0.345) { B.add(T.bush, jx, 0, jz, r * 20, 0.9, 0.9, 0.9, tint(TREEC[(hash(jx + 1) * 5) | 0])); }
      else if (r > 0.385 && r < 0.395) { const a = hash(jx) * 6; BN.add(T.table, jx, 0, jz, a); box(jx, jz, a, 0.9, 1.2, 0.9); claim(jx, jz, 3); count('table'); }
      else if (r >= 0.395 && r < 0.405) { BN.add(T.tyre, jx, 0, jz, r * 5); }
    }
  }
  // OSM tree rows
  for (const tr of M.treerows || []) { const pts = tr.p.map(([x, z]) => [x / 10, z / 10]);
    for (let i = 0; i < pts.length - 1; i++) { const [xa, za] = pts[i], [xb, zb] = pts[i + 1]; const L = Math.hypot(xb - xa, zb - za);
      for (let s = 0; s < L; s += 8) { const x = xa + (xb - xa) * s / L, z = za + (zb - za) * s / L; if (free(x, z, 1)) trees.push([x, z, 0, 1.1, hash(x)]); } } }

  // ---------- 3) playgrounds (OSM areas + nodes) with swings, slide, climbing globe, sandbox, spring rider and benches around
  const playSpots = [];
  for (const a of W.areas) if (a.k === 'play') { let cx = 0, cz = 0; for (const [x, z] of a.pts) { cx += x; cz += z; } playSpots.push([cx / a.pts.length, cz / a.pts.length, a]); }
  for (const p of M.props || []) if (p[2] === 'playground') playSpots.push([p[0] / 10, p[1] / 10, null]);
  const PLAY = [[T.swing, 0, 0, 1.9, 0.9], [T.slide, 5, 1, 0.6, 2.4], [T.globe, -5, 1.5, 1.4, 1.4], [T.sandbox, 1, -5, 1.3, 1.3], [T.spring, -3, -4, 0.4, 0.8], [T.spring, 4.5, -4.5, 0.4, 0.8]];
  for (const [cx, cz, a] of playSpots) {
    const rot = hash(cx * 7 + cz) * 6.28, c = Math.cos(rot), s = Math.sin(rot); let placed = 0;
    for (const [tp, dx, dz, hw, hl] of PLAY) { const x = cx + dx * c + dz * s, z = cz - dx * s + dz * c;
      if ((a && !Collider.inside(a.pts, x, z)) || !free(x, z, Math.max(hw, hl)) || !W.offRoad(x, z, Math.max(hw, hl) + 0.3)) continue; (tp === T.sandbox || tp === T.spring ? B : BM).add(tp, x, 0, z, rot); box(x, z, rot, hw, hl, 2.2); placed++; }
    for (let k = 0; k < 4; k++) { const ang = rot + k * Math.PI / 2 + 0.4, x = cx + Math.cos(ang) * 8.5, z = cz + Math.sin(ang) * 8.5; if (free(x, z, 1) && W.offRoad(x, z, 1) && (!a || Collider.inside(a.pts, x, z))) { const ba = Math.atan2(cx - x, cz - z); BN.add(T.bench, x, 0, z, ba); box(x, z, ba, 0.9, 0.25, 0.9); } }
    claim(cx, cz, 10); if (placed) count('playground');
  }

  // ---------- 4) OSM fences, benches, fountains, kiosks
  for (const f of M.fences || []) { const pts = f.p.map(([x, z]) => [x / 10, z / 10]);
    for (let i = 0; i < pts.length - 1; i++) { const [xa, za] = pts[i], [xb, zb] = pts[i + 1]; const L = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za) + Math.PI / 2;
      BF.add(PANEL, (xa + xb) / 2, 0, (za + zb) / 2, a, L, 1, 1); for (let s = 0; s <= L; s += 3) BF.add(POST, xa + (xb - xa) * s / L, 0, za + (zb - za) * s / L, a, 1.3, 1.9, 1.3, col3('#555')); collider.add([[xa, za], [xb, zb], [xb + 0.05, zb + 0.05], [xa + 0.05, za + 0.05]], { h: 1.8 }); } }
  for (const p of M.props || []) { const x = p[0] / 10, z = p[1] / 10;
    if (p[2] === 'bench' && free(x, z, 0.6) && W.offRoad(x, z, 0.8)) { const nr = nearestRoad(x, z); const a = nr ? Math.atan2(nr.px - x, nr.pz - z) : 0; BN.add(T.bench, x, 0, z, a); box(x, z, a, 0.9, 0.25, 0.9); count('osmBench'); }
    if ((p[2] === 'fountain') && free(x, z, 3.5) && W.offRoad(x, z, 3.6)) { B.add(T.fountain, x, 0, z); collider.add([[x - 3.4, z - 3.4], [x + 3.4, z - 3.4], [x + 3.4, z + 3.4], [x - 3.4, z + 3.4]], { h: 0.6 }); count('fountain'); } }
  for (const p of W.pois) { if (p.k === 'fountain' && free(p.x, p.z, 3.5) && W.offRoad(p.x, p.z, 3.6)) { B.add(T.fountain, p.x, 0, p.z); collider.add([[p.x - 3.4, p.z - 3.4], [p.x + 3.4, p.z - 3.4], [p.x + 3.4, p.z + 3.4], [p.x - 3.4, p.z + 3.4]], { h: 0.6 }); count('fountain'); }
    if (p.k === 'kiosk' && free(p.x, p.z, 1.6) && W.offRoad(p.x, p.z, 1.6)) { const nr = nearestRoad(p.x, p.z); const a = nr ? Math.atan2(nr.px - p.x, nr.pz - p.z) : 0; B.add(T.kiosk, p.x, 0, p.z, a); box(p.x, p.z, a, 1.3, 1.0, 2.9); count('kiosk'); } }

  // ---------- 5) parks: lamps + benches along footways, lake pier with swan pedal-boats
  { const parks = W.areas.filter(a => a.k === 'park');
    const inPark = (x, z) => parks.some(a => Collider.inside(a.pts, x, z));
    for (const r of W.roads) if (r.k === 'footway' || r.k === 'path' || r.k === 'pedestrian') { const pts = r.pts;
      for (let i = 0; i < pts.length - 1; i++) { const [xa, za] = pts[i], [xb, zb] = pts[i + 1]; const L = Math.hypot(xb - xa, zb - za); if (L < 6) continue; const ux = (xb - xa) / L, uz = (zb - za) / L;
        for (let s = 8; s < L; s += 22) { const x = xa + ux * s, z = za + uz * s; if (!inPark(x, z)) continue; const sd = hash(x + z) < 0.5 ? -1 : 1;
          const lx = x - uz * sd * (r.w / 2 + 0.6), lz = z + ux * sd * (r.w / 2 + 0.6); if (free(lx, lz, 0.4) && W.carriageDist(lx, lz) > 0.5) { BM.add(T.lampPark, lx, 0, lz); box(lx, lz, 0, 0.12, 0.12, 99); count('parkLamp'); }
          if (hash(x * 3 + z) < 0.45) { const bx = x + uz * sd * (r.w / 2 + 1.0), bz = z - ux * sd * (r.w / 2 + 1.0); if (free(bx, bz, 0.8) && W.carriageDist(bx, bz) > 1) { const a = Math.atan2(-uz * sd, ux * sd) + Math.PI; BN.add(T.bench, bx, 0, bz, Math.atan2(x - bx, z - bz)); box(bx, bz, a, 0.9, 0.25, 0.9); count('parkBench'); } } } } }
    for (const a of W.areas) if (a.k === 'pier') { let cx = 0, cz = 0; for (const [x, z] of a.pts) { cx += x; cz += z; } cx /= a.pts.length; cz /= a.pts.length;
      const water = W.areas.filter(w => w.k === 'water').sort((p, q) => { const d = (w) => Math.min(...w.pts.map(([x, z]) => Math.hypot(x - cx, z - cz))); return d(p) - d(q); })[0];
      if (!water) continue; let wp = water.pts[0], wd = 1e9; for (const p of water.pts) { const d = Math.hypot(p[0] - cx, p[1] - cz); if (d < wd) { wd = d; wp = p; } }
      const ux = (wp[0] - cx) / (wd || 1), uz = (wp[1] - cz) / (wd || 1), a0 = Math.atan2(ux, uz);
      const deck = tpl([[BOX, '#8a6a48', 0, 0.35, 0, 0, 0, 0, 5, 0.12, 1]]);
      for (let s = -2; s < wd + 14; s += 1) B.add(deck, cx + ux * s, 0, cz + uz * s, a0);
      for (let k = 0; k < 6; k++) { const s = wd + 3 + (k % 3) * 3.5, sd = k < 3 ? -1 : 1, x = cx + ux * s - uz * sd * 3.8, z = cz + uz * s + ux * sd * 3.8; B.add(T.boat, x, 0, z, a0 + (hash(k) - 0.5) * 0.5); }
      count('pier'); }
  }

  // ---------- 6) metro entrances: stairwell with granite parapets, glass canopy, blue M totem
  const stairTex = canvasTex(128, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a8580'); gr.addColorStop(0.55, '#3a3734'); gr.addColorStop(1, '#050505'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h * 0.8; y += 12) { g.fillStyle = `rgba(255,255,255,${0.18 * (1 - y / h)})`; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 2, w, 3); }
    g.fillStyle = '#d4a017'; g.fillRect(0, 0, w, 3); g.fillStyle = '#9a9a9a'; g.fillRect(6, 0, 3, h * 0.9); g.fillRect(w - 9, 0, 3, h * 0.9); });
  const stairMat = new THREE.MeshStandardMaterial({ map: stairTex, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a9c9dc', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });
  const mTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#1b4f9c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 100px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', w / 2, h / 2 + 6); });
  const mMat = new THREE.MeshStandardMaterial({ map: mTex, emissive: '#ffffff', emissiveMap: mTex, emissiveIntensity: 0.45 });
  const metroOut = [];
  const GRAN = tpl([[BOX, '#7d7a76', 0, 0.5, 0]]);
  // Which entrances exist: OSM station nodes are not entrances, and the two mapped east of Dristor 1 do not exist in reality.
  const stations = W.pois.filter(p => p.k === 'subway' && /^Dristor [12]$/.test(p.n || ''));
  const d1 = stations.find(p => p.n === 'Dristor 1'), d2 = stations.find(p => p.n === 'Dristor 2');
  const entrances = W.pois.filter(p => p.k === 'subway' && !/^Dristor [12]$/.test(p.n || '') && !(d1 && p.x - d1.x > 60 && Math.abs(p.z - d1.z) < 80));
  // labels: the entrance closest to each station (Dristor 1 = the one NW of the Lucaciu pastry shop)
  const nearestTo = (st, skip) => entrances.filter(q => q !== skip).reduce((b, q) => !b || Math.hypot(q.x - st.x, q.z - st.z) < Math.hypot(b.x - st.x, b.z - st.z) ? q : b, null);
  const e1 = d1 && nearestTo(d1); if (e1) e1.label = 'Dristor 1';
  const e2 = d2 && nearestTo(d2, e1); if (e2) e2.label = 'Dristor 2';
  for (const p of entrances) {
    // entrances sit on the sidewalk, never on the carriageway: spiral out from the OSM point until the whole
    // footprint (plus the exit in front of it) is clear of every road and building
    const len = 7, wid = 3.2;
    const orient = (x, z) => { const nr = nearestRoad(x, z, 6); const ux = nr ? nr.s.x2 - nr.s.x1 : 1, uz = nr ? nr.s.z2 - nr.s.z1 : 0, L = Math.hypot(ux, uz) || 1; return [ux / L, uz / L]; };
    const clear = (x, z, ex, ez) => { for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1, 1.6]) { const cx = x + ez * u * (wid / 2 + 0.5) + ex * v * (len / 2 + 0.4), cz = z - ex * u * (wid / 2 + 0.5) + ez * v * (len / 2 + 0.4);
      if (W.carriageDist(cx, cz) < 0.6) return false; if (collider.near(cx, cz).some(q => q.data?.building !== undefined && Collider.inside(q.pts, cx, cz))) return false; } return true; };
    let sx = p.x, sz = p.z, [ex, ez] = orient(sx, sz), found = clear(sx, sz, ex, ez);
    for (let r = 1.5; r <= 45 && !found; r += 1.5) for (let k = 0; k < 24 && !found; k++) { const ang = k / 24 * Math.PI * 2, x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r; const [ox, oz] = orient(x, z);
      if (clear(x, z, ox, oz)) { sx = x; sz = z; ex = ox; ez = oz; found = true; } else if (clear(x, z, oz, -ox)) { sx = x; sz = z; ex = oz; ez = -ox; found = true; } }
    if (!found) continue;                                   // better no entrance than one in the middle of the road
    const a = Math.atan2(ex, ez);
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), stairMat); pit.rotation.x = -Math.PI / 2; pit.rotation.z = a + Math.PI; pit.position.set(sx, 0.24, sz); pit.receiveShadow = true; root.add(pit);
    // parapets on both long sides + the back (entry is the front end)
    for (const sd of [-1, 1]) B.add(GRAN, sx + ez * sd * (wid / 2 + 0.15), 0, sz - ex * sd * (wid / 2 + 0.15), a, 0.3, 1.0, len);
    B.add(GRAN, sx - ex * (len / 2 + 0.15), 0, sz - ez * (len / 2 + 0.15), a, wid + 0.6, 1.0, 0.3);
    // glass canopy on steel posts
    const can = new THREE.Mesh(new THREE.BoxGeometry(wid + 1, 0.08, len + 0.8), glassMat); can.position.set(sx, 3.1, sz); can.rotation.set(0.04, a, 0); root.add(can);
    for (const sd of [-1, 1]) for (const f of [-1, 1]) BM.add(tpl([[CYL, '#5b6166', 0, 1.55, 0, 0, 0, 0, 0.12, 3.1, 0.12]]), sx + ez * sd * (wid / 2 + 0.3) + ex * f * (len / 2), 0, sz - ex * sd * (wid / 2 + 0.3) + ez * f * (len / 2));
    BM.add(tpl([[BOX, '#5b6166', 0, 0, 0, 0, 0, 0, wid + 1.1, 0.22, 0.14]]), sx + ex * (len / 2 + 0.4), 3.12, sz + ez * (len / 2 + 0.4), a);
    // M totem at the entry corner
    const fx = sx + ex * (len / 2 + 1.2) + ez * (wid / 2 + 0.6), fz = sz + ez * (len / 2 + 1.2) - ex * (wid / 2 + 0.6);
    BM.add(tpl([[BOX, '#555', 0, 1.6, 0, 0, 0, 0, 0.22, 3.2, 0.22]]), fx, 0, fz);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mMat); cube.position.set(fx, 3.75, fz); cube.rotation.y = a; root.add(cube);
    collider.add([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [sx + ez * u * (wid / 2 + 0.35) + ex * v * (len / 2 + 0.3), sz - ex * u * (wid / 2 + 0.35) + ez * v * (len / 2 + 0.3)]), { h: 1.0 });
    box(fx, fz, a, 0.2, 0.2, 99);
    metroOut.push({ x: sx + ex * (len / 2 + 2.2), z: sz + ez * (len / 2 + 2.2), name: p.label || '', a }); count('metro');
  }
  world.userData.metroMats = [mMat];

  // ---------- 7) markets: rows of covered stalls with produce crates
  for (const a of W.areas) if (a.k === 'market') {
    let lg = null; for (let i = 0; i < a.pts.length; i++) { const [x1, z1] = a.pts[i], [x2, z2] = a.pts[(i + 1) % a.pts.length]; const L = Math.hypot(x2 - x1, z2 - z1); if (!lg || L > lg.L) lg = { L, ux: (x2 - x1) / L, uz: (z2 - z1) / L }; }
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of a.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    let cx = 0, cz = 0; for (const [x, z] of a.pts) { cx += x; cz += z; } cx /= a.pts.length; cz /= a.pts.length;
    const R2 = Math.min(34, Math.hypot(x1 - x0, z1 - z0) / 2), vx = -lg.uz, vz = lg.ux, ang = Math.atan2(lg.ux, lg.uz) + Math.PI / 2;
    let n = 0;
    for (let w = -R2; w < R2 && n < 120; w += 7) for (let u = -R2; u < R2 && n < 120; u += 3.3) { if (Math.abs(u) < 2) continue;   // central aisle
      const x = cx + lg.ux * u + vx * w, z = cz + lg.uz * u + vz * w;
      if (!Collider.inside(a.pts, x, z) || !free(x, z, 1.8) || !W.offRoad(x, z, 2)) continue; const flip = Math.round(w / 7) % 2 ? Math.PI : 0;
      BM.add(T.stall, x, 0, z, ang + flip); BN.add(T.crates, x, 0, z, ang + flip); box(x, z, ang, 1.6, 1.3, 2.6); n++; }
    count('stall', n);
  }

  // ---------- 8) rooftop billboards on tall blocks next to the big boulevards (parody ads)
  { const ads = PARODY.filter(p => !p[5]).slice(0); let used = 0; const bb = [];
    for (const b of W.buildings) { if (b.garage || b.special || b.h < 24 || used >= (LOW ? 6 : 14)) continue;
      for (let i = 0; i < b.pts.length; i++) { const [x1, z1] = b.pts[i], [x2, z2] = b.pts[(i + 1) % b.pts.length]; const L = Math.hypot(x2 - x1, z2 - z1); if (L < 14) continue;
        const nx = (z2 - z1) / L, nz = -(x2 - x1) / L, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2; const nr = nearestRoad(mx + nx * 20, mz + nz * 20, 14);
        if (!nr || nr.d > 18 || bb.some(([x, z]) => Math.hypot(x - mx, z - mz) < 160)) continue;
        const ad = ads[(hash(b.id * 3) * ads.length) | 0]; const W2 = Math.min(16, L * 0.7), H2 = W2 * 0.3;
        const tex = canvasTex(1024, 308, (g, w, h) => { g.fillStyle = ad[3]; g.fillRect(0, 0, w, h); g.fillStyle = ad[4]; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 130px Trebuchet MS, Arial'; g.fillText(ad[1], w / 2, h * 0.4, w - 60); g.font = 'bold 54px Trebuchet MS, Arial'; g.fillText(ad[2], w / 2, h * 0.8, w - 60); });
        const board = new THREE.Mesh(new THREE.PlaneGeometry(W2, H2), new THREE.MeshStandardMaterial({ map: tex, emissive: '#fff', emissiveMap: tex, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
        const px = mx - nx * 1.5, pz = mz - nz * 1.5; board.position.set(px, b.h + 1.6 + H2 / 2, pz); board.lookAt(px + nx, board.position.y, pz + nz); root.add(board); world.userData.signExtra?.push(board.material);
        for (let k = -2; k <= 2; k++) BM.add(tpl([[BOX, '#4a4f55', 0, (1.6 + H2) / 2, 0, 0, 0, 0, 0.15, 1.6 + H2, 0.15]]), px + (-nz) * k * W2 / 4.5 - nx * 0.3, b.h, pz + nx * k * W2 / 4.5 - nz * 0.3);
        BM.add(tpl([[BOX, '#4a4f55', 0, 0, 0, 0, 0, 0, W2, 0.12, 0.12]]), px - nx * 0.3, b.h + 1.6, pz - nz * 0.3, Math.atan2(nx, nz));
        bb.push([mx, mz]); used++; count('billboard'); break; } } }

  // ---------- trees: three kinds, instanced per chunk
  { const trunkG = new THREE.CylinderGeometry(0.14, 0.24, 1, 5, 1, true); trunkG.translate(0, 0.5, 0);
    const roundG = new THREE.IcosahedronGeometry(1, 0); const poplarG = new THREE.IcosahedronGeometry(1, 0); const fruitG = new THREE.IcosahedronGeometry(1, 0);
    const trunkM = new THREE.MeshStandardMaterial({ color: '#6e5238', roughness: 1 }), leafM = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.9, flatShading: true });
    const groups = new Map();
    for (const t of trees) { const k = Math.floor(t[0] / 280) + ':' + Math.floor(t[1] / 280); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); collider.add([[t[0] - .3, t[1] - .3], [t[0] + .3, t[1] - .3], [t[0] + .3, t[1] + .3], [t[0] - .3, t[1] + .3]], { tree: true, h: 99 }); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    for (const list of groups.values()) {
      const byType = [[], [], []]; for (const t of list) byType[t[2]].push(t);
      const tr = new THREE.InstancedMesh(trunkG, trunkM, list.length); let ti = 0;
      byType.forEach((L, type) => { if (!L.length) return; const im = new THREE.InstancedMesh(type === 0 ? roundG : type === 1 ? poplarG : fruitG, leafM, L.length);
        L.forEach(([x, z, , sc, cr], i) => { const ry = cr * 6.28;
          if (type === 0) { const H = 3.2 * sc; tr.setMatrixAt(ti++, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, ry), s.set(sc, H, sc))); im.setMatrixAt(i, m4.compose(v.set(x, H + 2.2 * sc, z), q, s.set(2.8 * sc, 2.4 * sc, 2.8 * sc))); }
          else if (type === 1) { const H = 2.5 * sc; tr.setMatrixAt(ti++, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, ry), s.set(sc, H, sc))); im.setMatrixAt(i, m4.compose(v.set(x, H + 6 * sc, z), q, s.set(1.5 * sc, 7 * sc, 1.5 * sc))); }
          else { const H = 1.4 * sc; tr.setMatrixAt(ti++, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, ry), s.set(0.6 * sc, H, 0.6 * sc))); im.setMatrixAt(i, m4.compose(v.set(x, H + 1.1 * sc, z), q, s.set(1.6 * sc, 1.3 * sc, 1.6 * sc))); }
          im.setColorAt(i, c.set(TREEC[(cr * (type === 2 ? 4 : TREEC.length)) | 0]).offsetHSL(0, 0, (hash(x) - 0.5) * 0.08)); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); });
      tr.count = ti; tr.castShadow = true; tr.computeBoundingSphere(); root.add(tr);
    }
    count('trees', trees.length); }

  // ---------- plaques "Bl. X · Sc. A" next to each entrance: one atlas, one merged mesh
  if (plaques.length) {
    const cols = 8, cw = 256, chh = 64, rows = Math.ceil(Math.min(plaques.length, 512) / cols);
    const atlas = canvasTex(cols * cw, rows * chh, (g) => { plaques.slice(0, 512).forEach((p, i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * chh;
      g.fillStyle = '#1d4f91'; g.fillRect(x + 2, y + 2, cw - 4, chh - 4); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x + 7, y + 7, cw - 14, chh - 14);
      g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.text, x + cw / 2, y + chh / 2 + 2, cw - 24); }); });
    const pos = [], uv = [], nor = [];
    plaques.slice(0, 512).forEach((p, i) => { const u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows;
      const w = 0.9, h = 0.225, y = 2.1, c = Math.cos(p.a), s = Math.sin(p.a), ex = c, ez = -s;   // along the wall
      const nx = Math.sin(p.a), nz = Math.cos(p.a);
      const A = [p.x - ex * w / 2, y - h / 2, p.z - ez * w / 2], Bq = [p.x + ex * w / 2, y - h / 2, p.z + ez * w / 2], C = [p.x + ex * w / 2, y + h / 2, p.z + ez * w / 2], Dq = [p.x - ex * w / 2, y + h / 2, p.z - ez * w / 2];
      for (const [P, U] of [[A, [u0, v0]], [Bq, [u1, v0]], [C, [u1, v1]], [A, [u0, v0]], [C, [u1, v1]], [Dq, [u0, v1]]]) { pos.push(...P); uv.push(...U); nor.push(nx, 0, nz); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.computeBoundingSphere();
    root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })));
    count('plaques', Math.min(512, plaques.length));
  }

  B.finish(root); BM.finish(root); BS.finish(root); BF.finish(root); BN.finish(root);
  // small clutter only near the camera (it is sub-pixel further away anyway)
  const cullList = [];
  for (const [bt, d] of [[B, 300], [BM, 260], [BS, 190], [BF, 200], [BN, 200]]) for (const m of bt.out || []) cullList.push([m, m.geometry.boundingSphere, d * (LOW ? 0.7 : 1)]);
  for (const o of world.children) if (o.userData.cullDist && o.geometry) { if (!o.boundingSphere) o.computeBoundingSphere?.(); if (o.boundingSphere) cullList.push([o, o.boundingSphere, o.userData.cullDist * (LOW ? 0.7 : 1)]); }
  const cull = (cam) => { for (const [m, bs, d] of cullList) m.visible = Math.hypot(bs.center.x - cam.x, bs.center.z - cam.z) - bs.radius < d; };
  // hide small clutter far away: detail meshes get a shorter draw distance via their own layer of culling (bounding spheres per 200 m chunk)
  console.log('[details]', JSON.stringify(stats), JSON.stringify(Object.fromEntries(Object.entries(TRI).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => b[1] - a[1]))));
  return { metroOut, stats, cull };
}
