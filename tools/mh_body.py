"""Câmpi body from the MakeHuman hm08 base mesh + macro targets (all CC0, makehumancommunity/makehuman on GitHub).
Step 1 of 2: morphs the base mesh, keeps the 'body' group (triangulated, with UVs) and the joint helper centroids.
Output: /tmp/mh/mh_morphed.json  -> step 2 (tools/mh_fit.mjs, runs in the browser) fits the Xbot skeleton and skins it.
Usage: python3 tools/mh_body.py [muscle 0..1] [weight 0..1] [height 0..1]"""
import sys, json, numpy as np
D = '/tmp/mh/'
muscle, weight, height = (float(a) for a in (sys.argv[1:4] + ['0.8', '0.5', '0.6'][len(sys.argv[1:4]):]))
V, VT, faces, grp, cur = [], [], [], {}, None
for l in open(D + 'base.obj'):
    if l.startswith('v '): V.append([float(t) for t in l.split()[1:4]])
    elif l.startswith('vt '): VT.append([float(t) for t in l.split()[1:3]])
    elif l.startswith('g '): cur = l.split()[1]
    elif l.startswith('f '):
        f = [(int(t.split('/')[0]) - 1, int(t.split('/')[1]) - 1) for t in l.split()[1:]]
        grp.setdefault(cur, []).append(f)
V = np.array(V)
def tgt(name, w):
    if w <= 0: return
    for l in open(D + name + '.target'):
        if l[0] == '#' or not l.strip(): continue
        i, x, y, z = l.split(); V[int(i)] += w * np.array([float(x), float(y), float(z)])
# macro interpolation (MakeHuman: value 0.5 = average, 1 = max)
m = max(0, (muscle - 0.5) * 2); wgt = max(0, (weight - 0.5) * 2)
tgt('caucasian-male-young', 1)
tgt('universal-male-young-maxmuscle-averageweight', m * (1 - wgt))
tgt('universal-male-young-averagemuscle-maxweight', (1 - m) * wgt)
tgt('universal-male-young-maxmuscle-maxweight', m * wgt)
hw = max(0, (height - 0.5) * 2)
tgt('male-young-maxmuscle-averageweight-maxheight', hw * m); tgt('male-young-averagemuscle-averageweight-maxheight', hw * (1 - m))
tgt('male-young-maxmuscle-averageweight-idealproportions', 0.5 * m); tgt('male-young-averagemuscle-averageweight-idealproportions', 0.5 * (1 - m))
J = {k[6:]: V[sorted({i for f in fs for i, _ in f})].mean(0).tolist() for k, fs in grp.items() if k.startswith('joint-')}
# body: split verts per (v, vt) pair so UV seams stay exact; triangulate quads
key, pos, uv, tri = {}, [], [], []
for f in grp['body']:
    ids = []
    for vi, ti in f:
        k = (vi, ti)
        if k not in key: key[k] = len(pos); pos.append(V[vi].tolist()); uv.append(VT[ti])
        ids.append(key[k])
    for a in range(1, len(ids) - 1): tri += [ids[0], ids[a], ids[a + 1]]
src = [k[0] for k in sorted(key, key=key.get)]   # original vertex index per output vertex (to weld normals)
json.dump({'pos': np.round(pos, 5).tolist(), 'uv': np.round(uv, 5).tolist(), 'tri': tri, 'src': src, 'joints': J,
           'params': {'muscle': muscle, 'weight': weight, 'height': height}}, open(D + 'mh_morphed.json', 'w'))
P = np.array(pos); print('verts', len(pos), 'tris', len(tri) // 3, 'bbox', P.min(0).round(2), P.max(0).round(2))
