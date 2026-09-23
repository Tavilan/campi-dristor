# Câmpi în Dristor

Joc 3D open-world în browser (telefon + PC), în Dristorul real: harta vine din OpenStreetMap, iar Câmpi e reconstruit 3D din poze.

## Cum îl publici pe GitHub Pages

```bash
cd ~/Projects/campi-dristor
git init && git add . && git commit -m "Câmpi în Dristor"
git branch -M main
git remote add origin https://github.com/USERUL-TAU/campi-dristor.git
git push -u origin main
```

Apoi, în repo: **Settings → Pages → Deploy from a branch → main / (root) → Save**.

## Vocea lui Câmpi (ElevenLabs, cu acordul lui)

1. În ElevenLabs: **Voices → Instant Voice Cloning**, cu înregistrarea lui (ideal 1–2 minute de vorbit clar).
2. Copiază **Voice ID**-ul vocii create.
3. În Terminal, pe Mac:

```bash
cd ~/Projects/campi-dristor
export ELEVENLABS_API_KEY="cheia-ta"      # rămâne doar în Terminal, nu o pune în fișiere
export ELEVENLABS_VOICE_ID="id-ul-vocii"
python3 tools/genereaza_voce_campi.py --generate
```

MP3-urile apar în `assets/voice/campi/`, iar jocul le folosește automat, cu mișcarea buzelor după sunet. Replicile sunt în `assets/voice/campi/replici.json`. Dacă schimbi dialogurile din `js/content.js`, rulează întâi `node tools/extract_lines.mjs`.

## Harta

`tools/osm2map.py dristor.json assets/map.json 1100` convertește exportul Overpass într-un disc cu raza de 1,1 km în jurul stației Dristor 1.

## Surse și licențe

- **Hartă:** © OpenStreetMap contributors, ODbL.
- **Față:** reconstruită cu 3DDFA-V2 și Basel Face Model 2009, din 5 fotografii, plus planșa de referință generată cu AI pentru zonele pe care pozele nu le arată. BFM se poate folosi doar necomercial.
- **Schelet și animații** (stat, mers, alergat): X Bot, din exemplele three.js (Mixamo).
- **Motor grafic:** three.js r169.
