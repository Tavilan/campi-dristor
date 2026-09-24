#!/usr/bin/env python3
"""Generează replicile lui Câmpi (assets/voice/campi/replici.json) cu o voce ElevenLabs deja creată și autorizată.

Fără --generate: doar validare locală, fără rețea și fără credite consumate.
Cu --generate: cere ELEVENLABS_API_KEY și ELEVENLABS_VOICE_ID în mediul local (nu în cod, nu pe GitHub).
Adaptat după tools/genereaza_replici.py din pachetul primit. Scrie MP3-urile lângă replici și actualizează manifest.json.
"""
import argparse, json, os, re, sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
import ssl
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

DIR = Path(__file__).resolve().parents[1] / 'assets' / 'voice' / 'campi'


def write_manifest():
    lines = json.loads((DIR / 'replici.json').read_text(encoding='utf-8'))
    man = {l['id']: l['id'] + '.mp3' for l in lines if (DIR / (l['id'] + '.mp3')).exists()}
    (DIR / 'manifest.json').write_text(json.dumps(man, indent=1), encoding='utf-8')
    print(f'manifest.json: {len(man)} din {len(lines)} replici au audio.')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--generate', action='store_true', help='apel real ElevenLabs (consumă credite)')
    ap.add_argument('--model', default='eleven_multilingual_v2')
    a = ap.parse_args()
    lines = json.loads((DIR / 'replici.json').read_text(encoding='utf-8'))
    for l in lines:
        if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', l.get('id', '')) or not l.get('text', '').strip():
            raise ValueError('Replică invalidă: ' + repr(l))
    print(f'{len(lines)} replici valide, {sum(len(l["text"]) for l in lines)} caractere.')
    if not a.generate:
        write_manifest(); print('Doar verificare. Pentru generare: --generate'); return
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip(); voice = os.environ.get('ELEVENLABS_VOICE_ID', '').strip()
    if not key or not voice:
        raise ValueError('Setează local ELEVENLABS_API_KEY și ELEVENLABS_VOICE_ID (în Terminal, cu export).')
    url = 'https://api.elevenlabs.io/v1/text-to-speech/' + quote(voice, safe='') + '?output_format=mp3_44100_128'
    for l in lines:
        dest = DIR / (l['id'] + '.mp3')
        if dest.exists():
            print('există, păstrat:', dest.name); continue
        body = json.dumps({'text': l['text'], 'model_id': a.model,
                           'voice_settings': {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.35}}).encode('utf-8')
        req = Request(url, data=body, method='POST', headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            with urlopen(req, timeout=120, context=SSL_CTX) as r:
                data = r.read()
                if 'audio/' not in r.headers.get('Content-Type', '') or len(data) < 100:
                    raise ValueError('Răspunsul nu conține audio valid.')
        except HTTPError as e:
            try: detail = e.read().decode('utf-8', 'replace')[:600]
            except Exception: detail = ''
            raise ValueError(f'ElevenLabs HTTP {e.code}: {detail}\nVerifică vocea, cheia, planul și creditele. Nu reîncerc automat.') from None
        except (URLError, TimeoutError) as e:
            why = str(getattr(e, 'reason', e))
            hint = ''
            if 'CERTIFICATE_VERIFY_FAILED' in why:
                hint = '\nPython de pe Mac nu are certificatele SSL instalate. Rulează: pip3 install certifi   apoi reia comanda.'
            raise ValueError('Conexiunea a eșuat: ' + why + hint) from None
        with dest.open('xb') as f: f.write(data)
        print('creat:', dest.name)
    write_manifest()


if __name__ == '__main__':
    try: main()
    except (ValueError, OSError) as e: print(e, file=sys.stderr); sys.exit(1)
