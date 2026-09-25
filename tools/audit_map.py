#!/usr/bin/env python3
"""Audit the raw OSM buildings: report buildings sitting in parks/green/water/pitches and how their height was obtained."""
import json, sys, math
from collections import Counter
sys.argv = [sys.argv[0], sys.argv[1] if len(sys.argv) > 1 else 'dristor.json', '/tmp/aud/m.json']
import runpy
g = runpy.run_path('tools/osm2map.py')
raw_b, areas = g['raw_b'], g['areas']
def pip(x, z, p):
    c = False; n = len(p)
    for i in range(n):
        x1, z1 = p[i]; x2, z2 = p[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1: c = not c
    return c
green = [(a['k'], a.get('n', ''), [(x / 10, z / 10) for x, z in a['p']], [[(x / 10, z / 10) for x, z in h] for h in a.get('h', [])]) for a in areas if a['k'] in ('park', 'grass', 'wood', 'water', 'pitch', 'play', 'pier', 'school', 'dog')]
rows = []
for b in raw_b:
    cx, cz = b['c']
    for k, n, p, hs in green:
        if pip(cx, cz, p) and not any(pip(cx, cz, h) for h in hs):
            rows.append((k, n, b['kind'], round(b['A']), b['levels'], {kk: v for kk, v in b['t'].items() if kk not in ('building',)}, round(cx), round(cz), b['id'])); break
print(len(rows), 'buildings inside green/water areas')
for r in sorted(rows, key=lambda r: -r[3]): print(r)
