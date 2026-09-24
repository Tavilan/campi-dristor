// Who speaks with which voice (shared by the game and tools/extract_npc_lines.mjs)
export const SPEAKERS = {
  geta:      { match: /geta/i,           gender: 'female', age: 'old',    pitch: 1.1,  rate: 0.98 },
  farmacista:{ match: /farmacist/i,      gender: 'female', age: 'middle', pitch: 1.05, rate: 1.0 },
  nelu:      { match: /nelu/i,           gender: 'male',   age: 'middle', pitch: 0.9,  rate: 1.05 },
  gigi:      { match: /gigi/i,           gender: 'male',   age: 'young',  pitch: 1.0,  rate: 1.1 },
  costel:    { match: /costel/i,         gender: 'male',   age: 'old',    pitch: 0.85, rate: 0.95 },
  taxi:      { match: /taxi/i,           gender: 'male',   age: 'middle', pitch: 0.95, rate: 1.08 },
  vecin:     { match: /vecinu/i,         gender: 'male',   age: 'middle', pitch: 0.88, rate: 1.0 },
  florinel:  { match: /florinel/i,       gender: 'male',   age: 'young',  pitch: 1.02, rate: 1.12 },
  mitica:    { match: /mitic/i,          gender: 'male',   age: 'old',    pitch: 0.8,  rate: 0.92 },
  madalina:  { match: /mădălina|madalina/i, gender: 'female', age: 'young', pitch: 1.15, rate: 1.05 },
  politist:  { match: /agent|poli/i,     gender: 'male',   age: 'middle', pitch: 0.92, rate: 1.0 },
  ped_f:     { match: /vecină|doamna|o /i, gender: 'female', age: 'middle', pitch: 1.1, rate: 1.03 },
  ped_m:     { match: /./,               gender: 'male',   age: 'middle', pitch: 0.95, rate: 1.03 },
};
export function speakerKey(name) {
  for (const [k, s] of Object.entries(SPEAKERS)) if (s.match.test(name)) return k;
  return 'ped_m';
}
