#!/usr/bin/env python3
"""Generează vocile NPC-urilor (assets/voice/npc/replici.json) cu ElevenLabs.

Fiecare personaj primește altă voce. Distribuția se salvează în tools/npc_voices.json.
Poți înlocui orice voice_id de acolo cu o voce din Voice Library (de ex. voci native românești).

  python3 tools/genereaza_voci_npc.py              -> doar verificare, fără credite
  python3 tools/genereaza_voci_npc.py --casting    -> alege vocile (citește lista din cont), fără credite
  python3 tools/genereaza_voci_npc.py --generate   -> generează MP3-urile (consumă ~7.000 de caractere)

Cere ELEVENLABS_API_KEY în mediul local (export în Terminal). Cheia nu se salvează nicăieri.
"""
import argparse, json, os, sys, ssl
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'assets' / 'voice' / 'npc'
CAST = ROOT / 'tools' / 'npc_voices.json'

# gender / age per character (same as js/voices.js)
ROLES = {
    'geta': ('female', 'old'), 'farmacista': ('female', 'middle'), 'nelu': ('male', 'middle'),
    'gigi': ('male', 'young'), 'costel': ('male', 'old'), 'taxi': ('male', 'middle'),
    'vecin': ('male', 'middle'), 'florinel': ('male', 'young'), 'mitica': ('male', 'old'),
    'madalina': ('female', 'young'), 'politist': ('male', 'middle'), 'ped_m': ('male', 'young'),
    'ped_f': ('female', 'middle'),
}
# ElevenLabs default voices, used if the account's voice list can't be read
FALLBACK = [
    ('9BWtsMINqrJLrRacOk9x', 'Aria', 'female', 'middle'), ('EXAVITQu4vr4xnSDxMaL', 'Sarah', 'female', 'young'),
    ('FGY2WhTYpPnrIDTdsKH5', 'Laura', 'female', 'young'), ('XrExE9yKIg1WjnnlVkGX', 'Matilda', 'female', 'middle'),
    ('pFZP5JQG7iQjIQuC4Bku', 'Lily', 'female', 'middle'), ('cgSgspJ2msm6clMCkdW9', 'Jessica', 'female', 'young'),
    ('Xb7hH8MSUJpSbSDYk0k2', 'Alice', 'female', 'middle'), ('CwhRBWXzGAHq8TQ4Fs17', 'Roger', 'male', 'middle'),
    ('JBFqnCBsd6RMkjVDRZzb', 'George', 'male', 'middle'), ('N2lVS1w4EtoT3dr4eOWO', 'Callum', 'male', 'middle'),
    ('TX3LPaxmHKxFdv7VOQHJ', 'Liam', 'male', 'young'), ('bIHbv24MWmeRgasZH58o', 'Will', 'male', 'young'),
    ('cjVigY5qzO86Huf0OWal', 'Eric', 'male', 'middle'), ('iP95p4xoKVk53GoZ742B', 'Chris', 'male', 'middle'),
    ('nPczCjzI2devNBz1zQrb', 'Brian', 'male', 'middle'), ('onwK4e9ZLuTAKqWW03F9', 'Daniel', 'male', 'middle'),
    ('pqHfZKP75CvOlQylNhV4', 'Bill', 'male', 'old'), ('IKne3meq5aSn9XLyUdCD', 'Charlie', 'male', 'young'),
]
AGE_ORDER = ['young', 'middle', 'old']


def api(path, key, body=None):
    req = Request('https://api.elevenlabs.io' + path, data=body, method='POST' if body else 'GET',
                  headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' if body else 'application/json'})
    try:
        with urlopen(req, timeout=120, context=SSL_CTX) as r:
            return r.read(), r.headers.get('Content-Type', '')
    except HTTPError as e:
        try: detail = e.read().decode('utf-8', 'replace')[:600]
        except Exception: detail = ''
        raise ValueError(f'ElevenLabs HTTP {e.code}: {detail}') from None
    except (URLError, TimeoutError) as e:
        why = str(getattr(e, 'reason', e))
        hint = '\nRulează: pip3 install certifi   apoi reia.' if 'CERTIFICATE_VERIFY_FAILED' in why else ''
        raise ValueError('Conexiunea a eșuat: ' + why + hint) from None


def account_voices(key):
    try:
        data, _ = api('/v1/voices', key)
    except ValueError as e:
        print('Nu pot citi lista de voci din cont (' + str(e)[:80] + '). Folosesc vocile standard.')
        return [dict(id=i, name=n, gender=g, age=a) for i, n, g, a in FALLBACK]
    out = []
    for v in json.loads(data).get('voices', []):
        if v.get('category') == 'cloned':
            continue  # Câmpi's voice (and any other clones) stay out of the NPC cast
        lb = v.get('labels') or {}
        g = (lb.get('gender') or '').lower(); a = (lb.get('age') or 'middle').lower().replace('middle aged', 'middle').replace('middle-aged', 'middle')
        if g in ('male', 'female'):
            out.append(dict(id=v['voice_id'], name=v.get('name', ''), gender=g, age=a if a in AGE_ORDER else 'middle'))
    return out or [dict(id=i, name=n, gender=g, age=a) for i, n, g, a in FALLBACK]


def make_casting(key):
    cast = json.loads(CAST.read_text(encoding='utf-8')) if CAST.exists() else {}
    pool = account_voices(key); used = {c['voice_id'] for c in cast.values() if c.get('voice_id')}
    for sp, (g, age) in ROLES.items():
        if cast.get(sp, {}).get('voice_id'):
            continue
        cands = [v for v in pool if v['gender'] == g]
        cands.sort(key=lambda v: (v['id'] in used, abs(AGE_ORDER.index(v['age']) - AGE_ORDER.index(age))))
        if not cands:
            raise ValueError('Nicio voce ' + g + ' disponibilă.')
        v = cands[0]; used.add(v['id'])
        cast[sp] = {'voice_id': v['id'], 'nume_voce': v['name'], 'gen': g, 'varsta': age}
    CAST.write_text(json.dumps(cast, indent=1, ensure_ascii=False), encoding='utf-8')
    print('Distribuție (tools/npc_voices.json):')
    for sp, c in cast.items():
        print(f'  {sp:11s} -> {c.get("nume_voce", "?")} ({c["voice_id"]})')
    return cast


def write_manifest(lines):
    man = {l['id']: l['id'] + '.mp3' for l in lines if (DIR / (l['id'] + '.mp3')).exists()}
    (DIR / 'manifest.json').write_text(json.dumps(man, indent=1), encoding='utf-8')
    print(f'manifest.json: {len(man)} din {len(lines)} replici au audio.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--casting', action='store_true', help='alege vocile, fără să genereze')
    ap.add_argument('--generate', action='store_true', help='generează audio (consumă credite)')
    ap.add_argument('--model', default='eleven_multilingual_v2')
    ap.add_argument('--doar', help='doar un personaj, de ex. --doar geta')
    a = ap.parse_args()
    lines = json.loads((DIR / 'replici.json').read_text(encoding='utf-8'))
    todo = [l for l in lines if (not a.doar or l['speaker'] == a.doar) and not (DIR / (l['id'] + '.mp3')).exists()]
    print(f'{len(lines)} replici NPC; de generat: {len(todo)} ({sum(len(l["text"]) for l in todo)} caractere).')
    if not (a.casting or a.generate):
        write_manifest(lines); print('Doar verificare. Pași: --casting, apoi --generate'); return
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if not key:
        raise ValueError('Setează local ELEVENLABS_API_KEY (în Terminal, cu export).')
    cast = make_casting(key)
    if not a.generate:
        return
    for n, l in enumerate(todo, 1):
        v = cast[l['speaker']]
        old = v.get('varsta') == 'old'
        body = json.dumps({'text': l['text'], 'model_id': a.model,
                           'voice_settings': {'stability': 0.5 if old else 0.38, 'similarity_boost': 0.75,
                                              'style': 0.35 if old else 0.5, 'use_speaker_boost': True}}).encode('utf-8')
        data, ctype = api('/v1/text-to-speech/' + quote(v['voice_id'], safe='') + '?output_format=mp3_44100_96', key, body)
        if 'audio/' not in ctype or len(data) < 100:
            raise ValueError('Răspunsul nu conține audio valid.')
        (DIR / (l['id'] + '.mp3')).write_bytes(data)
        print(f'[{n}/{len(todo)}] {l["speaker"]}: {l["text"][:50]}')
    write_manifest(lines)


if __name__ == '__main__':
    try: main()
    except (ValueError, OSError) as e: print(e, file=sys.stderr); sys.exit(1)
