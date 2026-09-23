import * as THREE from 'three';
import { pick, rand } from './world.js';

const SPH = new THREE.SphereGeometry(1, 24, 16);
const SPL = new THREE.SphereGeometry(1, 12, 8);   // low-poly for NPCs
const SKIN_TONE = '#a8836b';
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m;
}
const matCache = {};
function mat(color, rough = 0.8, extra = {}) {
  const k = color + rough + JSON.stringify(extra);
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
}

// ---------------- Humanoid rig (shared by Câmpi and NPCs)
// Pivots: hips, legs (upper), arms (upper). Faces +Z.
export function makeHuman({ shirt = '#ffd23f', pants = '#35518a', skin = '#e9bf9c', shoes = '#f2f2f2', hair = '#3a2a20', scale = 0.86, headScale = 1, female = false, extra } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 8);
  const legs = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.17, 0.95, 0);
    p.add(mesh(CAP(0.13, 0.62), mat(pants), 0, -0.42, 0));
    p.add(mesh(SPL, mat(shoes, 0.6), 0, -0.9, 0.07, 0.13, 0.09, 0.22));
    body.add(p); return p;
  });
  const torso = mesh(CAP(female ? 0.26 : 0.29, 0.5), mat(shirt), 0, 1.33, 0); torso.scale.set(1, 1, 0.72); body.add(torso);
  if (female) body.add(mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.55, 12), mat(pants), 0, 0.92, 0));
  const arms = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.36, 1.6, 0);
    p.add(mesh(CAP(0.095, 0.52), mat(shirt), 0, -0.3, 0));
    p.add(mesh(SPL, mat(skin, 0.7), 0, -0.64, 0, 0.09, 0.1, 0.09));
    body.add(p); return p;
  });
  const neck = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 10), mat(skin, 0.7), 0, 1.72, 0); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.86 + 0.235 * headScale, 0); head.scale.setScalar(headScale); body.add(head);
  neck.position.y = 1.8;
  root.userData = { body, legs, arms, head, torso, walk: 0 };
  root.scale.setScalar(scale);
  return root;
}
export function simpleHead(head, { skin = '#e9bf9c', hair = '#3a2a20', bald = false, scarf = null, cap = null, beard = false, glasses = false } = {}) {
  head.add(mesh(SPL, mat(skin, 0.7), 0, 0, 0, 0.19, 0.23, 0.2));
  // eyes
  [-1, 1].forEach(s => { head.add(mesh(SPL, mat('#111', 0.3), s * 0.07, 0.03, 0.18, 0.022, 0.026, 0.01)); });
  head.add(mesh(SPL, mat(skin, 0.7), 0, -0.01, 0.2, 0.03, 0.05, 0.04)); // nose
  head.add(mesh(new THREE.BoxGeometry(0.08, 0.012, 0.01), mat('#7a3b3b'), 0, -0.1, 0.19));
  if (!bald && !scarf) head.add(mesh(SPL, mat(hair, 0.95), 0, 0.07, -0.03, 0.205, 0.19, 0.21));
  if (scarf) { head.add(mesh(SPL, mat(scarf, 0.9), 0, 0.04, -0.02, 0.215, 0.24, 0.22)); head.add(mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(scarf, .9), 0, -0.2, -0.12)); }
  if (cap) { head.add(mesh(SPL, mat(cap, .8), 0, 0.12, 0, 0.205, 0.13, 0.21)); head.add(mesh(new THREE.BoxGeometry(0.2, 0.02, 0.16), mat(cap, .8), 0, 0.11, 0.2)); }
  if (beard) head.add(mesh(SPL, mat(hair, .95), 0, -0.12, 0.08, 0.17, 0.12, 0.14));
  if (glasses) [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 16), mat('#222', .3)); r.position.set(s * 0.075, 0.03, 0.2); head.add(r); });
}

// ---------------- Câmpi's real 3D face (3DMM fit from 5 photos) + natural hair + real ears + separate 3D glasses
function strandTex(base, grey) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const x = Math.random() * 256, y = Math.random() * 256, L = 20 + Math.random() * 60;
    g.strokeStyle = Math.random() < grey ? `rgba(190,180,170,${0.25 + Math.random() * .3})` : `rgba(${20 + Math.random() * 40},${15 + Math.random() * 25},${10 + Math.random() * 20},${0.35 + Math.random() * .4})`;
    g.lineWidth = 0.6 + Math.random() * 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (Math.random() - .5) * 10, y - L / 2, x + (Math.random() - .5) * 14, y - L); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function lockGeometry() {
  // a tapered, flattened, curved lock of hair along +Y
  const g = new THREE.CylinderGeometry(0.018, 0.036, 0.15, 7, 6, false); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.08, t = y / 0.16; p.setZ(i, p.getZ(i) * 0.38 - t * t * 0.07); p.setX(i, p.getX(i) + Math.sin(t * 2.2) * 0.012); p.setY(i, y); }
  g.computeVertexNormals(); return g;
}
function earShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.03); s.bezierCurveTo(0.03, -0.035, 0.036, 0.0, 0.03, 0.035); s.bezierCurveTo(0.024, 0.062, -0.012, 0.066, -0.02, 0.04);
  s.bezierCurveTo(-0.024, 0.02, -0.012, 0.01, -0.012, -0.005); s.bezierCurveTo(-0.012, -0.022, -0.02, -0.04, 0, -0.03);
  return s;
}
export async function makeCampiHead(head, S = 0.42) {
  const meta = await (await fetch('assets/face.json')).json();
  const buf = await (await fetch('assets/face.bin')).arrayBuffer();
  const nv = meta.nv, nt = meta.nt, nm = (meta.morphs || ['grimace', 'smile']).length; let o = 0;
  const F = (n) => { const a = new Float32Array(buf, o, n); o += n * 4; return a; };
  const pos = F(nv * 3), morphs = []; for (let i = 0; i < nm; i++) morphs.push(F(nv * 3));
  const uv = F(nv * 2); const idx = new Uint16Array(buf, o, nt * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.morphAttributes.position = morphs.map(m => new THREE.BufferAttribute(m, 3)); g.morphTargetsRelative = true;
  g.computeVertexNormals();
  const tex = new THREE.TextureLoader().load('assets/face_tex.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const skinMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.1 });
  const H = new THREE.Group(); H.scale.setScalar(S / 0.42); head.add(H);        // everything below is authored for a 0.42-wide face
  const FS = 0.42;
  const face = new THREE.Mesh(g, skinMat); face.castShadow = true; face.scale.setScalar(FS); face.position.set(0, 0.02, 0.07); H.add(face);
  const kp = meta.kp.map(p => new THREE.Vector3(p[0] * FS, p[1] * FS + 0.02, p[2] * FS + 0.07));
  const SKIN = '#c29680';
  const skin = mat(SKIN, 0.65);
  H.add(mesh(SPH, skin, 0, -0.03, -0.095, 0.203, 0.235, 0.2));                                // skull behind the face mask
  { const m = new THREE.Vector3(); for (let i = 48; i < 68; i++) m.add(kp[i]); m.multiplyScalar(1 / 20);
    H.add(mesh(SPH, mat('#3a1414', 0.9), m.x, m.y - 0.005, m.z - 0.1, 0.065, 0.04, 0.05)); }       // mouth cavity
  // ears: real ear silhouette, extruded + bevel, set at jaw-line height
  const earG = new THREE.ExtrudeGeometry(earShape(), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 3, curveSegments: 10 });
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(earG, skin); e.scale.set(sd * 1.15, 1.15, 1.15);
    const j = kp[sd < 0 ? 1 : 15]; e.position.set(sd * 0.2, j.y + 0.035, -0.05); e.rotation.y = sd * 1.35; e.rotation.z = sd * 0.08; e.castShadow = true; H.add(e); });
  // hair: short sides with grey temples, swept-up messy top (like the photos)
  const sideTex = strandTex('#4a3c33', 0.45), topTex = strandTex('#3f3229', 0.12);
  const sideM = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9, color: '#b8aca0' });
  const topM = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.85, color: '#c4b4a4', side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.78), sideM);
  cap.scale.set(0.212, 0.232, 0.21); cap.position.set(0, 0.035, -0.115); cap.rotation.x = -1.1; H.add(cap);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), topM);
  top.scale.set(0.19, 0.075, 0.19); top.position.set(0, 0.225, -0.06); H.add(top);
  const lockG = lockGeometry();
  let n = 0;
  for (let i = 0; i < 800 && n < 150; i++) {
    const u = Math.random(), v = Math.random();
    const x = (u - 0.5) * 0.3, zf = 0.08 - v * 0.28;                 // front (z=+0.08) to back
    if (x * x / 0.024 + (zf + 0.06) ** 2 / 0.03 > 1) continue;
    const y = 0.2 + 0.07 * Math.cos(x * 7) * (1 - Math.abs(zf + 0.05) * 2.5);
    const l = new THREE.Mesh(lockG, topM);
    l.position.set(x, y, zf);
    const front = (zf + 0.2) / 0.28;                                  // 1 at the front, 0 at the back
    l.rotation.set(-0.9 - (1 - front) * 0.9 + rand(-0.3, 0.3), rand(-0.5, 0.5), x * -4 + rand(-0.3, 0.3));
    const sc = 0.55 + front * 0.45 + rand(-0.1, 0.15); l.scale.set(rand(1.0, 1.5), sc, 1.2);
    l.castShadow = true; H.add(l); n++;
  }
  // separate 3D aviator glasses from eye keypoints (68-pt: 36-41 right eye, 42-47 left eye)
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 1, roughness: 0.25 });
  const lensM = new THREE.MeshPhysicalMaterial({ color: '#e6eef2', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, depthWrite: false });
  const eyeC = (a, b) => { const c = new THREE.Vector3(); for (let i = a; i <= b; i++) c.add(kp[i]); return c.multiplyScalar(1 / (b - a + 1)); };
  const eR = eyeC(36, 41), eL = eyeC(42, 47), zFront = Math.max(eR.z, eL.z) + 0.04;
  const lensShape = () => { const s = new THREE.Shape(); const w = 0.058, h = 0.046;
    s.moveTo(-w, h * 0.75); s.lineTo(w * 0.8, h * 0.85); s.quadraticCurveTo(w * 1.05, h * 0.8, w, h * 0.3);
    s.quadraticCurveTo(w * 0.85, -h * 1.05, 0.005, -h * 1.02); s.quadraticCurveTo(-w * 0.9, -h * 0.95, -w, h * 0.75); return s; };
  const glasses = new THREE.Group();
  [[eR, -1], [eL, 1]].forEach(([e, s]) => {
    const sh = lensShape(); const pts = sh.getPoints(48).map(p => new THREE.Vector3(p.x * -s, p.y, 0));
    const ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 72, 0.0028, 5, true), gold);
    ring.position.set(e.x + s * 0.006, e.y - 0.002, zFront); glasses.add(ring);
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(sh), lensM); lens.scale.x = -s; lens.position.copy(ring.position); glasses.add(lens);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 5), gold);
    arm.position.set(e.x + s * 0.07, e.y + 0.022, zFront - 0.1); arm.rotation.x = Math.PI / 2; glasses.add(arm);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), lensM); pad.position.set(e.x - s * 0.045, e.y - 0.03, zFront - 0.012); glasses.add(pad);
  });
  const bw = Math.abs(eL.x - eR.x) * 0.55;
  const bridgeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, bw * 1.25, 5), gold);
  bridgeTop.rotation.z = Math.PI / 2; bridgeTop.position.set((eR.x + eL.x) / 2, (eR.y + eL.y) / 2 + 0.041, zFront + 0.002); glasses.add(bridgeTop);
  const bridgeLow = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, bw * 0.55, 5), gold);
  bridgeLow.rotation.z = Math.PI / 2; bridgeLow.position.set((eR.x + eL.x) / 2, (eR.y + eL.y) / 2 + 0.018, zFront + 0.004); glasses.add(bridgeLow);
  H.add(glasses);
  const inf = face.morphTargetInfluences;
  return { face, H, setExpr(grim = 0, smile = 0, open = 0, oo = 0) { inf[0] = grim; inf[1] = smile; if (inf.length > 2) { inf[2] = open; inf[3] = oo; } } };
}

// ---------------- Câmpi's body: rigged humanoid (Mixamo X Bot from the three.js examples) recoloured to his clothes
export async function makeCampiBody() {
  const { GLTFLoader } = await import('../lib/addons/loaders/GLTFLoader.js');
  const { mergeVertices } = await import('../lib/addons/utils/BufferGeometryUtils.js');
  const gltf = await new GLTFLoader().loadAsync(window.__BODY || 'assets/Xbot.glb');
  const root = gltf.scene;
  const COL = { shirt: new THREE.Color('#f2c318'), skin: new THREE.Color('#c99a80'), pants: new THREE.Color('#1f2a44'), shoe: new THREE.Color('#f4f4f2'), sole: new THREE.Color('#d8d8d8') };
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (/visor/i.test(o.name)) { o.visible = false; return; }
    o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
    const upZ = bb.max.z - bb.min.z > (bb.max.y - bb.min.y) * 1.5;         // Soldier is authored Z-up, X Bot Y-up
    const k = 1.8 / (upZ ? bb.max.z - bb.min.z : bb.max.y - bb.min.y);     // normalise to a 1.8 m person
    const p = o.geometry.attributes.position, c = new Float32Array(p.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = Math.abs(p.getX(i)) * k, y = ((upZ ? p.getZ(i) : p.getY(i)) - (upZ ? bb.min.z : bb.min.y)) * k;
      let col;
      if (y < 0.035) col = COL.sole; else if (y < 0.11) col = COL.shoe;
      else if (y < 1.04) col = COL.pants;
      else if (x > 0.3) col = COL.skin;                 // forearms + hands (T-pose: arms along X)
      else if (x > 0.13 && y > 1.3) col = COL.shirt;    // short sleeves
      else if (y < 1.47) col = COL.shirt; else col = COL.skin;
      tmp.copy(col); c.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    // weld the mannequin's plates and smooth them so it reads as cloth, then inflate clothes slightly
    { // smooth normals across coincident vertices without touching topology or skin weights
      const nrm = o.geometry.attributes.normal, map = new Map(), q = 0.002 / k;
      for (let i = 0; i < p.count; i++) { const key = Math.round(p.getX(i) / q) + ',' + Math.round(p.getY(i) / q) + ',' + Math.round(p.getZ(i) / q); let a = map.get(key); if (!a) map.set(key, a = [0, 0, 0, []]); a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); a[3].push(i); }
      for (const a of map.values()) { const L = Math.hypot(a[0], a[1], a[2]) || 1; for (const i of a[3]) nrm.setXYZ(i, a[0] / L, a[1] / L, a[2] / L); }
      nrm.needsUpdate = true; }
    const inflS = (0.016 / k).toFixed(5), inflP = (0.008 / k).toFixed(5);
    o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    o.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(objectNormal) * (vColor.r > 0.8 && vColor.b < 0.3 ? ' + inflS + ' : (vColor.b > vColor.r * 1.4 ? ' + inflP + ' : 0.0));'); };
    o.castShadow = true; o.frustumCulled = false;
  });
  // Replace the mannequin shell with clothes-shaped parts parented to the animated skeleton (clean male silhouette)
  root.traverse(o => { if (o.isSkinnedMesh) o.visible = false; });
  const B = (n) => root.getObjectByName('mixamorig' + n);
  const M = { shirt: new THREE.MeshStandardMaterial({ color: '#f2c318', roughness: 0.9 }), skin: new THREE.MeshStandardMaterial({ color: '#c79a80', roughness: 0.7 }),
    pants: new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.85 }), shoe: new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.6 }) };
  const seg = (from, to, r0, r1, mat, { sx = 1, sz = 1, t0 = 0, t1 = 1, extra = 0 } = {}) => {
    const a = B(from), b = B(to); if (!a || !b) return;
    const d = b.position.clone(); const L = d.length(); d.normalize();
    const len = L * (t1 - t0) + extra;
    const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1, false); // (top, bottom)
    const cap0 = new THREE.SphereGeometry(r0, 14, 8), cap1 = new THREE.SphereGeometry(r1, 14, 8);
    const grp = new THREE.Group(); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); grp.position.copy(b.position).multiplyScalar(t0 + (t1 - t0) / 2);
    const m = new THREE.Mesh(g, mat); const c0 = new THREE.Mesh(cap0, mat), c1 = new THREE.Mesh(cap1, mat); c0.position.y = -len / 2; c1.position.y = len / 2;
    for (const x of [m, c0, c1]) { x.castShadow = true; grp.add(x); }
    grp.scale.set(sx, 1, sz); a.add(grp); return grp;
  };
  // units are centimetres (Mixamo bones)
  seg('Hips', 'Spine', 15.5, 15, M.pants, { sx: 1.08, sz: 0.74 });
  seg('Spine', 'Spine1', 16.2, 16.2, M.shirt, { sx: 1.09, sz: 0.76, t0: -0.9 });
  seg('Spine1', 'Spine2', 15.8, 16.8, M.shirt, { sx: 1.15, sz: 0.7 });
  seg('Spine2', 'Neck', 16.5, 11, M.shirt, { sx: 1.3, sz: 0.68, t1: 0.55 });
  seg('Neck', 'Head', 5.6, 5.2, M.skin, { t0: -0.4, extra: 3 });
  for (const S of ['Left', 'Right']) {
    seg(S + 'Shoulder', S + 'Arm', 7.5, 7.2, M.shirt, { t0: 0.15 });
    seg(S + 'Arm', S + 'ForeArm', 7.2, 6.4, M.shirt, { t1: 0.5 });            // short sleeve
    seg(S + 'Arm', S + 'ForeArm', 5.2, 4.5, M.skin, { t0: 0.45 });
    seg(S + 'ForeArm', S + 'Hand', 4.4, 3.2, M.skin);
    const h = B(S + 'Hand'); if (h) { const hm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.skin); hm.scale.set(3.6, 6.5, 1.8); hm.position.y = 5; hm.castShadow = true; h.add(hm); }
    seg(S + 'UpLeg', S + 'Leg', 9.6, 7.2, M.pants);
    seg(S + 'Leg', S + 'Foot', 7.0, 5.6, M.pants);
    const f = B(S + 'Foot'), toe = B(S + 'ToeBase');
    if (f && toe) { const d = toe.position.clone(); const shoe = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7, 1, 1, 1, 1), M.shoe);
      const sg = new THREE.Group(); sg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); sg.position.copy(d).multiplyScalar(0.55);
      const sm = new THREE.Mesh(new THREE.CapsuleGeometry(5, d.length() * 1.1, 4, 10), M.shoe); sm.scale.set(1, 1, 0.75); sm.castShadow = true; sg.add(sm); f.add(sg); }
  }
  const headBone = root.getObjectByName('mixamorigHead'), neck = root.getObjectByName('mixamorigNeck');
  headBone.scale.setScalar(0.0001);                   // hide the mannequin head; Câmpi's head goes on top
  const headMount = new THREE.Group(); neck.add(headMount);
  const headInner = new THREE.Group(); headInner.scale.setScalar(100); headMount.add(headInner);   // bones are in cm
  const mixer = new THREE.AnimationMixer(root);
  const actions = {}; for (const clip of gltf.animations) { clip.tracks = clip.tracks.filter(t => !/mixamorigHead(Top_End)?\.scale/.test(t.name)); actions[clip.name.toLowerCase()] = mixer.clipAction(clip); }
  for (const k of ['idle', 'walk', 'run']) { actions[k].play(); actions[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
  return { root, mixer, actions, headBone, headMount, headInner };
}
// ---------------- Walk animation
export function animateHuman(h, speed, dt, t, extra = {}) {
  const u = h.userData; u.walk += dt * (2 + speed * 1.9);
  const a = Math.min(1, speed / 3) * 0.75 + Math.min(0.35, speed / 12);
  u.legs[0].rotation.x = Math.sin(u.walk) * a; u.legs[1].rotation.x = -Math.sin(u.walk) * a;
  if (!extra.armsBusy) { u.arms[0].rotation.x = -Math.sin(u.walk) * a * 0.8; u.arms[1].rotation.x = Math.sin(u.walk) * a * 0.8; u.arms[0].rotation.z = 0.08; u.arms[1].rotation.z = -0.08; }
  u.body.position.y = speed > 0.3 ? Math.abs(Math.sin(u.walk)) * 0.06 * Math.min(1, speed / 4) : Math.sin(t * 1.6) * 0.008;
  u.body.rotation.x = Math.min(0.25, speed * 0.02);
}

// ---------------- Moo Deng
export function makeMooDeng() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const hip = new THREE.MeshPhysicalMaterial({ color: '#8a7580', roughness: 0.35, clearcoat: 1 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#5e4d58', roughness: 0.4, clearcoat: .8 });
  const pink = new THREE.MeshPhysicalMaterial({ color: '#e7a0a4', roughness: 0.4, clearcoat: .6 });
  b.add(mesh(SPH, hip, 0, 0.55, 0, 0.5, 0.42, 0.72)); b.add(mesh(SPH, pink, 0, 0.38, -0.05, 0.42, 0.25, 0.6));
  const head = new THREE.Group(); head.position.set(0, 0.7, 0.68); b.add(head);
  head.add(mesh(SPH, hip, 0, 0, 0, 0.38, 0.32, 0.38)); head.add(mesh(SPH, dark, 0, -0.07, 0.3, 0.36, 0.26, 0.26));
  [-1, 1].forEach(s => { head.add(mesh(SPH, pink, s * .22, -.1, .24, .12, .11, .11)); head.add(mesh(SPH, mat('#111', .2), s * .09, .1, .5, .04, .03, .04));
    head.add(mesh(SPH, mat('#111', .2), s * .18, .16, .26, .045, .045, .03)); head.add(mesh(SPH, dark, s * .2, .28, 0, .06, .07, .04)); });
  const legs = [[-.3, -.4], [.3, -.4], [-.3, .4], [.3, .4]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.4, z); p.add(mesh(new THREE.CylinderGeometry(.13, .11, .42, 10), dark, 0, -.2, 0)); b.add(p); return p; });
  g.userData = { b, head, legs, walk: 0 };
  return g;
}
export function animateHippo(h, speed, dt) {
  const u = h.userData; u.walk += dt * (3 + speed * 3);
  u.legs.forEach((l, i) => l.rotation.x = Math.sin(u.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * Math.min(0.8, speed * 0.2));
  u.b.position.y = Math.abs(Math.sin(u.walk)) * Math.min(0.08, speed * 0.02);
}

// ---------------- Maidanez (stray dog)
export function makeDog() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const c = mat(pick(['#b58a5a', '#d9c9a8', '#4a3a2a', '#8c7a66', '#c8a070']), 0.95);
  b.add(mesh(SPL, c, 0, 0.45, 0, 0.18, 0.18, 0.38));
  const head = mesh(SPL, c, 0, 0.62, 0.4, 0.14, 0.13, 0.16); b.add(head);
  b.add(mesh(SPL, c, 0, 0.58, 0.55, 0.07, 0.06, 0.09)); b.add(mesh(SPL, mat('#111', .3), 0, 0.6, 0.63, .025, .02, .02));
  [-1, 1].forEach(s => b.add(mesh(new THREE.ConeGeometry(.04, .1, 4), c, s * .08, .76, .38)));
  const tail = mesh(new THREE.CylinderGeometry(.02, .03, .3, 5), c, 0, .6, -.42); tail.rotation.x = -0.8; b.add(tail);
  const legs = [[-.1, -.25], [.1, -.25], [-.1, .25], [.1, .25]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, .35, z); p.add(mesh(new THREE.CylinderGeometry(.035, .03, .35, 5), c, 0, -.17, 0)); b.add(p); return p; });
  g.userData = { b, legs, tail, walk: rand(0, 6) };
  return g;
}
export function animateDog(d, speed, dt, t) {
  const u = d.userData; u.walk += dt * (4 + speed * 2.5);
  u.legs.forEach((l, i) => l.rotation.x = Math.sin(u.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * Math.min(0.9, speed * 0.15));
  u.tail.rotation.z = Math.sin(t * 12) * 0.5;
  u.b.position.y = Math.abs(Math.sin(u.walk)) * Math.min(0.06, speed * 0.01);
}

// ---------------- Moving car (Dacia-ish)
export function makeCar(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: color || pick(['#f4f4f4', '#d7263d', '#1b4f9c', '#c0c0c0', '#222', '#f2a900', '#2e8b57']), roughness: .35, metalness: .3 });
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.75, 4.3), paint, 0, 0.62, 0));
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.62, 2.2), paint, 0, 1.3, -0.1));
  const glass = mat('#9fc3d6', 0.1, { metalness: .4 });
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 0.05), glass, 0, 1.32, 1.01)); g.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 0.05), glass, 0, 1.32, -1.21));
  [[-.9, 1.3], [.9, 1.3], [-.9, -1.3], [.9, -1.3]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(.34, .34, .25, 12), mat('#161616'), x, .34, z); w.rotation.z = Math.PI / 2; g.add(w); });
  [-.6, .6].forEach(x => { g.add(mesh(new THREE.BoxGeometry(.3, .15, .05), new THREE.MeshBasicMaterial({ color: '#fff6c8' }), x, .72, 2.16)); g.add(mesh(new THREE.BoxGeometry(.3, .15, .05), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), x, .8, -2.16)); });
  return g;
}
