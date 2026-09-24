#!/usr/bin/env python3
"""Overpass JSON (out geom) -> compact map.json for the game, in local meters.
x = east, z = south (three.js: -z is north). Coordinates stored as ints in decimeters.

v2: heights from building:levels (Romanian storey heights), missing levels inferred from the most
similar tagged blocks nearby (footprint area, slenderness, depth, distance), brands for shops,
lake islands (inner rings), fences, tree rows, benches, playgrounds, fountains, kiosks, block names."""
import json, math, sys, hashlib
from collections import Counter

src = sys.argv[1] if len(sys.argv) > 1 else 'dristor.json'
dst = sys.argv[2] if len(sys.argv) > 2 else 'assets/map.json'
RADIUS = float(sys.argv[3]) if len(sys.argv) > 3 else 1100
D = json.load(open(src))
els = D['elements']

center = None
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node' and t.get('name') == 'Dristor 1' and t.get('railway') == 'station':
        center = (e['lat'], e['lon']); break
if not center:
    for e in els:
        t = e.get('tags', {})
        if e['type'] == 'node' and 'dristor' in t.get('name', '').lower() and t.get('railway') in ('station', 'subway_entrance'):
            center = (e['lat'], e['lon']); break
LAT0, LON0 = center
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0
def P(lat, lon): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)
def q(v): return int(round(v * 10))
def poly(geom): return [P(g['lat'], g['lon']) for g in geom if g]
def inside(pts): return any(x * x + z * z < RADIUS * RADIUS for x, z in pts)
def area(pts):
    a = 0
    for i in range(len(pts)):
        x1, z1 = pts[i]; x2, z2 = pts[(i + 1) % len(pts)]; a += x1 * z2 - x2 * z1
    return a / 2
def simplify(pts, tol=0.4):
    if len(pts) < 4: return pts
    out = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, out[-1]) > tol: out.append(p)
    return out
def rnd(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff
def qp(pts): return [[q(x), q(z)] for x, z in pts]
def rect(pts):
    """min-area bounding rectangle -> (slenderness, long side, short side)"""
    best = None
    for i in range(len(pts)):
        x1, z1 = pts[i]; x2, z2 = pts[(i + 1) % len(pts)]; L = math.hypot(x2 - x1, z2 - z1)
        if L < 1: continue
        ux, uz = (x2 - x1) / L, (z2 - z1) / L
        a = [x * ux + z * uz for x, z in pts]; b = [-x * uz + z * ux for x, z in pts]
        w, h = max(a) - min(a), max(b) - min(b)
        if best is None or w * h < best[0]: best = (w * h, max(w, h), min(w, h))
    if not best: return 1, 1, 1
    return best[1] / max(0.5, best[2]), best[1], best[2]

# Romanian blocks: ground floor ~3.0 m, typical floor 2.75 m, parapet/roof slab ~0.6 m
def height_of(levels, kind):
    if kind in ('garage', 'garages', 'shed', 'kiosk', 'container', 'hut'): return 2.6
    if kind in ('retail', 'commercial', 'supermarket', 'industrial', 'warehouse'): return max(4.5, levels * 4.2)
    return 3.0 + (levels - 1) * 2.75 + 0.6

ROADW = {'motorway': 20, 'trunk': 22, 'primary': 20, 'secondary': 15, 'tertiary': 11, 'unclassified': 7, 'residential': 7,
         'living_street': 6, 'service': 4.5, 'pedestrian': 6, 'footway': 2.2, 'path': 2, 'cycleway': 2, 'steps': 2, 'track': 3,
         'primary_link': 8, 'secondary_link': 7, 'tertiary_link': 7, 'trunk_link': 8}
AREA_KIND = {
    ('leisure', 'park'): 'park', ('leisure', 'garden'): 'park', ('leisure', 'playground'): 'play', ('leisure', 'pitch'): 'pitch',
    ('landuse', 'grass'): 'grass', ('landuse', 'recreation_ground'): 'park', ('natural', 'wood'): 'wood', ('natural', 'scrub'): 'grass',
    ('natural', 'grassland'): 'grass', ('landuse', 'village_green'): 'grass', ('natural', 'wetland'): 'wetland',
    ('natural', 'water'): 'water', ('landuse', 'basin'): 'water', ('landuse', 'reservoir'): 'water', ('leisure', 'swimming_pool'): 'pool',
    ('amenity', 'parking'): 'parking', ('amenity', 'marketplace'): 'market', ('landuse', 'retail'): 'retail', ('landuse', 'commercial'): 'retail',
    ('landuse', 'garages'): 'garages', ('amenity', 'school'): 'school', ('amenity', 'kindergarten'): 'school', ('landuse', 'railway'): 'rail',
    ('landuse', 'construction'): 'construction', ('leisure', 'sports_centre'): 'pitch', ('leisure', 'dog_park'): 'dog',
    ('landuse', 'cemetery'): 'grass', ('landuse', 'religious'): 'grass', ('leisure', 'marina'): 'pier',
}
def area_kind(t):
    for (k, v), kind in AREA_KIND.items():
        if t.get(k) == v: return kind
    return None

raw_b = []   # buildings before height inference
roads, areas, pois, rails, fences, treerows, props = [], [], [], [], [], [], []

def add_building(pts, t, eid, holes=None):
    pts = simplify(pts)
    if len(pts) < 3 or not inside(pts): return
    if pts[0] == pts[-1]: pts = pts[:-1]
    a = area(pts)
    if a < 0: pts = pts[::-1]; a = -a
    if a < 8: return
    lv = t.get('building:levels'); h = t.get('height')
    try: levels = float(str(lv).split(';')[0].replace(',', '.')) if lv else None
    except ValueError: levels = None
    try: height = float(str(h).replace('m', '').split(';')[0]) if h else None
    except ValueError: height = None
    sl, lo, sh = rect(pts)
    cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
    raw_b.append(dict(pts=pts, t=t, id=eid, A=a, sl=sl, lo=lo, sh=sh, c=(cx, cz), levels=levels, height=height,
                      kind=t.get('building', t.get('building:part', 'yes'))))

def ring_join(ways):
    """join outer member ways of a multipolygon into closed rings"""
    segs = [w[:] for w in ways if len(w) >= 2]; rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while changed and math.dist(cur[0], cur[-1]) > 0.5:
            changed = False
            for i, s in enumerate(segs):
                if math.dist(cur[-1], s[0]) < 0.5: cur += s[1:]; segs.pop(i); changed = True; break
                if math.dist(cur[-1], s[-1]) < 0.5: cur += s[::-1][1:]; segs.pop(i); changed = True; break
        rings.append(cur)
    return rings

for e in els:
    t = e.get('tags', {}) or {}
    if e['type'] == 'way' and 'geometry' in e:
        pts = poly(e['geometry'])
        if 'building' in t or 'building:part' in t:
            add_building(pts, t, e['id'])
        elif 'highway' in t and t['highway'] in ROADW:
            if not inside(pts) or t.get('area') == 'yes': continue
            if t.get('layer') and t.get('layer').lstrip('-').isdigit() and int(t['layer']) < 0: continue  # tunnels
            r = {'p': qp(simplify(pts, 0.8)), 'w': ROADW[t['highway']], 'k': t['highway']}
            if t.get('name'): r['n'] = t['name']
            if t.get('lanes'): r['ln'] = t['lanes']
            if t.get('oneway') == 'yes': r['o'] = 1
            roads.append(r)
        elif t.get('railway') in ('tram', 'rail', 'light_rail'):
            if inside(pts): rails.append({'p': qp(simplify(pts, 1)), 'k': t['railway']})
        elif t.get('barrier') in ('fence', 'wall', 'hedge'):
            if inside(pts): fences.append({'p': qp(simplify(pts, 0.5)), 'k': t['barrier']})
        elif t.get('natural') == 'tree_row':
            if inside(pts): treerows.append({'p': qp(simplify(pts, 0.5))})
        else:
            k = area_kind(t)
            if k and inside(pts) and len(pts) >= 3:
                pts = simplify(pts)
                if area(pts) < 0: pts = pts[::-1]
                a = {'p': qp(pts), 'k': k}
                if t.get('name'): a['n'] = t['name']
                areas.append(a)
            if t.get('shop') or t.get('amenity') in ('pharmacy', 'fast_food', 'restaurant', 'cafe', 'bar', 'pub', 'bank', 'gambling', 'casino', 'marketplace', 'place_of_worship', 'fuel', 'post_office', 'fountain'):
                cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
                if cx * cx + cz * cz < RADIUS * RADIUS:
                    p = {'x': q(cx), 'z': q(cz), 'k': t.get('shop') or t.get('amenity'), 'n': t.get('name', ''), 'c': t.get('cuisine', '')}
                    if t.get('brand'): p['b'] = t['brand']
                    pois.append(p)
    elif e['type'] == 'relation':
        outers = [poly(m['geometry']) for m in e.get('members', []) if m.get('type') == 'way' and m.get('role') == 'outer' and 'geometry' in m]
        inners = [poly(m['geometry']) for m in e.get('members', []) if m.get('type') == 'way' and m.get('role') == 'inner' and 'geometry' in m]
        for ring in ring_join(outers):
            if 'building' in t: add_building(ring, t, str(e['id']) + str(len(ring))); continue
            k = area_kind(t)
            if not k or not inside(ring) or len(ring) < 3: continue
            ring = simplify(ring)
            if area(ring) < 0: ring = ring[::-1]
            a = {'p': qp(ring), 'k': k, 'n': t.get('name', '')}
            hs = [simplify(h) for h in ring_join(inners) if len(h) >= 3]
            if hs: a['h'] = [qp(h) for h in hs]
            areas.append(a)
    elif e['type'] == 'node':
        x, z = P(e['lat'], e['lon'])
        if x * x + z * z > RADIUS * RADIUS: continue
        am = t.get('amenity')
        if am in ('bench', 'fountain', 'recycling', 'waste_basket', 'parcel_locker', 'drinking_water') or t.get('leisure') == 'playground' or t.get('natural') == 'tree' or t.get('playground'):
            props.append([q(x), q(z), 'playground' if (t.get('leisure') == 'playground' or t.get('playground')) else 'tree' if t.get('natural') == 'tree' else am])
            if am == 'bench': pois.append({'x': q(x), 'z': q(z), 'k': 'bench', 'n': '', 'c': ''})
            continue
        k = t.get('shop') or am or t.get('railway') or t.get('public_transport') or t.get('leisure') or t.get('tourism')
        if not k: continue
        if t.get('railway') == 'subway_entrance' or t.get('station') == 'subway': k = 'subway'
        if t.get('highway') == 'bus_stop' or t.get('public_transport') == 'platform' and t.get('bus') == 'yes': k = 'bus_stop'
        p = {'x': q(x), 'z': q(z), 'k': k, 'n': t.get('name', ''), 'c': t.get('cuisine', '')}
        if t.get('brand'): p['b'] = t['brand']
        pois.append(p)

# ---- height inference: copy the storey count of the most similar tagged blocks nearby
RESID = ('yes', 'apartments', 'residential')
tagged = [b for b in raw_b if b['levels'] and b['kind'] in RESID and b['A'] > 60]
cell = {}
for b in tagged: cell.setdefault((int(b['c'][0] // 150), int(b['c'][1] // 150)), []).append(b)
def neighbours(b):
    cx, cz = int(b['c'][0] // 150), int(b['c'][1] // 150)
    for dx in (-2, -1, 0, 1, 2):
        for dz in (-2, -1, 0, 1, 2): yield from cell.get((cx + dx, cz + dz), [])
def infer(b):
    cand = []
    for o in neighbours(b):
        if o is b: continue
        d = math.dist(b['c'], o['c'])
        if d > 350: continue
        s = d / 120 + abs(math.log(b['A'] / o['A'])) * 1.6 + abs(math.log(b['sl'] / o['sl'])) * 0.8 + abs(b['sh'] - o['sh']) / 6
        cand.append((s, o['levels']))
    if len(cand) < 2: return None
    cand.sort(); top = cand[:5]
    ws = sorted((lv, 1 / (0.2 + s)) for s, lv in top); tot = sum(w for _, w in ws); acc = 0
    for lv, w in ws:
        acc += w
        if acc >= tot / 2: return lv
inferred = Counter()
buildings = []
for b in raw_b:
    t, kind, a, levels, height = b['t'], b['kind'], b['A'], b['levels'], b['height']
    src_tag = 'osm'
    if levels is None and height is None:
        if kind in ('garage', 'garages', 'shed', 'kiosk', 'roof', 'hut', 'container'): levels = 1
        elif kind in ('church',): levels = 3
        elif kind in ('house', 'detached', 'semidetached_house'): levels = 1 + int(rnd(b['id']) * 2)
        elif kind in RESID and a > 120:
            levels = infer(b); src_tag = 'inf'
            if levels is None:
                src_tag = 'guess'
                levels = (5 if rnd(b['id']) < 0.4 else 9 if rnd(b['id'] + 1) < 0.5 else 11) if a > 500 else 2 + int(rnd(b['id']) * 3)
        elif a > 150: levels = 2 + int(rnd(b['id']) * 2)
        else: levels = 1 + int(rnd(b['id']) * 2)
        inferred[src_tag] += 1
    if height is None: height = height_of(levels, kind)
    if levels is None: levels = max(1, round((height - 0.6) / 2.8))
    o = {'p': qp(b['pts']), 'h': round(height, 1), 'l': int(levels)}
    if kind not in RESID: o['k'] = kind
    if t.get('name'): o['n'] = t['name']
    if t.get('shop') or t.get('amenity'): o['s'] = t.get('shop') or t.get('amenity')
    if t.get('brand'): o['b'] = t['brand']
    if t.get('roof:shape') and t['roof:shape'] != 'flat': o['r'] = t['roof:shape']
    if t.get('building:colour'): o['c'] = t['building:colour']
    buildings.append(o)

out = {'v': 2, 'center': [LAT0, LON0], 'radius': RADIUS, 'buildings': buildings, 'roads': roads, 'areas': areas, 'pois': pois,
       'rails': rails, 'fences': fences, 'treerows': treerows, 'props': props}
json.dump(out, open(dst, 'w'), separators=(',', ':'), ensure_ascii=False)
print(f'center {LAT0:.5f},{LON0:.5f}  buildings {len(buildings)}  roads {len(roads)}  areas {len(areas)}  pois {len(pois)}  rails {len(rails)}  fences {len(fences)}  treerows {len(treerows)}  props {len(props)}')
print('levels source', dict(inferred), ' tagged', sum(1 for b in raw_b if b['levels']))
print('levels', Counter(b['l'] for b in buildings if b['p'] and b.get('k') is None).most_common(12))
print('props', Counter(p[2] for p in props))
print('brands', Counter(p.get('b') for p in pois if p.get('b')).most_common(60))
