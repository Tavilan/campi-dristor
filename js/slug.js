// Stable id for a spoken line (shared by the game and tools/extract_lines.mjs)
export function lineId(text) {
  const base = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
  let h = 0; for (const ch of text) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return base + '-' + (h % 46656).toString(36);
}
