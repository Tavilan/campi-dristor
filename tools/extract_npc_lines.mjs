// Collects every NPC line in content.js -> assets/voice/npc/replici.json (for ElevenLabs generation)
// Each line gets a speaker key; the game finds the audio by  speaker + '_' + lineId(text).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { lineId } from '../js/slug.js';
import { speakerKey } from '../js/voices.js';
const src = readFileSync(new URL('../js/content.js', import.meta.url), 'utf8');

// read a JS string literal starting at i ('...' or `...`); returns [text|null, endIndex]
function readStr(s, i) {
  const q = s[i]; let j = i + 1, t = '';
  while (j < s.length && s[j] !== q) { if (s[j] === '\\') { t += s[j + 1]; j += 2; } else t += s[j++]; }
  return [q === '`' && t.includes('${') ? null : t, j + 1];
}
const out = []; const seen = new Set();
const add = (speaker, text) => {
  if (!text || /^\s*\*.*\*\s*$/.test(text)) return; // pure stage directions (Moo Deng) stay as SFX
  const id = speaker + '_' + lineId(text); if (seen.has(id)) return; seen.add(id);
  out.push({ id, speaker, text: text.replace(/\*[^*]+\*/g, '').replace(/\s+/g, ' ').trim() });
};
let i = 0;
while ((i = src.indexOf('c.say(', i)) >= 0) {
  let j = i + 6; while (/\s/.test(src[j])) j++;
  const [who, k] = readStr(src, j); j = k;
  let depth = 1;
  while (j < src.length && depth > 0) {
    const ch = src[j];
    if (ch === "'" || ch === '`' || ch === '"') { const [t, e] = readStr(src, j); if (t) add(speakerKey(who), t); j = e; continue; }
    if (ch === '(') depth++; if (ch === ')') depth--; j++;
  }
  i = j;
}
// random pedestrians: every line in a male and a female voice
const p0 = src.indexOf('export const PED_LINES'), p1 = src.indexOf('];', p0);
for (let j = src.indexOf('[', p0) + 1; j < p1; j++) {
  if (src[j] === "'" || src[j] === '`') { const [t, e] = readStr(src, j); add('ped_m', t); add('ped_f', t); j = e - 1; }
}
mkdirSync(new URL('../assets/voice/npc/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/voice/npc/replici.json', import.meta.url), JSON.stringify(out, null, 1));
const by = {}; for (const l of out) by[l.speaker] = (by[l.speaker] || 0) + 1;
console.log(out.length + ' replici, ' + out.reduce((a, l) => a + l.text.length, 0) + ' caractere', by);
