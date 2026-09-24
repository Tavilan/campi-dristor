import * as THREE from 'three';
import { buildWorld, Collider, canvasTex, pick, rand, signMaterial } from './world.js';
import { buildDetails } from './details.js';
import { makeHuman, simpleHead, makeCampiHead, makeCampiBody, makeRigCharacter, animateHuman, makeMooDeng, animateHippo, makeDog, animateDog, makeCar } from './characters.js';
import { MISSIONS, NPC_DEFS, PED_LINES, DOG_BITES, CAR_HITS } from './content.js';
import { SPEAKERS, speakerKey } from './voices.js';
import { lineId } from './slug.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------------- Renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
// ---------------- Time of day: golden-hour sunset (default) or night
const QUALITY = (isTouch && (navigator.hardwareConcurrency || 4) <= 4) || /quality=low/.test(location.search) ? 'low' : 'high';
const SKY = {
  sunset: canvasTex(4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b4a86'); gr.addColorStop(0.35, '#7b77b0'); gr.addColorStop(0.55, '#e8a07a'); gr.addColorStop(0.68, '#ffc98a'); gr.addColorStop(1, '#f3d2b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  night: canvasTex(256, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#040814'); gr.addColorStop(0.55, '#101a36'); gr.addColorStop(0.7, '#2a2440'); gr.addColorStop(1, '#3a2c2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .8})`; g.fillRect(Math.random() * w, Math.random() * h * 0.55, 1, 1); } }),
};
scene.fog = new THREE.Fog('#e9bfa0', 80, 430);
const camera = new THREE.PerspectiveCamera(60, 1, 0.25, 470);
const hemi = new THREE.HemisphereLight('#ffe2c4', '#6a6070', 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffb070', 2.8);
const SUN_OFF = new THREE.Vector3(-110, 48, 60);           // low sun from the west = long shadows
const nightLights = []; for (let i = 0; i < (QUALITY === 'low' ? 4 : 8); i++) { const l = new THREE.PointLight('#ffb45a', 0, 22, 1.6); scene.add(l); nightLights.push(l); }
let NIGHT = false;
function setTimeOfDay(night) {
  NIGHT = night;
  scene.background = night ? SKY.night : SKY.sunset;
  scene.fog.color.set(night ? '#1a1a2a' : '#ebc9ae'); scene.fog.near = night ? 40 : 80; scene.fog.far = night ? 300 : 430;
  hemi.color.set(night ? '#6d7fb8' : '#ffe2c4'); hemi.groundColor.set(night ? '#1b1820' : '#6a6070'); hemi.intensity = night ? 0.35 : 1.35;
  sun.color.set(night ? '#8fa8ff' : '#ffb070'); sun.intensity = night ? 0.35 : 3.1; SUN_OFF.set(night ? 60 : -110, night ? 90 : 48, night ? -40 : 60);
  renderer.toneMappingExposure = night ? 1.25 : 1.0;
  if (W) W.setNight(night);
  $('bNight') && ($('bNight').textContent = night ? '☀️' : '🌙');
}
sun.castShadow = true; sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 60; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------- State
const state = { money: 23, inv: {}, mission: 'geta', flags: {}, coins: 0, follower: false, t0: 0, bites: 0, hits: 0, spins: 0, done: false };
let W = null; const npcs = []; const peds = []; const dogs = []; const cars = []; const coins = [];
const P = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, speed: 0, run: true, ground: 0, hurt: 0, knock: new THREE.Vector2(), scooter: false, lean: 0 };
let campi, campiHead, campiBody, mooDeng = null, beacon, targetMarker;
const LOC = {};
let DET = null, detT = 0;

// ---------------- Audio
let actx = null, master = null, muted = false, ttsOn = true, roVoice = null, voiceBus = null, analyser = null, lipBuf = null, campiLines = {}, npcLines = {}, npcBus = null, npcSrc = null, npcTok = 0, lip = 0;
const lineCache = {};
const voices = {};
function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain(); master.gain.value = 0.8; master.connect(actx.destination);
  voiceBus = actx.createGain(); analyser = actx.createAnalyser(); analyser.fftSize = 512; lipBuf = new Float32Array(512);
  voiceBus.connect(analyser); voiceBus.connect(master);
  npcBus = actx.createGain(); npcBus.gain.value = 1.25; npcBus.connect(master);
  fetch('assets/voice/npc/manifest.json').then(r => r.ok ? r.json() : {}).then(m => { npcLines = m; preloadSpeaker('geta'); }).catch(() => {});
  fetch('assets/voice/campi/manifest.json').then(r => r.ok ? r.json() : {}).then(m => { campiLines = m; for (const [id, f] of Object.entries(m)) preloadLine('assets/voice/campi/', id, f); }).catch(() => {});
  const man = { start: ['start.mp3'], sixseven: ['sixseven.mp3', 'sixseven2.mp3', 'sixseven3.mp3'], crash: ['crash.mp3', 'crash2.mp3'], laugh: ['laugh.mp3', 'full.mp3'], stutter: ['stutter.mp3'], zoomies: ['zoomies.mp3'] };
  for (const [k, fs] of Object.entries(man)) { voices[k] = []; fs.forEach(f => fetch('assets/voice/' + f).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).then(buf => voices[k].push(buf)).catch(() => {})); }
  ambience();
}
function playBuf(buf, { rate = 1, vol = 1.2, offset = 0, dur, bus } = {}) {
  if (!actx || !buf) return; const s = actx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = actx.createGain(); g.gain.value = vol; s.connect(g).connect(bus || master); dur ? s.start(0, offset, dur) : s.start(0, offset); return s;
}
// Câmpi speaking: his generated line if it exists (ElevenLabs, with his consent), otherwise babble from his real recording
async function campiSay(text) {
  const id = lineId(text.replace(/\s*\([^)]*\)\s*$/, '')), f = campiLines[id];
  if (f && actx) {
    if (actx.state !== 'running') actx.resume();
    const buf = await preloadLine('assets/voice/campi/', id, f);
    if (buf) { playBuf(buf, { vol: 1.3, bus: voiceBus }); return buf.duration; }
  }
  babble(); return 0;
}
function lipLevel() {
  if (!analyser) return 0.5 + 0.5 * Math.sin(T * 20);
  analyser.getFloatTimeDomainData(lipBuf); let s = 0; for (let i = 0; i < lipBuf.length; i++) s += lipBuf[i] * lipBuf[i];
  const target = clamp(Math.sqrt(s / lipBuf.length) * 9, 0, 1); lip += (target - lip) * 0.5; return lip;
}
function voice(k, opts) { const v = voices[k]; if (v && v.length) playBuf(pick(v), opts); }
function babble() { const v = voices.start?.[0]; if (!v) return; for (let i = 0; i < 3; i++) setTimeout(() => playBuf(v, { offset: rand(0, v.duration - 0.35), dur: 0.28, rate: rand(0.95, 1.15), vol: 0.9, bus: voiceBus }), i * 260); }
function tone(f, d, type = 'square', vol = 0.15, to = null, when = 0) {
  if (!actx) return; const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .05);
}
function noise(d, vol = .3, freq = 1200, type = 'lowpass', when = 0) {
  if (!actx) return; const t = actx.currentTime + when, b = actx.createBuffer(1, actx.sampleRate * d, actx.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  const s = actx.createBufferSource(); s.buffer = b; const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f).connect(g).connect(master); s.start(t);
}
const SFX = {
  coin: () => { tone(880, .08); tone(1320, .15, 'square', .12, null, .06); },
  cash: () => { tone(1500, .05, 'triangle', .2); tone(2000, .3, 'triangle', .15, null, .06); noise(.1, .2, 3000, 'highpass'); },
  lose: () => { tone(300, .25, 'sawtooth', .12, 150); },
  ding: () => { tone(1046, .12, 'sine', .25); tone(1568, .25, 'sine', .2, null, .12); },
  bark: () => { noise(.12, .5, 900, 'bandpass'); tone(420, .1, 'sawtooth', .15, 260); },
  bite: () => { noise(.2, .6, 700); tone(180, .2, 'square', .2, 80); },
  horn: () => { tone(415, .35, 'sawtooth', .12); tone(523, .35, 'sawtooth', .1); },
  hit: () => { noise(.4, .6, 600); tone(120, .3, 'square', .25, 40); },
  jump: () => tone(300, .18, 'sine', .15, 600),
  drill: () => { const o = actx && actx.createOscillator(); if (!o) return; const g = actx.createGain(), t = actx.currentTime; o.type = 'sawtooth'; o.frequency.value = 180; const l = actx.createOscillator(); l.frequency.value = 30; const lg = actx.createGain(); lg.gain.value = 60; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(.08, t); g.gain.setValueAtTime(.08, t + 1.2); g.gain.exponentialRampToValueAtTime(.001, t + 1.4); o.connect(g).connect(master); o.start(t); l.start(t); o.stop(t + 1.5); l.stop(t + 1.5); },
  manea: () => { const n = [0, 1, 4, 5, 7, 8, 7, 5, 4, 1, 0, 1, 4, 1, 0, -1]; n.forEach((s, i) => tone(330 * Math.pow(2, s / 12), .16, 'sawtooth', .07, null, i * .15)); for (let i = 0; i < 8; i++) { noise(.05, .15, 5000, 'highpass', i * .3); tone(70, .1, 'sine', .4, null, i * .3); } },
  spin: () => { for (let i = 0; i < 14; i++) tone(600 + i * 40, .04, 'square', .06, null, i * .07); },
  win: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, .18, 'square', .1, null, i * .08)); },
  finale: () => { [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, .3, 'square', .1, null, i * .16)); },
};
function ambience() { // soft city hum
  const b = actx.createBuffer(1, actx.sampleRate * 3, actx.sampleRate), a = b.getChannelData(0); let last = 0;
  for (let i = 0; i < a.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; a[i] = last * 3; }
  const s = actx.createBufferSource(); s.buffer = b; s.loop = true; const g = actx.createGain(); g.gain.value = 0.18; s.connect(g).connect(master); s.start();
  ambGain = g;
  // traffic rumble layer (louder next to the boulevards)
  const b2 = actx.createBuffer(1, actx.sampleRate * 4, actx.sampleRate), a2 = b2.getChannelData(0);
  for (let i = 0; i < a2.length; i++) a2[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / actx.sampleRate * 0.7));
  const s2 = actx.createBufferSource(); s2.buffer = b2; s2.loop = true; const f2 = actx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 260;
  trafficGain = actx.createGain(); trafficGain.gain.value = 0; s2.connect(f2).connect(trafficGain).connect(master); s2.start();
}
let ambGain = null, trafficGain = null, bigRoadPts = null, stepAcc = 0, onGrass = false, envT = 0, nextEvent = 8;
function panned(fn, pan = rand(-0.9, 0.9), vol = 0.35) {   // play an SFX quietly from a random side (distant event)
  if (!actx) return; const p = actx.createStereoPanner(), g = actx.createGain(); p.pan.value = pan; g.gain.value = vol; p.connect(g).connect(master);
  const old = master; master = p; try { fn(); } finally { master = old; }
}
function footstep(grass, run) {
  if (!actx) return; const t = actx.currentTime, d = 0.07, b = actx.createBuffer(1, actx.sampleRate * d, actx.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3);
  const s = actx.createBufferSource(); s.buffer = b; const f = actx.createBiquadFilter(); f.type = grass ? 'lowpass' : 'bandpass'; f.frequency.value = grass ? 900 : 1800 + Math.random() * 600;
  const g = actx.createGain(); g.gain.value = (grass ? 0.18 : 0.26) * (run ? 1.3 : 1); s.connect(f).connect(g).connect(master); s.start(t);
}
function updateEnvAudio(dt) {
  if (!actx || muted) return;
  envT -= dt;
  if (envT <= 0) { envT = 0.5;
    if (!bigRoadPts) { bigRoadPts = []; for (const r of W.roads) if (r.w >= 11) for (const p of r.pts) bigRoadPts.push(p); }
    let d = 1e9; for (const [x, z] of bigRoadPts) { const dd = (x - P.x) ** 2 + (z - P.z) ** 2; if (dd < d) d = dd; } d = Math.sqrt(d);
    trafficGain.gain.setTargetAtTime(clamp(1 - d / 90, 0, 1) * (NIGHT ? 0.25 : 0.55), actx.currentTime, 0.4);
    onGrass = W.areas.some(a => (a.k === 'park' || a.k === 'grass' || a.k === 'pitch') && Math.abs(a.pts[0][0] - P.x) < 400 && Collider.inside(a.pts, P.x, P.z));
  }
  // footsteps synced to speed
  if (!P.scooter && P.y <= P.ground + 0.05 && P.speed > 0.6) { stepAcc += P.speed * dt; const stride = P.speed > 5 ? 1.25 : 0.72; if (stepAcc > stride) { stepAcc = 0; footstep(onGrass, P.speed > 5); } }
  // distant life of the neighbourhood
  nextEvent -= dt;
  if (nextEvent <= 0) { nextEvent = rand(9, 22);
    const r = Math.random();
    if (r < 0.35) panned(() => SFX.bark(), undefined, 0.22);
    else if (r < 0.55) panned(() => SFX.manea(), undefined, 0.12);
    else if (r < 0.7) panned(() => SFX.horn(), undefined, 0.15);
    else if (r < 0.8 && !NIGHT) panned(() => SFX.drill(), undefined, 0.2);
    else if (tram && Math.hypot(tram.obj.position.x - P.x, tram.obj.position.z - P.z) < 120) panned(() => { tone(1318, 0.25, 'sine', 0.3); tone(1318, 0.25, 'sine', 0.3, null, 0.35); }, undefined, 0.4);
  }
}
// best Romanian system voice: prefer the higher-quality (Enhanced / Premium / Google / neural) variants
function pickVoice() {
  const vs = (speechSynthesis?.getVoices?.() || []).filter(v => /^ro/i.test(v.lang));
  const score = v => (/premium/i.test(v.name) ? 4 : 0) + (/enhanced|îmbunătățit|neural|natural|online/i.test(v.name) ? 3 : 0) + (/google|microsoft/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  roVoice = vs.sort((a, b) => score(b) - score(a))[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// Phones (iOS especially) only allow sound that is started from a tap: unlock WebAudio and speech on the first taps
let speechUnlocked = false;
function unlockAudio() {
  if (actx) { if (actx.state !== 'running') actx.resume(); const b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0); }
  if (!speechUnlocked && 'speechSynthesis' in window) { pickVoice(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'ro-RO'; speechSynthesis.speak(u); speechUnlocked = true; }
}
['touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, () => { if (actx && actx.state !== 'running') actx.resume(); if (!speechUnlocked) unlockAudio(); }, { passive: true }));
// fetch + decode voice lines ahead of time, so the first line of a dialogue isn't lost while it downloads
function preloadLine(dir, id, f) { if (actx && f && !lineCache[id]) lineCache[id] = fetch(dir + f).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).catch(() => null); return lineCache[id]; }
function preloadSpeaker(key) { for (const [id, f] of Object.entries(npcLines)) if (id.startsWith(key + '_')) preloadLine('assets/voice/npc/', id, f); }
function stopNpcVoice() { npcTok++; try { npcSrc?.stop(); } catch (e) {} npcSrc = null; try { speechSynthesis?.cancel(); } catch (e) {} }
// NPC speaking: their ElevenLabs line if generated (assets/voice/npc), otherwise the phone's Romanian voice
async function speak(text, who) {
  stopNpcVoice();
  if (!ttsOn || muted) return;
  const key = speakerKey(who), id = key + '_' + lineId(text), f = npcLines[id], tok = npcTok;
  if (f && actx) {
    if (actx.state !== 'running') actx.resume();
    const buf = await preloadLine('assets/voice/npc/', id, f);
    if (buf) { if (tok === npcTok) npcSrc = playBuf(buf, { vol: 1, bus: npcBus }); return; }
  }
  if (!roVoice) pickVoice();
  if (!('speechSynthesis' in window) || tok !== npcTok) return;
  const sp = SPEAKERS[key] || {};
  // split on sentences so the system voice breathes between them instead of reading one long run-on
  const parts = text.replace(/\*[^*]+\*/g, '').replace(/\.\.\./g, ',').split(/(?<=[.!?])\s+/).filter(p => p.trim());
  for (const p of parts) {
    const u = new SpeechSynthesisUtterance(p); if (roVoice) u.voice = roVoice; u.lang = roVoice ? roVoice.lang : 'ro-RO';
    u.pitch = (sp.pitch || 1) + (/!/.test(p) ? 0.05 : 0); u.rate = (sp.rate || 1) * (/\?$/.test(p) ? 0.97 : 1);
    speechSynthesis.speak(u);
  }
}
$('bNight').onclick = (e) => { e.stopPropagation(); setTimeOfDay(!NIGHT); };
$('bMute').onclick = (e) => { e.stopPropagation(); muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; $('bMute').textContent = muted ? '🔇' : '🔊'; if (muted) stopNpcVoice(); };
$('bTTS').onclick = (e) => { e.stopPropagation(); ttsOn = !ttsOn; $('bTTS').style.opacity = ttsOn ? 1 : 0.4; toast(ttsOn ? (roVoice || Object.keys(npcLines).length ? 'Vocile NPC pornite' : 'Telefonul n-are voce în română instalată') : 'Vocile NPC oprite'); };

// ---------------- UI helpers
let toastT = 0;
function toast(t, ms = 2200) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
function bigmsg(t, color = '#ffd23f') { const el = $('bigmsg'); el.textContent = t; el.style.color = color; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function flash() { const f = $('flash'); f.style.opacity = .45; setTimeout(() => f.style.opacity = 0, 120); }
let phoneT = 0;
function phone(from, text, ms = 7000) { SFX.ding(); $('phFrom').textContent = from; $('phText').textContent = text; $('phone').classList.remove('hidden'); clearTimeout(phoneT); phoneT = setTimeout(() => $('phone').classList.add('hidden'), ms); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); }
function updateHUD() {
  $('money').textContent = `💰 ${state.money} lei`; $('coinN').textContent = state.coins;
  const m = MISSIONS[state.mission]; $('mission').innerHTML = m ? `<b>MISIUNE:</b> ${m.title}` : '';
  $('inv').innerHTML = Object.values(state.inv).map(v => `<div class="pill">${v}</div>`).join('') + (state.follower ? '<div class="pill">🦛 Moo Deng te urmează</div>' : '');
}
function money(d) { state.money = Math.max(0, state.money + d); updateHUD(); if (d > 0) { SFX.cash(); toast(`+${d} lei`); } else if (d < 0) toast(`${d} lei`); }

// ---------------- Dialogue engine
const dlg = { active: false, npc: null, resolve: null, typing: null };
function typeText(text) {
  return new Promise(res => {
    const el = $('dlgText'); el.textContent = ''; let i = 0; dlg.skip = false; dlg.typingDone = false;
    const fin = () => { el.textContent = text; dlg.typingDone = true; res(); };
    const tick = () => { if (dlg.skip) return fin(); el.textContent = text.slice(0, ++i); if (i < text.length) dlg.typing = setTimeout(tick, 16); else fin(); };
    tick();
  });
}
async function say(who, text, me = false) {
  $('dialog').classList.remove('hidden'); $('dlgChoices').innerHTML = ''; $('dlgHint').style.display = 'block';
  $('dlgWho').textContent = who; $('dlgWho').className = me ? 'me' : '';
  if (me) { stopNpcVoice(); campiSay(text); } else speak(text, who);
  dlg.talking = me ? 'me' : 'npc';
  await typeText(text);
  await new Promise(r => { dlg.resolve = r; });
  dlg.talking = null;
}
function choose(opts) {
  return new Promise(res => {
    $('dlgHint').style.display = 'none'; const box = $('dlgChoices'); box.innerHTML = '';
    opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.onclick = async (e) => { e.stopPropagation(); box.innerHTML = ''; stopNpcVoice(); dlg.talking = 'me'; $('dlgWho').textContent = 'Câmpi'; $('dlgWho').className = 'me'; $('dlgText').textContent = o; const d = await campiSay(o); await new Promise(r => setTimeout(r, Math.max(700, d * 1000))); dlg.talking = null; res(i); }; box.appendChild(b); });
  });
}
$('dialog').addEventListener('click', () => { if ($('dlgChoices').children.length) return; if (!dlg.typingDone) { dlg.skip = true; return; } if (dlg.resolve) { const r = dlg.resolve; dlg.resolve = null; r(); } });
function ctxFor(npc) {
  return {
    get mission() { return state.mission; }, state,
    say: (w, t) => say(w, t), me: (t) => say('Câmpi', t, true), choose,
    money, give: (k, label) => { state.inv[k] = label; updateHUD(); SFX.ding(); toast('Ai primit: ' + label); },
    has: (k) => !!state.inv[k], take: (k) => { delete state.inv[k]; updateHUD(); },
    setMission, slots: playSlots, sfx: (n) => SFX[n]?.(),
    follow: () => { state.follower = true; updateHUD(); setTimeout(() => campiSay('Hai, Moo Deng, vino după mine!'), 600); bigmsg('MOO DENG E A TA!', '#ff9ecb'); },
    phoneLater: () => setTimeout(() => phone('Tanti Geta', 'Câmpi!!! Zice la știri că a scăpat hipopotamu\' ăla de pe internet, Moo Deng!! E în Parcul IOR, la lac!! Du-te, poate iei recompensă. Și adu-mi și mie o poză cu el.'), 3500),
  };
}
async function talkTo(npc) {
  if (dlg.active) return;
  dlg.active = true; dlg.npc = npc; $('bAct').classList.add('hidden'); $('btns').style.visibility = 'hidden'; $('mission').style.visibility = 'hidden';
  unlockAudio(); preloadSpeaker(speakerKey(npc.name));
  if (npc.obj && !npc.window) npc.yawTarget = Math.atan2(P.x - npc.x, P.z - npc.z);
  try { if (npc.def) await npc.def.talk(ctxFor(npc)); else await say(npc.name, pick(PED_LINES)); }
  catch (e) { console.error(e); }
  $('dialog').classList.add('hidden'); dlg.active = false; dlg.npc = null; stopNpcVoice(); $('btns').style.visibility = ''; $('mission').style.visibility = '';
}
function setMission(id) {
  const prev = state.mission; state.mission = id; updateHUD();
  if (prev !== id && MISSIONS[id]) { SFX.ding(); toast('Misiune nouă: ' + MISSIONS[id].title, 3500); }
  if (id === 'metrou') spawnDogs();
  if (prev !== id) saveGame();
}

// ---------------- Slots (păcănele)
const SYM = ['🍒', '🍋', '🔔', 'BAR', '7️⃣', '6️⃣', '🦛'];
const W8 = [26, 22, 16, 12, 9, 9, 6];
function roll() { let r = Math.random() * W8.reduce((a, b) => a + b), i = 0; while ((r -= W8[i]) > 0) i++; return i; }
function playSlots() {
  return new Promise(res => {
    $('slots').classList.remove('hidden'); $('slotMsg').textContent = `Ai ${state.money} lei. 5 lei / rotire.`;
    let busy = false;
    $('spin').onclick = async () => {
      if (busy) return; if (state.money < 5) { $('slotMsg').textContent = 'N-ai 5 lei, frate. Du-te la amanet.'; SFX.lose(); return; }
      busy = true; money(-5); state.spins++; SFX.spin();
      let res3 = [roll(), roll(), roll()];
      if (state.spins <= 2) while (res3[0] === res3[1] && res3[1] === res3[2]) res3 = [roll(), roll(), roll()];      // the house always wins... at first
      if (state.spins === 4 && state.money + 5 < 30) res3 = [5, 6, 0];                                                  // then gives you the 6-7 so you keep playing
      for (let k = 0; k < 14; k++) { for (let r = 0; r < 3; r++) if (k < 6 + r * 4) $('r' + r).textContent = SYM[(Math.random() * 7) | 0]; else $('r' + r).textContent = SYM[res3[r]]; await new Promise(r => setTimeout(r, 70)); }
      const [a, b, c] = res3; let win = 0, msg = '';
      if (a === b && b === c) { win = [15, 20, 30, 50, 77, 60, 100][a]; msg = `TREI ${SYM[a]}! +${win} lei`; }
      else if ((a === 5 && b === 4) || (b === 5 && c === 4) || (a === 5 && b === 6)) { win = 67; msg = 'SIX SEVEN! +67 lei'; }
      else if (res3.includes(4) && res3.includes(5)) { win = 13; msg = '6 și 7 pe ecran... +13 lei de consolare'; }
      else msg = pick(['Nimic. Aparatu\' râde de tine.', 'Aproape! (nu)', 'Mai bagă una, simți că vine…', 'Casa câștigă. Ca de obicei.']);
      if (res3.join() === '5,6,0') { win = 67; msg = 'SIX SEVEN! +67 lei'; }
      if (win) { SFX.win(); money(win); if (win === 67) { bigmsg('SIX SEVEN!'); voice('sixseven'); } } else SFX.lose();
      $('slotMsg').textContent = msg + ` (ai ${state.money} lei)`;
      busy = false;
    };
    $('slotExit').onclick = () => { if (busy) return; $('slots').classList.add('hidden'); res(); };
  });
}

// ---------------- Input
const input = { x: 0, z: 0, jump: false, act: false, keys: {} };
addEventListener('keydown', e => { input.keys[e.code] = true; if (e.code === 'Space') { input.jump = true; e.preventDefault(); } if (e.code === 'KeyE' || e.code === 'Enter') { if (dlg.active) $('dialog').click(); else input.act = true; } if (e.code === 'ShiftLeft') P.run = !P.run, $('bRun').classList.toggle('on', P.run); });
addEventListener('keyup', e => { input.keys[e.code] = false; });
let camYaw = Math.PI, camPitch = 0.3, camDist = 5.8, lastLook = 0;
// joystick
const joy = { id: null, cx: 0, cy: 0 };
$('joyzone').addEventListener('touchstart', e => { const t = e.changedTouches[0]; joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY; const j = $('joy'); j.style.display = 'block'; j.style.left = (t.clientX - 60) + 'px'; j.style.top = (t.clientY - 60) + 'px'; j.style.bottom = 'auto'; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy; const L = Math.hypot(dx, dy), m = 50; if (L > m) { dx *= m / L; dy *= m / L; } $('knob').style.transform = `translate(${dx}px,${dy}px)`; input.x = dx / m; input.z = dy / m; }
    else if (t.identifier === look.id) { camYaw -= (t.clientX - look.x) * 0.006; camPitch = clamp(camPitch + (t.clientY - look.y) * 0.004, 0.05, 1.1); look.x = t.clientX; look.y = t.clientY; lastLook = performance.now(); }
  }
}, { passive: true });
const look = { id: null, x: 0, y: 0 };
canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t.clientX > innerWidth * 0.4) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; } }, { passive: true });
addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; input.x = input.z = 0; $('knob').style.transform = ''; $('joy').style.display = 'none'; } if (t.identifier === look.id) look.id = null; } });
// mouse look
let mdown = false, mx = 0, my = 0;
canvas.addEventListener('mousedown', e => { mdown = true; mx = e.clientX; my = e.clientY; });
addEventListener('mouseup', () => mdown = false);
addEventListener('mousemove', e => { if (!mdown) return; camYaw -= (e.clientX - mx) * 0.005; camPitch = clamp(camPitch + (e.clientY - my) * 0.004, 0.05, 1.1); mx = e.clientX; my = e.clientY; lastLook = performance.now(); });
addEventListener('wheel', e => { camDist = clamp(camDist + e.deltaY * 0.01, 3.5, 14); });
$('bJump').addEventListener('touchstart', e => { input.jump = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
$('bJump').onclick = () => input.jump = true;
$('bRun').onclick = () => { P.run = !P.run; $('bRun').classList.toggle('on', P.run); };
$('bRun').classList.add('on');
$('bAct').onclick = (e) => { e.stopPropagation(); input.act = true; };
$('bScoot').onclick = (e) => { e.stopPropagation(); toggleScooter(); };
addEventListener('keydown', e => { if ((e.code === 'KeyF' || e.code === 'KeyQ') && !e.repeat) toggleScooter(); });

// ---------------- Electric scooter (trotinetă)
let scooter = null, scootSound = null;
function makeScooter() {
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.5, metalness: 0.4 }), green = new THREE.MeshStandardMaterial({ color: '#29d17a', roughness: 0.4 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.9), dark); deck.position.set(0, 0.11, 0.02); g.add(deck);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.02, 0.62), green); stripe.position.set(0, 0.125, 0); g.add(stripe);
  const front = new THREE.Group(); g.add(front); g.userData.front = front;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.05, 8), dark); stem.position.set(0, 0.6, 0.47); stem.rotation.x = -0.18; front.add(stem);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), dark); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.1, 0.56); front.add(bar);
  g.userData.grips = [-0.26, 0.26].map(x => { const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 8), green); grip.rotation.z = Math.PI / 2; grip.position.set(x, 1.1, 0.56); front.add(grip); return grip; });
  const wheels = [0.44, -0.4].map(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), dark); w.rotation.z = Math.PI / 2; w.position.set(0, 0.1, z); g.add(w); return w; });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff8d0' })); light.position.set(0, 1.0, 0.6); front.add(light);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData.wheels = wheels;
  return g;
}
// riding pose: analytic two-bone IK on the mocap skeleton - hands on the grips, one foot in front of the other on the deck
const _ik = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), t: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), v1: new THREE.Vector3(), v2: new THREE.Vector3() };
function aimBone(bone, from, curTip, wantTip) {
  const v1 = _ik.v1.subVectors(curTip, from).normalize(), v2 = _ik.v2.subVectors(wantTip, from).normalize();
  const dq = _ik.q.setFromUnitVectors(v1, v2), pw = bone.parent.getWorldQuaternion(_ik.q2), bw = new THREE.Quaternion(); bone.getWorldQuaternion(bw);
  bone.quaternion.copy(pw.invert().multiply(dq.multiply(bw))); bone.updateMatrixWorld(true);
}
function twoBoneIK(upper, lower, end, target, pole) {
  const A = upper.getWorldPosition(new THREE.Vector3()), B = lower.getWorldPosition(new THREE.Vector3()), C = end.getWorldPosition(new THREE.Vector3());
  const la = A.distanceTo(B), lb = B.distanceTo(C), dir = new THREE.Vector3().subVectors(target, A); let d = dir.length(); dir.normalize();
  d = Math.min(Math.max(d, Math.abs(la - lb) + 1e-3), la + lb - 1e-3);
  const cosA = (la * la + d * d - lb * lb) / (2 * la * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const Bw = A.clone().add(dir.clone().multiplyScalar(cosA * la)).add(perp.multiplyScalar(sinA * la));
  aimBone(upper, A, B, Bw);
  const B2 = lower.getWorldPosition(new THREE.Vector3()), C2 = end.getWorldPosition(new THREE.Vector3());
  aimBone(lower, B2, C2, A.clone().add(dir.clone().multiplyScalar(d)));
}
let rideBones = null;
function ridePose() {
  if (!scooter) return;
  const g = (n) => campi.getObjectByName('mixamorig' + n);
  if (!rideBones) rideBones = { la: g('LeftArm'), lf: g('LeftForeArm'), lh: g('LeftHand'), ra: g('RightArm'), rf: g('RightForeArm'), rh: g('RightHand'), lu: g('LeftUpLeg'), ll: g('LeftLeg'), lfo: g('LeftFoot'), ru: g('RightUpLeg'), rl: g('RightLeg'), rfo: g('RightFoot') };
  const R = rideBones; if (!R.la || !R.lu) return;
  campi.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(campi.quaternion), side = new THREE.Vector3(1, 0, 0).applyQuaternion(campi.quaternion), up = new THREE.Vector3(0, 1, 0);
  // fit the handlebar to his reach once (stem slides forward/back)
  if (!scooter.userData.fitted) { const sh = campi.worldToLocal(R.la.getWorldPosition(new THREE.Vector3())), hand = R.lh.getWorldPosition(new THREE.Vector3()), shw = R.la.getWorldPosition(new THREE.Vector3());
    const reach = (shw.distanceTo(R.lf.getWorldPosition(new THREE.Vector3())) + R.lf.getWorldPosition(new THREE.Vector3()).distanceTo(hand)) / campi.scale.x, dy = sh.y - 1.1, dx = Math.abs(sh.x) - 0.26;
    const dz = Math.sqrt(Math.max(0.04, (reach * 0.88) ** 2 - dy * dy - dx * dx)); scooter.userData.front.position.z = sh.z + dz - 0.56; scooter.userData.fitted = true; }
  const gp = scooter.userData.grips.map(m => m.getWorldPosition(new THREE.Vector3()));
  const lsh = R.la.getWorldPosition(new THREE.Vector3()), gl = gp[0].distanceTo(lsh) < gp[1].distanceTo(lsh) ? gp[0] : gp[1], gr = gl === gp[0] ? gp[1] : gp[0];
  const lSide = Math.sign(side.dot(lsh.clone().sub(campi.position))) || 1;
  twoBoneIK(R.la, R.lf, R.lh, gl, fwd.clone().multiplyScalar(-1).addScaledVector(side, lSide * 0.8).addScaledVector(up, -0.4).normalize());
  twoBoneIK(R.ra, R.rf, R.rh, gr, fwd.clone().multiplyScalar(-1).addScaledVector(side, -lSide * 0.8).addScaledVector(up, -0.4).normalize());
  // feet on the deck (ankle ~9 cm above the sole)
  const deckY = campi.position.y + 0.135 * campi.scale.y + 0.09;
  const fl = campi.position.clone().addScaledVector(side, lSide * 0.06).addScaledVector(fwd, 0.16); fl.y = deckY;
  const fr = campi.position.clone().addScaledVector(side, -lSide * 0.06).addScaledVector(fwd, -0.2); fr.y = deckY;
  twoBoneIK(R.lu, R.ll, R.lfo, fl, fwd.clone().addScaledVector(up, 0.2).normalize());
  twoBoneIK(R.ru, R.rl, R.rfo, fr, fwd.clone().addScaledVector(up, 0.2).normalize());
}
function toggleScooter(on = !P.scooter) {
  if (dlg.active || state.finale) return;
  P.scooter = on; $('bScoot').classList.toggle('on', on);
  if (!scooter) { scooter = makeScooter(); campi.add(scooter); }
  scooter.visible = on;
  if (on) {
    if (!state.flags.scootInfo) { state.flags.scootInfo = 1; toast('🛴 Trotinetă închiriată: 0,67 lei/minut (plătește Tanti Geta)', 3000); }
    if (actx && !scootSound) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sawtooth'; const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f).connect(g).connect(master); g.gain.value = 0; o.start(); scootSound = { o, g }; }
  } else if (scootSound) { scootSound.o.stop(); scootSound = null; }
}
function scooterCrash() {
  const hit = P.speed; toggleScooter(false);
  P.knock.set(-Math.sin(P.yaw) * hit * 0.5, -Math.cos(P.yaw) * hit * 0.5); P.vy = 5; P.hurt = 1.2; P.speed = 0;
  SFX.hit(); flash(); campiSay(pick(['Au! Futu-i!', 'Bă, fii atent pe unde mergi!'])); toast('Ai intrat cu trotineta în perete. Clasic.', 2200);
  if (navigator.vibrate) navigator.vibrate(150);
}

// ---------------- Helpers on the map
function nearestPoi(kinds, from, { min = 0, max = 1e9, name } = {}) {
  let best = null, bd = 1e18;
  for (const p of W.pois) {
    if (!kinds.includes(p.k)) continue; if (name && !name.test(p.n || '')) continue;
    const d = Math.hypot(p.x - from[0], p.z - from[1]); if (d < min || d > max) continue;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function walkable(x, z) { const [rx, rz] = W.collider.resolve(x, z, 0.6); return [rx, rz]; }
function spot(p, fb = [40, 40]) { if (!p) return walkable(LOC.home[0] + fb[0], LOC.home[1] + fb[1]); const [x, z] = p.door || [p.x, p.z]; return walkable(x, z); }
function labelSprite(text, color = '#ffd23f', size = 1) {
  const t = canvasTex(512, 128, (g, w, h) => { g.font = '900 64px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#1b1420'; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.4 * size, 0.6 * size, 1); s.renderOrder = 10; return s;
}

// ---------------- Setup world content after the map loads
async function setup() {
  // map2.txt = same data as map.json under a name the GitHub mobile uploader accepts; falls back to map.json
  // the map can also come split in small pieces (js/map-part-N.js, plain JSON text) - the GitHub mobile uploader rejects the big file
  let mapUrl = 'assets/map.json';
  { const parts = [];
    for (let i = 1; i <= 30; i++) { const r = await fetch(`js/map-part-${i}.js`, { cache: 'no-cache' }).catch(() => null); if (!r || !r.ok) break; parts.push(await r.text()); }
    if (parts.length) { try { JSON.parse(parts.join('')); mapUrl = URL.createObjectURL(new Blob([parts.join('')], { type: 'application/json' })); } catch (e) { console.warn('map parts incomplete', e); } }
    if (mapUrl === 'assets/map.json' && await fetch('assets/map2.txt', { method: 'HEAD', cache: 'no-cache' }).then(r => r.ok).catch(() => false)) mapUrl = 'assets/map2.txt'; }
  W = await buildWorld(scene, mapUrl, { quality: QUALITY });
  setTimeOfDay(false);
  const R = W.radius;
  // --- metro Dristor 1
  const metroP = nearestPoi(['subway'], [0, 0], { name: /Dristor 1/ }) || nearestPoi(['subway'], [0, 0]) || { x: 0, z: 0 };
  LOC.metro = walkable(metroP.x, metroP.z);
  DET = buildDetails(W, { quality: QUALITY });
  { const d1 = DET.metroOut.find(m => /Dristor 1/.test(m.name || '')); if (d1) LOC.metro = walkable(d1.x, d1.z); }
  for (const m of DET.metroOut) if (m.name && /Dristor/.test(m.name)) { const l = labelSprite(m.name.toUpperCase(), '#ffffff', 1.1); l.position.set(m.x, 5, m.z); scene.add(l); }
  // --- Câmpi's block: a named "Bl." building 70-260 m from the metro
  let blk = null, bd = 1e9;
  for (const b of W.buildings) { if (!/^Bl/i.test(b.name || '') || b.h < 12) continue; const c = centroid(b.pts); const d = Math.hypot(c[0] - LOC.metro[0], c[1] - LOC.metro[1]); if (d > 70 && d < 260 && d < bd) { bd = d; blk = b; } }
  if (!blk) blk = W.buildings.filter(b => b.h > 12).sort((a, b) => dist2(centroid(a.pts), LOC.metro) - dist2(centroid(b.pts), LOC.metro))[5];
  const wall = longestEdge(blk.pts);
  LOC.home = walkable(wall.mx + wall.nx * 4, wall.mz + wall.nz * 4);
  LOC.homeWall = wall; LOC.homeBlock = blk;
  // block numbers painted on every named block
  for (const b of W.buildings) if (b.name && /^(Bl|Bloc)/i.test(b.name) && b.h > 8) addBlockLabel(b);
  // --- NPC placement from real POIs
  const from = LOC.home;
  const farm = nearestPoi(['pharmacy', 'chemist'], from, { min: 60 });
  const shaorma = nearestPoi(['fast_food'], from, { min: 80 }) || nearestPoi(['restaurant'], from);
  const casino = nearestPoi(['casino', 'gambling', 'bookmaker'], from, { min: 50 });
  const amanet = nearestPoi(['vacant', 'jewelry', 'mobile_phone', 'clothes', 'shoes'], from, { min: 90 });
  if (amanet && amanet.wall) W.placeSign(amanet, 'pawnbroker');
  if (casino && casino.wall && casino.k === 'bookmaker') W.placeSign(casino, 'gambling');
  const nonstop = nearestPoi(['convenience', 'kiosk', 'alcohol', 'supermarket'], from, { min: 30 });
  await addNPC('geta', null, null, { window: wall });
  await addNPC('farmacista', ...spot(farm, [60, 0])); await addNPC('nelu', ...spot(shaorma, [-60, 20])); await addNPC('gigi', ...spot(casino, [0, 80])); await addNPC('costel', ...spot(amanet, [90, -40]));
  if (nonstop) await addNPC('nonstop', ...spot(nonstop));
  await addNPC('taxi', LOC.metro[0] + 6, LOC.metro[1] + 4);
  await addNPC('bormasina', ...walkable(wall.mx + wall.nx * 3 + wall.ex * 18, wall.mz + wall.nz * 3 + wall.ez * 18));
  const bigRoad = W.roads.filter(r => r.k === 'primary' || r.k === 'secondary').sort((a, b) => dist2(a.pts[0], from) - dist2(b.pts[0], from))[0];
  if (bigRoad) { const q = bigRoad.pts[Math.min(1, bigRoad.pts.length - 1)]; await addNPC('manelist', ...walkable(q[0] + bigRoad.w / 2 + 2, q[1])); const car = makeCar('#111'); car.position.set(q[0] + bigRoad.w / 2 - 1.2, 0, q[1] + 3); scene.add(car); }
  const park = W.areas.filter(a => ['park', 'play', 'grass'].includes(a.k)).sort((a, b) => dist2(centroid(a.pts), from) - dist2(centroid(b.pts), from))[0];
  if (park) await addNPC('pensionar', ...walkable(...centroid(park.pts)));
  const d2p = W.pois.find(p => p.k === 'subway' && /Dristor 2/.test(p.n)); await addNPC('politist', ...walkable(d2p ? d2p.x + 5 : LOC.metro[0] - 10, d2p ? d2p.z + 5 : LOC.metro[1] - 10));
  // --- Moo Deng at the lake in Parcul IOR (or the biggest park)
  const water = W.areas.filter(a => a.k === 'water').sort((a, b) => polyArea(b.pts) - polyArea(a.pts))[0];
  const ior = W.areas.filter(a => a.k === 'park').sort((a, b) => polyArea(b.pts) - polyArea(a.pts))[0];
  let md = water ? water.pts.reduce((best, p) => (p[0] - 0) ** 2 + (p[1] - 0) ** 2 < (best[0] ** 2 + best[1] ** 2) ? p : best, water.pts[0]) : ior ? centroid(ior.pts) : [300, -300];
  if (Math.hypot(md[0], md[1]) > R - 40) md = ior ? centroid(ior.pts) : [300, -300];
  if (Math.hypot(md[0], md[1]) > R - 40) md = [md[0] * (R - 80) / Math.hypot(md[0], md[1]), md[1] * (R - 80) / Math.hypot(md[0], md[1])];
  LOC.moodeng = walkable(md[0], md[1]);
  mooDeng = makeMooDeng(); mooDeng.position.set(LOC.moodeng[0], 0, LOC.moodeng[1]); scene.add(mooDeng);
  npcs.push({ id: 'moodeng', def: NPC_DEFS.moodeng, name: 'Moo Deng', obj: mooDeng, x: LOC.moodeng[0], z: LOC.moodeng[1], yaw: 0, hippo: true, r: 3.5 });
  // --- Market stalls at Piața Râmnicu Sărat
  const market = W.areas.find(a => a.k === 'market' && /Râmnicu/.test(a.n || '')) || W.areas.find(a => a.k === 'market');
  if (market) { const l = labelSprite((market.n || 'PIAȚA').toUpperCase(), '#ffffff', 1.3); const c = centroid(market.pts); l.position.set(c[0], 7, c[1]); scene.add(l); }
  // --- Câmpi
  campiBody = await makeCampiBody(); campi = campiBody.root; scene.add(campi);
  { const hp = new THREE.Group(); hp.position.set(0, 0.04, 0.035); campiBody.headInner.add(hp); campiHead = await makeCampiHead(hp, 0.185); }
  P.x = LOC.home[0]; P.z = LOC.home[1]; P.yaw = Math.atan2(-wall.nx, -wall.nz);
  camYaw = P.yaw + Math.PI;
  // --- traffic, pedestrians, stray dogs, collectibles
  spawnTraffic(); await spawnPeds(); spawnSleepingDogs(); spawnCoins(); spawnTram();
  // --- mission beacon
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beacon.position.y = 60; scene.add(beacon);
  targetMarker = labelSprite('!', '#ffd23f', 1.4); targetMarker.scale.set(1.2, 1.2, 1); scene.add(targetMarker);
  buildMinimap();
  updateHUD();
}
function centroid(pts) { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; }
function dist2(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a / 2); }
function longestEdge(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; const L = Math.hypot(x2 - x1, z2 - z1);
    if (!best || L > best.L) best = { L, mx: (x1 + x2) / 2, mz: (z1 + z2) / 2, ex: (x2 - x1) / L, ez: (z2 - z1) / L, nx: (z2 - z1) / L, nz: -(x2 - x1) / L, x1, z1 }; }
  return best;
}
function addBlockLabel(b) {
  // shortest wall >= 8m (the gable) gets the painted block number near the top
  let best = null;
  for (let i = 0; i < b.pts.length; i++) { const [x1, z1] = b.pts[i], [x2, z2] = b.pts[(i + 1) % b.pts.length]; const L = Math.hypot(x2 - x1, z2 - z1); if (L >= 8 && (!best || L < best.L)) best = { L, x1, z1, x2, z2 }; }
  if (!best) return;
  const txt = b.name.replace(/^Bloc\s*/i, 'BL. ').replace(/^Bl\.?\s*/i, 'BL. ').toUpperCase();
  const t = canvasTex(512, 160, (g, w, h) => { g.font = '900 120px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(30,30,30,.85)'; g.fillText(txt, w / 2, h / 2 + 6, w - 20); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.56), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false }));
  const mx = (best.x1 + best.x2) / 2, mz = (best.z1 + best.z2) / 2, ex = (best.x2 - best.x1) / best.L, ez = (best.z2 - best.z1) / best.L, nx = ez, nz = -ex;
  m.position.set(mx + nx * 0.08, b.h - 2.2, mz + nz * 0.08); m.lookAt(m.position.x + nx, m.position.y, m.position.z + nz); scene.add(m);
}
function addMetroEntrance(p) {
  const g = new THREE.Group();
  const tot = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#1b4f9c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 100px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', w / 2, h / 2 + 6); });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: tot, emissive: '#fff', emissiveMap: tot, emissiveIntensity: .4 }));
  box.position.y = 3.3; g.add(box);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(.22, 2.9, .22), new THREE.MeshStandardMaterial({ color: '#555' })); pole.position.y = 1.45; g.add(pole);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, .15, 6), new THREE.MeshStandardMaterial({ color: '#8fb7d6', transparent: true, opacity: .7, metalness: .3 })); canopy.position.set(2.8, 2.8, 0); g.add(canopy);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1, .1), new THREE.MeshStandardMaterial({ color: '#b0b0b0', metalness: .6 })); rail.position.set(2.8, .5, -3); g.add(rail);
  const rail2 = rail.clone(); rail2.position.z = 3; g.add(rail2);
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(4, .1, 5.8), new THREE.MeshStandardMaterial({ color: '#222' })); stairs.position.set(2.8, .12, 0); g.add(stairs);
  if (p.n && /Dristor/.test(p.n)) { const l = labelSprite(p.n.toUpperCase(), '#ffffff', 1.1); l.position.set(0, 4.5, 0); g.add(l); }
  g.position.set(p.x, 0, p.z); scene.add(g);
}
function addMarket(a) {
  const c = centroid(a.pts); const umb = ['#d7263d', '#1b4f9c', '#f2a900', '#2e8b57', '#ffffff'];
  for (let i = 0; i < 16; i++) {
    const x = c[0] + rand(-25, 25), z = c[1] + rand(-25, 25); if (!Collider.inside(a.pts, x, z) || W.collider.near(x, z).some(p => p.data?.building !== undefined && Collider.inside(p.pts, x, z))) continue;
    const g = new THREE.Group();
    { const tb = new THREE.Mesh(new THREE.BoxGeometry(2.4, .9, 1.2), new THREE.MeshStandardMaterial({ color: '#8b6b4a' })); tb.position.y = .45; g.add(tb); }
    const u = new THREE.Mesh(new THREE.ConeGeometry(1.8, .7, 8), new THREE.MeshStandardMaterial({ color: pick(umb) })); u.position.y = 2.4; g.add(u);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.2), new THREE.MeshStandardMaterial({ color: '#888' })); pl.position.y = 1.1; g.add(pl);
    const prod = pick(['#2f9e3a', '#e33', '#f7c948', '#ff8c1a', '#7b2d8b']);
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(i % 3 === 0 ? .28 : .12, 8, 6), new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? '#2f9e3a' : prod })); s.position.set(rand(-1, 1), 1, rand(-.4, .4)); g.add(s); }
    g.position.set(x, 0, z); g.rotation.y = rand(0, 6); scene.add(g);
    W.collider.add([[x - 1.3, z - 1.3], [x + 1.3, z - 1.3], [x + 1.3, z + 1.3], [x - 1.3, z + 1.3]], { h: 1 });
  }
  const l = labelSprite('PIAȚA', '#ffffff', 1.3); l.position.set(c[0], 6, c[1]); scene.add(l);
}

// ---------------- NPCs
async function addNPC(id, x, z, opts = {}) {
  const def = NPC_DEFS[id]; if (!def) return;
  const look = def.look || {};
  const kind = look.female ? (look.scarf ? 'old' : 'female') : 'male';
  const rig = await makeRigCharacter(kind, { shirt: look.shirt || '#888', pants: look.pants || '#333', skin: look.skin || pick(['#e2b896', '#d6a988', '#eec7a6']), shoes: look.shoes || '#222', hair: look.scarf || look.hair || '#3a2a20' },
    { scarf: !!look.scarf, cap: !!look.cap, beard: !!look.beard, bald: !!look.bald, glasses: !!look.glasses, long: !!look.female && !look.scarf });
  const h = rig.root;
  if (look.chain) { const sp = h.getObjectByName('mixamorigSpine2'); const c = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 6, 20), new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 1, roughness: .2 })); c.position.set(0, 16, 6); c.rotation.x = 1.25; sp.add(c); }
  const npc = { id, def, name: def.name, obj: h, rig, x, z, yaw: 0, r: 3.2 };
  if (opts.window) {
    // Tanti Geta leans out of a 2nd-floor window of Câmpi's block
    const w = opts.window, along = 6; x = w.mx + w.ex * along; z = w.mz + w.ez * along;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }));
    frame.position.set(x + w.nx * 0.05, 7.4, z + w.nz * 0.05); frame.lookAt(frame.position.x + w.nx, 7.4, frame.position.z + w.nz); scene.add(frame);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.8, .12, .5), new THREE.MeshStandardMaterial({ color: '#ddd' })); sill.position.set(x + w.nx * .25, 6.7, z + w.nz * .25); sill.rotation.y = Math.atan2(w.nx, w.nz); scene.add(sill);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, .18, .45), new THREE.MeshStandardMaterial({ color: '#c94f7c' })); pillow.position.set(x + w.nx * .3, 6.82, z + w.nz * .3); pillow.rotation.y = Math.atan2(w.nx, w.nz); scene.add(pillow);
    h.position.set(x - w.nx * 0.25, 6.1, z - w.nz * 0.25); h.rotation.y = Math.atan2(w.nx, w.nz);
    npc.x = x + w.nx * 3; npc.z = z + w.nz * 3; npc.window = true; npc.r = 10; npc.yaw = h.rotation.y; npc.anchor = new THREE.Vector3(x + w.nx * .3, 7.9, z + w.nz * .3);
  } else { h.position.set(x, 0, z); npc.yaw = rand(0, 6); W.collider.add([[x - .35, z - .35], [x + .35, z - .35], [x + .35, z + .35], [x - .35, z + .35]], { npc: true, h: 99 }); }
  scene.add(h); npcs.push(npc);
  const tag = labelSprite(def.name, '#ffffff', 0.8); tag.position.set(0, 2.25, 0); h.add(tag); npc.tag = tag;
  return npc;
}

// ---------------- Traffic
function roadPoint(r, s) {
  const pts = r.pts; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (acc + L >= s) { const t = (s - acc) / L; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, dx: (pts[i + 1][0] - pts[i][0]) / L, dz: (pts[i + 1][1] - pts[i][1]) / L }; } acc += L; }
  const n = pts.length; const L = Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]) || 1; return { x: pts[n - 1][0], z: pts[n - 1][1], dx: (pts[n - 1][0] - pts[n - 2][0]) / L, dz: (pts[n - 1][1] - pts[n - 2][1]) / L };
}
function roadLen(r) { let L = 0; for (let i = 0; i < r.pts.length - 1; i++) L += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]); return L; }
function spawnTraffic() {
  const roads = W.roads.filter(r => ['primary', 'secondary', 'tertiary', 'trunk'].includes(r.k)).map(r => ({ r, L: roadLen(r) })).filter(o => o.L > 120).sort((a, b) => b.L - a.L).slice(0, 18);
  for (let i = 0; i < Math.min(isTouch ? 14 : 22, roads.length * 2); i++) {
    const o = roads[i % roads.length]; const c = makeCar(); scene.add(c);
    cars.push({ obj: c, r: o.r, L: o.L, s: rand(0, o.L), dir: i % 2 ? 1 : -1, v: rand(9, 13), vmax: rand(9, 14), honk: 0 });
  }
}
// ---------------- Tram on the real tram line
let tram = null;
function pathPoint(pts, s) { let acc = 0; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (acc + L >= s) { const t = (s - acc) / L; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, dx: (pts[i + 1][0] - pts[i][0]) / L, dz: (pts[i + 1][1] - pts[i][1]) / L }; } acc += L; }
  const n = pts.length, L = Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]) || 1; return { x: pts[n - 1][0], z: pts[n - 1][1], dx: (pts[n - 1][0] - pts[n - 2][0]) / L, dz: (pts[n - 1][1] - pts[n - 2][1]) / L }; }
function spawnTram() {
  if (!W.tramPath || W.tramPath.length < 2) return;
  const pts = W.tramPath; let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  if (L < 80) return;
  const side = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#f1ece2'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8102e'; g.fillRect(0, 44, w, 20); g.fillStyle = '#26333d'; for (let x = 10; x < w - 30; x += 46) g.fillRect(x, 8, 38, 30); g.fillStyle = '#ffd23f'; g.font = 'bold 16px sans-serif'; g.fillText('STB', 460, 58); });
  const g = new THREE.Group(); const body = new THREE.MeshStandardMaterial({ map: side, roughness: .5 }), end = new THREE.MeshStandardMaterial({ color: '#f1ece2' });
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.1, 9.6), [end, end, new THREE.MeshStandardMaterial({ color: '#777' }), end, end, end]); m.position.set(0, 1.9, (k - 1) * 10); m.castShadow = true; g.add(m);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 2.4), body); sm.position.set(1.21, 1.9, (k - 1) * 10); sm.rotation.y = Math.PI / 2; g.add(sm); const sm2 = sm.clone(); sm2.position.x = -1.21; sm2.rotation.y = -Math.PI / 2; g.add(sm2); }
  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.6), new THREE.MeshStandardMaterial({ color: '#333' })); pan.position.set(0, 4, 0); pan.rotation.x = 0.6; g.add(pan);
  const lampM = new THREE.MeshBasicMaterial({ color: '#fff4c8' }); [-0.8, 0.8].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .05), lampM); l.position.set(x, 1.1, 14.83); g.add(l); });
  scene.add(g); tram = { obj: g, pts, L, s: L * 0.3, dir: 1 };
}
// ---------------- Pedestrians
async function spawnPeds() {
  const roads = W.roads.filter(r => ['residential', 'tertiary', 'secondary', 'footway', 'pedestrian'].includes(r.k)).map(r => ({ r, L: roadLen(r) })).filter(o => o.L > 40);
  const near = roads.filter(o => Math.hypot(o.r.pts[0][0] - LOC.home[0], o.r.pts[0][1] - LOC.home[1]) < 500);
  const pool = near.length > 10 ? near : roads;
  const SHIRTS = ['#e33', '#39f', '#222', '#fff', '#6c6', '#f6a', '#999', '#ffb000', '#6b3fa0', '#1b1b1b'];
  for (let i = 0; i < (isTouch ? 16 : 26) && pool.length; i++) {
    const o = pick(pool); const female = Math.random() < .45;
    const scarf = female && Math.random() < .2 ? pick(['#c0392b', '#2c3e50', '#8e44ad']) : null;
    const rig = await makeRigCharacter(female ? (scarf ? 'old' : 'female') : 'male', { shirt: pick(SHIRTS), pants: pick(['#35518a', '#222', '#555', '#6b4a2b']), shoes: pick(['#fff', '#222', '#8b5a2b']), skin: pick(['#e2b896', '#d6a988', '#eec7a6', '#c99a7a']), hair: scarf || pick(['#111', '#3a2a20', '#8a5a2b', '#ccc', '#d4a24c']) },
      { scarf: !!scarf, bald: !female && Math.random() < .2, cap: !female && Math.random() < .2, beard: !female && Math.random() < .3, long: female && !scarf, glasses: Math.random() < .15 });
    const h = rig.root; if (female) h.scale.setScalar(0.94); scene.add(h);
    const side = Math.random() < .5 ? 1 : -1;
    peds.push({ obj: h, rig, r: o.r, L: o.L, s: rand(0, o.L), dir: side, off: side * (o.r.w / 2 + 1.6), v: rand(1.1, 1.7), name: pick(['Un vecin', 'O vecină', 'Un trecător', 'Nea Costică', 'Doamna de la 2', 'Un puști', 'Un tip dubios']), pause: 0 });
  }
}
// ---------------- Stray dogs
function spawnSleepingDogs() {
  for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), d = rand(40, 300); const [x, z] = walkable(LOC.home[0] + Math.cos(a) * d, LOC.home[1] + Math.sin(a) * d); const g = makeDog(); g.position.set(x, 0, z); g.rotation.y = rand(0, 6); scene.add(g); dogs.push({ obj: g, x, z, sleeping: true, v: 0, bark: 0 }); }
}
function spawnDogs() {
  const mx = (LOC.moodeng[0] * .45 + LOC.metro[0] * .55), mz = (LOC.moodeng[1] * .45 + LOC.metro[1] * .55);
  for (let i = 0; i < 6; i++) { const [x, z] = walkable(mx + rand(-12, 12), mz + rand(-12, 12)); const g = makeDog(); g.position.set(x, 0, z); scene.add(g); dogs.push({ obj: g, x, z, pack: true, v: 0, bark: 0, cool: 0 }); }
  setTimeout(() => phone('Mama', 'Câmpi, ai grijă că zice pe grupul blocului că e o haită de maidanezi pe drum spre metrou. Și ia pâine!!'), 2500);
}
// ---------------- 6-7 collectibles
function spawnCoins() {
  const texs = { 6: numberTex('6', '#b44dff'), 7: numberTex('7', '#ff8a00') };
  const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24);
  const side = new THREE.MeshStandardMaterial({ color: '#ffc21a', metalness: .8, roughness: .25, emissive: '#6b4a00', emissiveIntensity: .4 });
  let n = 0, tries = 0;
  while (n < 20 && tries++ < 2000) {
    const a = rand(0, 6.28), d = rand(30, 520); const x = LOC.home[0] * .5 + Math.cos(a) * d, z = LOC.home[1] * .5 + Math.sin(a) * d;
    if (Math.hypot(x, z) > W.radius - 40) continue;
    if (W.collider.near(x, z).some(p => Collider.inside(p.pts, x, z))) continue;
    const k = n % 2 ? 7 : 6; const mat = new THREE.MeshStandardMaterial({ map: texs[k], metalness: .2, roughness: .3 });
    const m = new THREE.Mesh(geo, [side, mat, mat]); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); g.position.set(x, 1.2, z); scene.add(g);
    coins.push({ obj: g, k, x, z }); n++;
  }
}
function numberTex(n, color) { return canvasTex(128, 128, (g) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 128, 128); g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fillStyle = color; g.fill(); g.font = '900 88px Trebuchet MS'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(n, 64, 70); }); }

// ---------------- Minimap
let mapCanvas, mapScale;
function buildMinimap() {
  const S = 2048, R = W.radius; mapScale = S / (2 * R);
  mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = S; const g = mapCanvas.getContext('2d');
  const tx = (x) => (x + R) * mapScale;
  g.fillStyle = '#b7b09a'; g.fillRect(0, 0, S, S);
  const COL = { park: '#7fbf5f', grass: '#93c26d', water: '#5aa0d0', parking: '#8a8680', market: '#c9b58f', play: '#c9a27a', pitch: '#5aa55a' };
  for (const a of W.areas) { g.fillStyle = COL[a.k] || '#a9a393'; g.beginPath(); a.pts.forEach(([x, z], i) => i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of W.roads) { g.strokeStyle = r.w >= 11 ? '#ffffff' : r.w >= 6 ? '#f0ece4' : '#d8d2c4'; g.lineWidth = Math.max(1.2, r.w * mapScale); g.beginPath(); r.pts.forEach(([x, z], i) => i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))); g.stroke(); }
  for (const b of W.buildings) { g.fillStyle = b.garage ? '#8e8a82' : '#6d6a70'; g.beginPath(); b.pts.forEach(([x, z], i) => i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))); g.fill(); }
  g.fillStyle = '#1b4f9c'; for (const p of W.pois.filter(p => p.k === 'subway')) { g.beginPath(); g.arc(tx(p.x), tx(p.z), 6, 0, 7); g.fill(); }
}
function drawMinimap(target) {
  // North-up minimap: the map never rotates; only the player arrow and the camera view cone turn.
  const c = $('minimap'), g = c.getContext('2d'), s = c.width, R = W.radius, k = 0.8; // k = minimap px per metre
  g.save(); g.clearRect(0, 0, s, s); g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.clip();
  g.fillStyle = '#b7b09a'; g.fillRect(0, 0, s, s);
  const src = (s / k) * mapScale, cx = (P.x + R) * mapScale, cz = (P.z + R) * mapScale;
  g.imageSmoothingEnabled = true;
  g.drawImage(mapCanvas, cx - src / 2, cz - src / 2, src, src, 0, 0, s, s);
  // camera view cone (where the camera is looking)
  const look = Math.PI - (camYaw + Math.PI);
  g.translate(s / 2, s / 2); g.rotate(look);
  const cone = g.createRadialGradient(0, 0, 4, 0, 0, s * 0.45); cone.addColorStop(0, 'rgba(255,255,255,.45)'); cone.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, s * 0.45, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
  g.restore();
  // mission target (clamped to the rim when far away)
  if (target) {
    let rx = (target[0] - P.x) * k, rz = (target[1] - P.z) * k;
    const L = Math.hypot(rx, rz), m = s / 2 - 10; if (L > m) { rx *= m / L; rz *= m / L; }
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#1b1420'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2 + rx, s / 2 + rz, 8, 0, 7); g.fill(); g.stroke();
  }
  // player arrow: points where Câmpi faces
  g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI - P.yaw); g.fillStyle = '#ff3d8b'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  // north marker
  g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#1b1420'; g.fillStyle = '#fff';
  g.strokeText('N', s / 2, 11); g.fillText('N', s / 2, 11);
}

// ---------------- Mission target resolution
function targetPos() {
  const m = MISSIONS[state.mission]; if (!m || !m.target) return null;
  if (m.target === 'metrou') return LOC.metro;
  const ids = Array.isArray(m.target) ? m.target : [m.target];
  let best = null, bd = 1e18;
  for (const id of ids) { const n = npcs.find(n => n.id === id); if (!n) continue; const d = (n.x - P.x) ** 2 + (n.z - P.z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best ? [best.window ? best.anchor.x : best.x, best.window ? best.anchor.z : best.z] : null;
}

// ---------------- Main loop
const clock = new THREE.Clock(); let running = false, T = 0;
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function update(dt) {
  T += dt;
  const talking = dlg.active || !$('slots').classList.contains('hidden');
  // ---- player movement
  let ix = input.x, iz = input.z;
  if (input.keys.KeyW || input.keys.ArrowUp) iz = -1; if (input.keys.KeyS || input.keys.ArrowDown) iz = 1;
  if (input.keys.KeyA || input.keys.ArrowLeft) ix = -1; if (input.keys.KeyD || input.keys.ArrowRight) ix = 1;
  let mag = Math.min(1, Math.hypot(ix, iz)); if (talking || state.finale) mag = 0;
  const maxV = P.scooter ? 17 : P.run ? 8.5 : 4.2, targetV = mag * maxV;
  P.speed += (targetV - P.speed) * Math.min(1, dt * (P.scooter ? (targetV > P.speed ? 1.6 : 2.5) : 8));
  const yawBefore = P.yaw;
  if (mag > 0.05) {
    const a = Math.atan2(ix, iz) + camYaw; // input relative to camera (W = away from camera)
    P.yaw = lerpAngle(P.yaw, a, Math.min(1, dt * (P.scooter ? 3.2 : 12)));
  }
  P.lean += (clamp(((P.yaw - yawBefore + Math.PI * 3) % (Math.PI * 2) - Math.PI) / Math.max(dt, 1e-3) * P.speed * -0.02, -0.35, 0.35) - P.lean) * Math.min(1, dt * 6);
  let nx = P.x + Math.sin(P.yaw) * P.speed * dt + P.knock.x * dt, nz = P.z + Math.cos(P.yaw) * P.speed * dt + P.knock.y * dt;
  P.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
  const wantX = nx, wantZ = nz;
  [nx, nz] = W.collider.resolve(nx, nz, 0.45, Infinity, P.y);
  if (P.scooter && P.speed > 9 && Math.hypot(nx - wantX, nz - wantZ) > P.speed * dt * 0.55) scooterCrash();
  const rr = Math.hypot(nx, nz); if (rr > W.radius - 25) { nx *= (W.radius - 25) / rr; nz *= (W.radius - 25) / rr; if (!state.flags.edge) { state.flags.edge = 1; toast('Mai încolo e Titanu\'. Fără pașaport nu treci.'); setTimeout(() => state.flags.edge = 0, 4000); } }
  P.x = nx; P.z = nz;
  // jump / gravity (can land on garages and parked cars)
  P.ground = W.collider.groundAt(P.x, P.z, P.y);
  if (input.jump && P.y <= P.ground + 0.02 && !talking) { P.vy = 9.5; SFX.jump(); }
  input.jump = false;
  P.vy -= 22 * dt; P.y += P.vy * dt; if (P.y < P.ground) { P.y = P.ground; P.vy = 0; }
  campi.position.set(P.x, P.y + (P.scooter ? 0.13 : 0), P.z); campi.rotation.set(0, P.yaw, P.scooter ? P.lean : 0);
  if (scooter && P.scooter) scooter.userData.wheels.forEach(w => w.rotation.x += P.speed * dt / 0.1);
  if (scootSound) { scootSound.o.frequency.value = 90 + P.speed * 28; scootSound.g.gain.value = muted ? 0 : 0.03 + P.speed * 0.004; }
  { // blend idle / walk / run by speed (real mocap clips)
    const air = P.y > P.ground + 0.05, v = air || P.scooter ? 0 : P.speed, A = campiBody.actions;
    const wWalk = clamp(v / 2.2, 0, 1) * (1 - clamp((v - 4.2) / 2.5, 0, 1)), wRun = clamp((v - 4.2) / 2.5, 0, 1), wIdle = 1 - Math.max(wWalk, wRun);
    A.idle.setEffectiveWeight(wIdle); A.walk.setEffectiveWeight(wWalk); A.run.setEffectiveWeight(wRun);
    A.walk.timeScale = clamp(v / 1.9, 0.6, 1.6); A.run.timeScale = clamp(v / 6.5, 0.8, 1.4);
    campiBody.mixer.update(air ? dt * 0.2 : dt);
    campiBody.headMount.position.copy(campiBody.headBone.position); campiBody.headMount.quaternion.copy(campiBody.headBone.quaternion);
    if (P.scooter) ridePose();
  }
  // face expression
  const talkingMe = dlg.talking === 'me' ? lipLevel() : 0;
  const grim = P.hurt > 0 ? 1 : clamp((P.speed - 6) / 3, 0, 0.6);
  campiHead.setExpr(grim * (1 - talkingMe), state.happy > 0 ? 1 : 0, talkingMe * 0.9, talkingMe * 0.35 * (0.5 + 0.5 * Math.sin(T * 9)));
  P.hurt = Math.max(0, P.hurt - dt); state.happy = Math.max(0, (state.happy || 0) - dt);
  if (state.finale) { campi.rotation.y += dt * 2; }

  // ---- interaction
  let near = null, nd = 1e9;
  for (const n of npcs) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < n.r && d < nd) { nd = d; near = n; } }
  for (const p of peds) { const d = Math.hypot(p.obj.position.x - P.x, p.obj.position.z - P.z); if (d < 2.2 && d < nd) { nd = d; near = p; } }
  const btn = $('bAct');
  if (near && !talking) { btn.classList.remove('hidden'); btn.textContent = (isTouch ? 'VORBEȘTE: ' : '[E] ') + near.name; if (input.act) { if (near.obj && near.s !== undefined) { near.pause = 4; near.obj.rotation.y = Math.atan2(P.x - near.obj.position.x, P.z - near.obj.position.z); } talkTo(near); } }
  else btn.classList.add('hidden');
  input.act = false;

  // ---- NPC idle
  for (const n of npcs) {
    if (n.hippo) {
      if (state.follower && n.id === 'moodeng') {
        const bx = P.x - Math.sin(P.yaw) * 2.6, bz = P.z - Math.cos(P.yaw) * 2.6; const dx = bx - n.x, dz = bz - n.z, d = Math.hypot(dx, dz);
        const sp = d > 1 ? Math.min(d * 3, P.scooter ? 22 : 10) : 0; if (d > 0.1) { n.x += dx / d * sp * dt; n.z += dz / d * sp * dt; }
        [n.x, n.z] = W.collider.resolve(n.x, n.z, 0.7); if (d > 30) { n.x = bx; n.z = bz; }
        n.yaw = lerpAngle(n.yaw, Math.atan2(P.x - n.x, P.z - n.z), dt * 6); animateHippo(n.obj, sp, dt);
      } else { animateHippo(n.obj, Math.sin(T) > .6 ? 2 : 0, dt); n.yaw += Math.sin(T * .7) * dt * .5; }
      n.obj.position.set(n.x, 0, n.z); n.obj.rotation.y = n.yaw; continue;
    }
    const talkNow = dlg.npc === n;
    if (n.rig) { const A = n.rig.actions.agree; if (talkNow && !n.talkAnim && A) { A.reset().setEffectiveWeight(0.8).play(); n.talkAnim = true; } else if (!talkNow && n.talkAnim && A) { A.stop(); n.talkAnim = false; } }
    if (n.window) { n.rig.setWalk(0, dt); continue; }
    const face = Math.hypot(n.x - P.x, n.z - P.z) < 8 ? Math.atan2(P.x - n.x, P.z - n.z) : n.yaw;
    n.obj.rotation.y = lerpAngle(n.obj.rotation.y, face, dt * 4);
    n.rig.setWalk(0, dt);
  }
  // ---- pedestrians
  for (const p of peds) {
    const farPed = Math.hypot(p.obj.position.x - P.x, p.obj.position.z - P.z) > 150;   // far away: skip animation work
    if (p.pause > 0) { p.pause -= dt; p.rig.setWalk(0, dt); continue; }
    p.s += p.dir * p.v * dt; if (p.s < 0 || p.s > p.L) { p.dir *= -1; p.s = clamp(p.s, 0, p.L); }
    const q = roadPoint(p.r, p.s); const ox = -q.dz * p.off, oz = q.dx * p.off;
    let x = q.x + ox, z = q.z + oz; [x, z] = W.collider.resolve(x, z, 0.35);
    p.obj.position.set(x, 0, z); p.obj.rotation.y = Math.atan2(q.dx * p.dir, q.dz * p.dir); if (!farPed) p.rig.setWalk(p.v, dt);
  }
  // ---- traffic
  for (const c of cars) {
    const q = roadPoint(c.r, c.s), dir = c.dir, lane = c.r.w / 4 * dir;
    const x = q.x - q.dz * lane, z = q.z + q.dx * lane;
    // brake if Câmpi is in front
    const fx = q.dx * dir, fz = q.dz * dir, px = P.x - x, pz = P.z - z, ahead = px * fx + pz * fz, lateral = Math.abs(-px * fz + pz * fx);
    const blocked = ahead > 0 && ahead < 10 && lateral < 1.6;
    c.v += ((blocked ? 0 : c.vmax) - c.v) * Math.min(1, dt * (blocked ? 4 : 0.8));
    if (blocked && c.honk <= 0) { SFX.horn(); c.honk = 3; }
    c.honk -= dt;
    c.s += dir * c.v * dt; if (c.s > c.L) { c.s = c.L; c.dir = -1; } if (c.s < 0) { c.s = 0; c.dir = 1; }
    c.obj.position.set(x, 0, z); c.obj.rotation.y = Math.atan2(fx, fz);
    if (ahead > -2.2 && ahead < 2.4 && lateral < 1.1 && c.v > 4 && P.hurt <= 0 && P.y < 1.5) {
      P.knock.set(fx * 14, fz * 14); P.vy = 6; P.hurt = 1.2; state.hits++; SFX.hit(); campiSay(pick(['Au! Futu-i!', 'Bă, fii atent pe unde mergi!'])); flash(); money(-10); toast(pick(CAR_HITS), 2500); if (navigator.vibrate) navigator.vibrate(200);
    }
  }
  // ---- dogs
  for (const d of dogs) {
    const dx = P.x - d.x, dz = P.z - d.z, dist = Math.hypot(dx, dz);
    if (d.pack && !talking) {
      d.cool = Math.max(0, d.cool - dt);
      if (dist < 38 && state.mission === 'metrou') {
        d.v = Math.min(7.4, d.v + dt * 10); d.x += dx / dist * d.v * dt; d.z += dz / dist * d.v * dt; [d.x, d.z] = W.collider.resolve(d.x, d.z, 0.4);
        d.bark -= dt; if (d.bark <= 0) { SFX.bark(); d.bark = rand(0.6, 1.5); }
        if (dist < 1.1 && d.cool <= 0) { d.cool = 2; P.hurt = .8; state.bites++; SFX.bite(); campiSay('Lasă-mă, bă, câine!'); flash(); money(-5); toast(pick(DOG_BITES)); P.knock.set(dx / dist * 6, dz / dist * 6); if (navigator.vibrate) navigator.vibrate(120); }
      } else d.v = Math.max(0, d.v - dt * 8);
      d.obj.position.set(d.x, 0, d.z); if (d.v > .1) d.obj.rotation.y = Math.atan2(dx, dz); animateDog(d.obj, d.v, dt, T);
    } else if (d.sleeping) {
      if (dist < 5) { d.bark -= dt; if (d.bark <= 0) { SFX.bark(); d.bark = 1.8; } d.obj.rotation.y = lerpAngle(d.obj.rotation.y, Math.atan2(dx, dz), dt * 4); }
      animateDog(d.obj, 0, dt, T);
    }
  }
  // ---- coins
  for (const c of coins) {
    if (c.got) continue; c.obj.rotation.y += dt * 3; c.obj.position.y = 1.2 + Math.sin(T * 3 + c.x) * .12;
    if (Math.hypot(c.x - P.x, c.z - P.z) < 1.3 && Math.abs(P.y + 1 - c.obj.position.y) < 2) {
      c.got = true; c.obj.visible = false; state.coins++; SFX.coin();
      if (state.lastCoin === 6 && c.k === 7) { bigmsg('SIX SEVEN!'); campiSay('Six seven!'); state.happy = 1.5; money(6); } else toast(`${c.k}! (${state.coins}/20)`);
      state.lastCoin = c.k; updateHUD();
      if (state.coins === 20) { bigmsg('TOATE 20!'); money(67); voice('stutter'); }
    }
  }
  // ---- mission: metro arrival
  if (state.mission === 'metrou' && state.follower && Math.hypot(P.x - LOC.metro[0], P.z - LOC.metro[1]) < 7 && !state.finale) finale();
  // ---- beacon & marker
  const tgt = targetPos();
  if (tgt) { beacon.visible = true; beacon.position.set(tgt[0], 60, tgt[1]); beacon.material.opacity = 0.16 + Math.sin(T * 3) * 0.06; }
  else beacon.visible = false;
  const mNpc = (() => { const m = MISSIONS[state.mission]; if (!m || !m.target || m.target === 'metrou') return null; const ids = Array.isArray(m.target) ? m.target : [m.target]; return npcs.find(n => n.id === ids[0]); })();
  if (mNpc) { targetMarker.visible = true; const p = mNpc.window ? mNpc.anchor : mNpc.obj.position; targetMarker.position.set(p.x, (mNpc.window ? p.y + 1.4 : 3.4) + Math.sin(T * 4) * .15, p.z); } else targetMarker.visible = false;

  // ---- camera
  if (!talking && performance.now() - lastLook > 1800 && P.speed > 1) camYaw = lerpAngle(camYaw, P.yaw + Math.PI, dt * 1.2);
  camTarget.set(P.x, P.y + 1.7, P.z);
  let dist = camDist + (P.scooter ? clamp(P.speed / 17, 0, 1) * 2.5 : 0);
  if (talking && dlg.npc) { // cinematic over-the-shoulder shots; Câmpi's lines show his face
    const n = dlg.npc, npos = n.obj && !n.window ? n.obj.position : null;
    const nx = n.window ? n.anchor.x : npos ? npos.x : n.x, nz = n.window ? n.anchor.z : npos ? npos.z : n.z, ny = n.window ? n.anchor.y : (n.hippo ? 0.9 : 2.0);
    let ddx = nx - P.x, ddz = nz - P.z; const L = Math.hypot(ddx, ddz) || 1; ddx /= L; ddz /= L;
    P.yaw = lerpAngle(P.yaw, Math.atan2(ddx, ddz), Math.min(1, dt * 6)); campi.rotation.y = P.yaw;
    const px = -ddz, pz = ddx, head = new THREE.Vector3(P.x, P.y + 1.68, P.z);
    if (dlg.talking === 'me' || n.hippo) { camPos.set(P.x + ddx * 1.25 + px * 0.45, P.y + 1.78, P.z + ddz * 1.25 + pz * 0.45); camTarget.copy(head); }
    else { camPos.set(P.x - ddx * 1.7 + px * 0.8, P.y + 2.0, P.z - ddz * 1.7 + pz * 0.8); camTarget.set(nx, ny * 0.86, nz); }
    camera.position.lerp(camPos, Math.min(1, dt * 5)); camera.lookAt(camTarget);
    sun.position.set(P.x + SUN_OFF.x, SUN_OFF.y, P.z + SUN_OFF.z); sun.target.position.set(P.x, 0, P.z);
    drawMinimap(targetPos()); return;
  }
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  let dx = Math.sin(camYaw) * cp, dz = Math.cos(camYaw) * cp, dy = sp;
  // occlusion: pull camera in front of buildings
  for (let k = 1; k <= 10; k++) {
    const t = k / 10 * dist, x = camTarget.x + dx * t, z = camTarget.z + dz * t, y = camTarget.y + dy * t;
    if (W.collider.near(x, z).some(p => p.data?.building !== undefined && y < p.data.h + 0.5 && Collider.inside(p.pts, x, z))) { dist = Math.max(2.2, t - 0.8); break; }
  }
  camPos.set(camTarget.x + dx * dist, camTarget.y + dy * dist, camTarget.z + dz * dist);
  camera.position.lerp(camPos, Math.min(1, dt * 10)); camera.lookAt(camTarget);
  sun.position.set(P.x + SUN_OFF.x, SUN_OFF.y, P.z + SUN_OFF.z); sun.target.position.set(P.x, 0, P.z);
  // ---- minimap
  drawMinimap(tgt);
  updateEnvAudio(dt);
  // ---- night: move the pool of real point lights to the nearest street lamps
  if (NIGHT && W.lamps && (T - (state.lampT || 0) > 0.4)) { state.lampT = T;
    const near = W.lamps.map(l => [l, (l[0] - P.x) ** 2 + (l[1] - P.z) ** 2]).sort((a, b) => a[1] - b[1]);
    nightLights.forEach((L, i) => { const e = near[i]; if (!e) { L.intensity = 0; return; } L.position.set(e[0][0], 6.9, e[0][1]); L.intensity = 60; }); }
  if (!NIGHT && nightLights[0].intensity) nightLights.forEach(L => L.intensity = 0);
  // ---- tram
  if (tram) { tram.s += tram.dir * 9 * dt; if (tram.s > tram.L) { tram.s = tram.L; tram.dir = -1; } if (tram.s < 0) { tram.s = 0; tram.dir = 1; }
    const q = pathPoint(tram.pts, tram.s), fx = q.dx * tram.dir, fz = q.dz * tram.dir; tram.obj.position.set(q.x, 0, q.z); tram.obj.rotation.y = Math.atan2(fx, fz);
    const px = P.x - q.x, pz = P.z - q.z, ahead = px * fx + pz * fz, lat = Math.abs(-px * fz + pz * fx);
    if (Math.abs(ahead) < 15 && lat < 1.6 && P.hurt <= 0 && P.y < 2.5) { P.knock.set(fx * 16 + -fz * 6, fz * 16 + fx * 6); P.vy = 7; P.hurt = 1.4; state.hits++; SFX.hit(); SFX.horn(); campiSay('Au! Futu-i!'); flash(); money(-10); toast('Te-a luat tramvaiul. La propriu.', 2500); if (P.scooter) toggleScooter(false); } }
}
async function finale() {
  state.finale = true; SFX.finale(); voice('stutter'); bigmsg('SIX SEVEN!'); state.happy = 6;
  setTimeout(() => campiSay('Am reușit, coaie!'), 1500);
  await new Promise(r => setTimeout(r, 3500));
  state.finale = false; state.done = true; setMission('gata'); saveGame();
  const secs = Math.round((performance.now() - state.t0) / 1000);
  $('endStats').innerHTML = `Ai dus-o pe Moo Deng la metrou în <b>${Math.floor(secs / 60)} min ${secs % 60} s</b>.<br>Bani rămași: <b>${state.money} lei</b> · 6-7 găsite: <b>${state.coins}/20</b><br>Mușcături de maidanez: <b>${state.bites}</b> · Loviri de mașină: <b>${state.hits}</b>` + (state.flags.pawned ? `<br>Ai amanetat ${state.flags.pawned}. Nu i-o zice lu\' mă-ta.` : '');
  $('end').classList.remove('hidden');
}
$('freeRoam').onclick = () => { $('end').classList.add('hidden'); };
$('share').onclick = () => {
  const secs = Math.round((performance.now() - state.t0) / 1000);
  const txt = `🦛 Am terminat CÂMPI ÎN DRISTOR în ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}, cu ${state.money} lei și ${state.coins}/20 de 6-7! Poți mai repede?\n${location.href.split('#')[0]}`;
  open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
};

function loop() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (running) update(dt);
  if (DET && (detT -= dt) <= 0) { detT = 0.4; DET.cull(camera.position); }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------- Boot
setup().then(() => {
  $('loading').textContent = 'Gata. Alege o salvare.'; renderSaves(true);
  camera.position.set(P.x + 20, 30, P.z + 20); camera.lookAt(P.x, 0, P.z);
  loop();
}).catch(e => { console.error(e); $('loading').textContent = 'Eroare la încărcare: ' + e.message; });
// ---------------- Save games: 3 slots in this browser (localStorage), autosave every 10 s and on every mission change
const SAVE_KEY = (i) => 'campi-dristor-save-' + i;
let slot = 0, saveTimer = 0;
function readSave(i) { try { const s = localStorage.getItem(SAVE_KEY(i)); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function snapshot() {
  const { money, inv, mission, flags, coins: nCoins, follower, bites, hits, spins, lastCoin, done } = state;
  return { v: 1, t: Date.now(), play: Math.round((performance.now() - state.t0) / 1000), state: { money, inv, mission, flags, coins: nCoins, follower, bites, hits, spins, lastCoin, done },
    P: { x: +P.x.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3) }, night: NIGHT, coins: coins.map(c => c.got ? 1 : 0) };
}
function saveGame() { if (!slot || !running || state.finale) return; try { localStorage.setItem(SAVE_KEY(slot), JSON.stringify(snapshot())); } catch (e) { } }
function applySave(d) {
  Object.assign(state, d.state); state.t0 = performance.now() - (d.play || 0) * 1000;
  P.x = d.P.x; P.z = d.P.z; P.yaw = d.P.yaw; camYaw = P.yaw + Math.PI;
  (d.coins || []).forEach((g, i) => { const c = coins[i]; if (c && g) { c.got = true; c.obj.visible = false; } });
  if (state.follower) { const md = npcs.find(n => n.id === 'moodeng'); if (md) { md.x = P.x - Math.sin(P.yaw) * 2.6; md.z = P.z - Math.cos(P.yaw) * 2.6; } }
  if (state.mission === 'metrou') spawnDogs();
  if (d.night) setTimeOfDay(true);
}
function fmtSave(d) {
  const m = MISSIONS[d.state.mission], date = new Date(d.t), mins = Math.floor((d.play || 0) / 60);
  return `<b>${d.state.done ? 'Terminat ✔' : (m ? m.title : '')}</b><small>💰 ${d.state.money} lei · 6·7 ${d.state.coins}/20 · ${mins} min · ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</small>`;
}
function renderSaves(ready) {
  const box = $('saves'); box.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const d = readSave(i), row = document.createElement('div'); row.className = 'saverow';
    const b = document.createElement('button'); b.className = 'btn saveslot' + (d ? '' : ' empty'); b.disabled = !ready;
    b.innerHTML = `<span class="slotn">${i}</span><span class="slott">${d ? fmtSave(d) : '<b>Joc nou</b><small>slot liber</small>'}</span>`;
    b.onclick = () => startGame(i, d);
    row.appendChild(b);
    if (d) { const x = document.createElement('button'); x.className = 'btn grey savedel'; x.textContent = '✕'; x.title = 'Șterge salvarea';
      x.onclick = () => { if (x.dataset.sure) { try { localStorage.removeItem(SAVE_KEY(i)); } catch (e) { } renderSaves(ready); } else { x.dataset.sure = 1; x.textContent = 'Sigur?'; setTimeout(() => { if (x.isConnected) { delete x.dataset.sure; x.textContent = '✕'; } }, 2500); } };
      row.appendChild(x); }
    box.appendChild(row);
  }
}
renderSaves(false);
function startGame(i, d) {
  initAudio(); unlockAudio();
  slot = i;
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
  running = true; state.t0 = performance.now();
  if (d) { applySave(d); toast('Salvarea ' + i + ' încărcată'); }
  updateHUD(); voice('start');
  if (!d) setTimeout(() => phone('Mama', 'Câmpi, unde ești?? Treci pe la Tanti Geta, că te-a căutat. Stă la geam, ca de obicei. Și ia pâine!'), 1200);
  saveGame(); clearInterval(saveTimer); saveTimer = setInterval(saveGame, 10000);
}
addEventListener('pagehide', saveGame); document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
$('play').onclick = () => startGame(1, null);   // (kept for the automated tests)
window.__g = { setTimeOfDay: (n) => setTimeOfDay(n), camPos, camTarget, setCam(y, p, d) { camYaw = y; camPitch = p; if (d) camDist = d; lastLook = performance.now() + 1e6; }, state, P, npcs, LOC, setMission, talkTo, get W() { return W; }, get DET() { return DET; }, get campi() { return campi; }, get mooDeng() { return mooDeng; }, toggleScooter: (v) => toggleScooter(v), camera, scene, renderer, update, input };
