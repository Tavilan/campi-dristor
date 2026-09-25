#!/usr/bin/env python3
"""Split assets/map.json into js/map-part-1..N.js (plain JSON text slices). N is fixed so stale parts never linger."""
import os, sys
N = 12
s = open('assets/map.json', encoding='utf-8').read()
step = -(-len(s) // N)
for i in range(N):
    open(f'js/map-part-{i + 1}.js', 'w', encoding='utf-8').write(s[i * step:(i + 1) * step])
for i in range(N + 1, 31):
    if os.path.exists(f'js/map-part-{i}.js'): os.remove(f'js/map-part-{i}.js')
print('split', len(s), 'into', N, 'parts of', step)
