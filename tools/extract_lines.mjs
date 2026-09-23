// Collects every line Câmpi says in content.js -> assets/voice/campi/replici.json (for ElevenLabs generation)
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { lineId } from '../js/slug.js';
const src = readFileSync(new URL('../js/content.js', import.meta.url), 'utf8');
const out = []; const seen = new Set();
const re = /c\.me\((['`])((?:\\.|(?!\1).)*)\1\)/g; let m;
while ((m = re.exec(src))) {
  let t = m[2].replace(/\\'/g, "'");
  if (t.includes('${')) continue; // dynamic lines stay as babble
  const id = lineId(t); if (seen.has(id)) continue; seen.add(id); out.push({ id, text: t });
}
// dialogue choices are Câmpi speaking too
const reC = /c\.choose\(\[([^\]]*)\]\)/g;
while ((m = reC.exec(src))) { for (const q of m[1].matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)) { let t = q[2].replace(/\\'/g, "'"); if (t.includes('${')) continue; t = t.replace(/\s*\([^)]*\)\s*$/, ''); const id = lineId(t); if (!seen.has(id)) { seen.add(id); out.push({ id, text: t }); } } }
// extra reaction lines (used on events)
for (const t of ['Au! Futu-i!', 'Six seven!', 'Hai, Moo Deng, vino după mine!', 'Bă, fii atent pe unde mergi!', 'Lasă-mă, bă, câine!', 'Am reușit, coaie!']) { const id = lineId(t); if (!seen.has(id)) { seen.add(id); out.push({ id, text: t }); } }
mkdirSync(new URL('../assets/voice/campi/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/voice/campi/replici.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(out.length + ' replici');
