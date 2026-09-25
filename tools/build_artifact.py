#!/usr/bin/env python3
"""Build the Claude-artifact test copy of the game (the artifact host serves no .glb/.bin and wants body-only HTML).
usage: build_artifact.py <out_dir> <version>   -> prints the list of files that changed (for the publish call)"""
import os, re, sys, shutil, hashlib, json
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, V = sys.argv[1], sys.argv[2]
changed = []
def put(rel, data):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    if isinstance(data, str): data = data.encode('utf-8')
    if os.path.exists(p) and open(p, 'rb').read() == data: return
    open(p, 'wb').write(data); changed.append(rel)
def rd(rel, b=False): return open(os.path.join(SRC, rel), 'rb' if b else 'r', encoding=None if b else 'utf-8').read()
# js
for f in sorted(os.listdir(os.path.join(SRC, 'js'))):
    if not f.endswith('.js'): continue
    s = rd('js/' + f)
    if f == 'characters.js':
        s = s.replace("fetch('assets/face.bin')", "fetch('assets/face-bin.wasm')").replace("loadAsync('assets/Xbot.glb')", "loadAsync('assets/Xbot.gltf.json')")
    if f == 'game.js':
        s = s.replace("'Eroare la încărcare: ' + e.message;", "'Eroare la încărcare: ' + e.message + ' ' + ((e.stack || '').split('\\n')[1] || '');")
    put('js/' + f, s)
for f in os.listdir(os.path.join(OUT, 'js')):
    if f.startswith('map-part-') and not os.path.exists(os.path.join(SRC, 'js', f)): os.remove(os.path.join(OUT, 'js', f)); changed.append('js/' + f + ' (removed)')
put('lib/three.module.min.js', rd('lib/three.module.min.js', True))
for f in os.listdir(os.path.join(SRC, 'lib')):
    if f.endswith('.js'): put('lib/' + f, rd('lib/' + f, True))
for f in ['face.json', 'face_tex.jpg', 'face-start.png', 'icon.png', 'splash-landscape.jpg', 'splash-portrait.jpg']:
    put('assets/' + f, rd('assets/' + f, True))
put('assets/face-bin.wasm', rd('assets/face.bin', True))
for root, _, files in os.walk(os.path.join(SRC, 'assets/voice')):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), SRC); put(rel, rd(rel, True))
# index.html: body-only page with the stylesheet inlined, the error reporter and a test badge
html = rd('index.html'); css = rd('style.css')
head, body = html.split('<body>', 1); body = body.split('</body>')[0]
imp = re.search(r'<script type="importmap">.*?</script>', head, re.S).group(0).replace('?v=', '?v=a').replace('?v=a' , '?v=a', 1)
imp = re.sub(r'\?v=a[^"]*', '?v=a' + V, imp)
body = re.sub(r'js/game\.js\?v=[^"]*', 'js/game.js?v=a' + V, body)
badge = '#testbadge { position:fixed; left:50%; transform:translateX(-50%); top:calc(env(safe-area-inset-top) + 4px); z-index:30; font:700 11px/1 system-ui, sans-serif; letter-spacing:.08em; color:#1b1420; background:#ffd23f; padding:4px 8px; border-radius:6px; pointer-events:none; opacity:.85; }'
err = """<script>
// test build: show any load error on screen (there is no console on a phone)
(function(){ function show(m){ var el=document.getElementById('loading'); if(el){ el.textContent='Eroare: '+m; el.style.whiteSpace='pre-wrap'; el.style.fontSize='12px'; } }
  addEventListener('error', function(e){ show((e.message||'resursă')+' @ '+((e.filename||(e.target&&(e.target.src||e.target.href))||'')+'').split('/').slice(-2).join('/')+(e.lineno?':'+e.lineno:'')); }, true);
  addEventListener('unhandledrejection', function(e){ var r=e.reason; show((r&&(r.stack||r.message))||String(r)); }); })();
</script>"""
page = f'<title>Câmpi în Dristor</title>\n<style>\n{css}\n{badge}\n</style>\n{err}\n{imp}\n<div id="testbadge">BUILD DE TEST · {V}</div>\n{body}'
put('index.html', page)
print(json.dumps(changed))
