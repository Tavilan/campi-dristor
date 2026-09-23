#!/usr/bin/env python3
"""Overpass JSON (out geom) -> compact map.json for the game, in local meters.
x = east, z = south (three.js: -z is north). Coordinates stored as ints in decimeters."""
import json, math, sys, hashlib

src = sys.argv[1] if len(sys.argv) > 1 else 'dristor.json'
dst = sys.argv[2] if len(sys.argv) > 2 else 'assets/map.json'
RADIUS = float(sys.argv[3]) if len(sys.argv) > 3 else 900   # keep a disc of this radius (m) around the center
D = json.load(open(src))
els = D['elements']

# ---- center: Dristor metro station if present, otherwise the bbox middle
center = None
for e in els:
    t = e.get('tags', {})
    if e['type'] == 'node' and 'dristor' in t.get('name', '').lower() and (t.get('railway') in ('station', 'subway_entrance') or t.get('public_transport') or t.get('station') == 'subway'):
        center = (e['lat'], e['lon']); break
if not center:
    lats = [e['lat'] for e in els if e['type'] == 'node']; lons = [e['lon'] for e in els if e['type'] == 'node']
    center = ((min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2)
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
def rnd(s):  # deterministic pseudo-random per id
    return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff

buildings, roads, areas, pois, rails = [], [], [], [], []
ROADW = {'motorway': 20, 'trunk': 22, 'primary': 20, 'secondary': 15, 'tertiary': 11, 'unclassified': 7, 'residential': 7,
         'living_street': 6, 'service': 4.5, 'pedestrian': 6, 'footway': 2.2, 'path': 2, 'cycleway': 2, 'steps': 2, 'track': 3,
         'primary_link': 8, 'secondary_link': 7, 'tertiary_link': 7, 'trunk_link': 8}
AREA_KIND = {
    ('leisure', 'park'): 'park', ('leisure', 'garden'): 'park', ('leisure', 'playground'): 'play', ('leisure', 'pitch'): 'pitch',
    ('landuse', 'grass'): 'grass', ('landuse', 'recreation_ground'): 'park', ('natural', 'wood'): 'park', ('natural', 'scrub'): 'grass',
    ('natural', 'water'): 'water', ('landuse', 'basin'): 'water', ('landuse', 'reservoir'): 'water', ('amenity', 'parking'): 'parking',
    ('amenity', 'marketplace'): 'market', ('landuse', 'retail'): 'retail', ('landuse', 'commercial'): 'retail', ('landuse', 'garages'): 'garages',
    ('amenity', 'school'): 'school', ('landuse', 'railway'): 'rail', ('landuse', 'construction'): 'construction', ('leisure', 'sports_centre'): 'pitch',
}
def area_kind(t):
    for (k, v), kind in AREA_KIND.items():
        if t.get(k) == v: return kind
    return None

def add_building(pts, t, eid):
    pts = simplify(pts)
    if len(pts) < 3 or not inside(pts): return
    if pts[0] == pts[-1]: pts = pts[:-1]
    a = area(pts)
    if a < 0: pts = pts[::-1]; a = -a
    if a < 8: return
    lv = t.get('building:levels'); h = t.get('height')
    kind = t.get('building', 'yes')
    try: levels = float(str(lv).split(';')[0]) if lv else None
    except ValueError: levels = None
    try: height = float(str(h).replace('m', '').split(';')[0]) if h else None
    except ValueError: height = None
    if levels is None and height is None:
        if kind in ('garage', 'garages', 'shed', 'kiosk', 'roof', 'hut', 'container'): levels = 1
        elif kind in ('church',): levels = 3
        elif a > 1500: levels = 4 if rnd(eid) < 0.4 else 10
        elif a > 500: levels = 4 if rnd(eid) < 0.6 else 10     # the Dristor P+4 / P+10 mix
        elif a > 150: levels = 2 + int(rnd(eid) * 3)
        else: levels = 1 + int(rnd(eid) * 2)
    if height is None: height = levels * 2.9 + 0.8
    if levels is None: levels = max(1, round(height / 2.9))
    b = {'p': [[q(x), q(z)] for x, z in pts], 'h': round(height, 1), 'l': int(levels)}
    if kind not in ('yes', 'apartments', 'residential'): b['k'] = kind
    if t.get('name'): b['n'] = t['name']
    if t.get('shop') or t.get('amenity'): b['s'] = t.get('shop') or t.get('amenity')
    buildings.append(b)

for e in els:
    t = e.get('tags', {}) or {}
    if e['type'] == 'way' and 'geometry' in e:
        pts = poly(e['geometry'])
        if 'building' in t or 'building:part' in t:
            add_building(pts, t, e['id'])
        elif 'highway' in t and t['highway'] in ROADW:
            if not inside(pts): continue
            if t.get('area') == 'yes': continue
            r = {'p': [[q(x), q(z)] for x, z in simplify(pts, 0.8)], 'w': ROADW[t['highway']], 'k': t['highway']}
            if t.get('name'): r['n'] = t['name']
            if t.get('lanes'): r['ln'] = t['lanes']
            if t.get('oneway') == 'yes': r['o'] = 1
            if t.get('layer') and t.get('layer').lstrip('-').isdigit() and int(t['layer']) < 0: continue  # tunnels
            roads.append(r)
        elif t.get('railway') in ('tram', 'rail', 'light_rail'):
            if inside(pts): rails.append({'p': [[q(x), q(z)] for x, z in simplify(pts, 1)], 'k': t['railway']})
        else:
            k = area_kind(t)
            if k and inside(pts) and len(pts) >= 3:
                pts = simplify(pts)
                if area(pts) < 0: pts = pts[::-1]
                a = {'p': [[q(x), q(z)] for x, z in pts], 'k': k}
                if t.get('name'): a['n'] = t['name']
                areas.append(a)
            if t.get('shop') or t.get('amenity') in ('pharmacy', 'fast_food', 'restaurant', 'cafe', 'bar', 'pub', 'bank', 'gambling', 'casino', 'marketplace', 'place_of_worship', 'fuel', 'post_office'):
                cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
                if cx * cx + cz * cz < RADIUS * RADIUS:
                    pois.append({'x': q(cx), 'z': q(cz), 'k': t.get('shop') or t.get('amenity'), 'n': t.get('name', ''), 'c': t.get('cuisine', '')})
    elif e['type'] == 'relation':
        for m in e.get('members', []):
            if m.get('type') == 'way' and m.get('role') == 'outer' and 'geometry' in m:
                pts = poly(m['geometry'])
                if 'building' in t: add_building(pts, t, str(e['id']) + str(m['ref']))
                else:
                    k = area_kind(t)
                    if k and inside(pts):
                        if area(pts) < 0: pts = pts[::-1]
                        areas.append({'p': [[q(x), q(z)] for x, z in simplify(pts)], 'k': k, 'n': t.get('name', '')})
    elif e['type'] == 'node':
        x, z = P(e['lat'], e['lon'])
        if x * x + z * z > RADIUS * RADIUS: continue
        k = t.get('shop') or t.get('amenity') or t.get('railway') or t.get('public_transport') or t.get('leisure') or t.get('tourism')
        if not k: continue
        if t.get('railway') == 'subway_entrance' or t.get('station') == 'subway': k = 'subway'
        if t.get('highway') == 'bus_stop' or t.get('public_transport') == 'platform' and t.get('bus') == 'yes': k = 'bus_stop'
        pois.append({'x': q(x), 'z': q(z), 'k': k, 'n': t.get('name', ''), 'c': t.get('cuisine', '')})

out = {'center': [LAT0, LON0], 'radius': RADIUS, 'buildings': buildings, 'roads': roads, 'areas': areas, 'pois': pois, 'rails': rails}
json.dump(out, open(dst, 'w'), separators=(',', ':'), ensure_ascii=False)
from collections import Counter
print(f'center {LAT0:.5f},{LON0:.5f}  buildings {len(buildings)}  roads {len(roads)}  areas {len(areas)}  pois {len(pois)}  rails {len(rails)}')
print('poi kinds', Counter(p['k'] for p in pois).most_common(40))
print('named roads', sorted(set(r.get('n', '') for r in roads if r['k'] in ('primary', 'secondary', 'tertiary', 'trunk')))[:40])
