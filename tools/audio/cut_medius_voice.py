#!/usr/bin/env python3
"""Cuts the recorded Medius voice into one mp3 per line: assets/audio/tut-<hash>.mp3 (tutorial) and ob-<hash>.mp3 (the
Traveller's Registry questions). These are the ONLY Medius voice in the app: no browser speech, no text-to-speech.

The source is five long recordings in which Medius reads the registry and the tutorial one line after another. Each line
below names its recording (A..E, the first 8 characters of the uploaded file's name), where it starts and ends, and the
text it belongs to. Times were taken from a word-level transcript of the recordings; every cut is then moved to the
quietest moment of the pause between two lines so no word is clipped. Levels are matched across the five recordings.

The file name is a hash of the line's *template* (the text before {name} is filled in), the same as hashOf() in
js/v6-medius.js, so an edited line never plays a stale recording. Lines that name the user were recorded without the name.

  python3 tools/audio/cut_medius_voice.py PATH/TO/FOLDER_WITH_THE_FIVE_MP3S
Needs ffmpeg with libmp3lame, and numpy."""
import re, subprocess, sys, pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/audio'
SRC = {'A': '356cb336', 'B': '6f2e3435', 'C': '9536e274', 'D': 'bfce508f', 'E': 'e9ba6cdb'}
LUFS = -18.0

# Traveller's Registry (js/hw-05-v5-4-module.js OBQ + read-back + plan forged, js/v6-conditions.js, js/v6-account.js OFFER)
# (key, template, [(recording, first word starts, last word ends), ...])
OB = [
 ('name', "Hail, traveller! I am Medius, Wizard King of the HealthWiz Kingdom. Before thy journey begins, what name shall the Kingdom know thee by?", [('A', 0.00, 11.48)]),
 ('age', "Well met, {name}! How many winters hast thou seen? Tell me thine age in years.", [('A', 11.70, 17.50)]),
 ('sex', "Thank thee, {name}. The ancient energy formula needeth thy body's sex. It shapeth only the calorie calculation.", [('A', 18.46, 25.46)]),
 ('h', "How tall standest thou, {name}? Give thy height in centimetres.", [('A', 26.42, 30.32)]),
 ('w', "And thy weight in kilograms? Fear not: it stayeth in this browser alone.", [('A', 31.06, 35.82)]),
 ('act', "Last of all, {name}: how active are thy days?", [('A', 36.86, 39.46)]),
 ('cond', "One last question, {name}. Does anything affect what thou canst do? It only helpeth me choose gentler goals. Choose all that apply, or none.", [('B', 0.00, 12.04)]),
 ('read', "{name}, read back thy registry. Is all as it should be?", [('B', 13.32, 16.92)]),
 ('plan', "{name}, thy Personal Quest Plan is forged! Every hall of health now holdeth goals made for thee.", [('B', 17.58, 24.42)]),
 ('offer', "One more thing, {name}. Wouldst thou like a free account? It keepeth thy kingdom safe in the cloud, carrieth it to thine other devices, and lets thee speak with me in my study. It is thy choice: everything works on this device without one.", [('B', 25.24, 36.70), ('D', 0.00, 3.84)]),
]
# Tutorial (the TS table in js/hw-04-part.js), in order
TUT = [
 [('D', 4.34, 11.92)], [('D', 12.22, 16.50)], [('D', 16.88, 25.50)], [('D', 25.84, 33.58)],
 [('E', 0.00, 9.26)], [('E', 9.94, 16.38)], [('E', 16.64, 20.66)], [('E', 21.44, 26.64)], [('E', 27.32, 31.04)], [('E', 31.64, 36.28)],
 [('C', 0.00, 6.36)], [('C', 7.06, 11.52)]]

def tag(text):    # same hash as hashOf() in js/v6-medius.js
    x = 5381
    for ch in text:
        x = ((x << 5) + x + ord(ch)) & 0xFFFFFFFF
    n, s = x, ''
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

def tut_templates():
    src = (ROOT / 'js/hw-04-part.js').read_text()
    block = src[src.index('const TS=['):src.index('const TUT=')]
    return [m.group(1).replace('\\"', '"') for m in re.finditer(r'^\[\'[^\']*\',(?:\'[^\']*\'|0),"((?:[^"\\]|\\.)*)"\]', block, re.M)]

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

def loudness(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])

def main():
    folder = pathlib.Path(sys.argv[1])
    files = {k: next(folder.glob(v + '*.mp3')) for k, v in SRC.items()}
    sig = {k: decode(f) for k, f in files.items()}
    gain = {k: LUFS - loudness(f) for k, f in files.items()}
    env = {}
    for k, a in sig.items():                   # 10 ms RMS, smoothed over 30 ms: where the room is quietest
        n = len(a) // 160; r = np.sqrt((a[:n * 160].reshape(n, 160) ** 2).mean(1)); env[k] = np.convolve(r, np.ones(3) / 3, 'same')
    # every line, in recording order, so each cut can sit in the pause shared with its neighbour
    todo = []
    for key, tmpl, parts in OB: todo.append(('ob-' + tag(tmpl), tmpl, parts))
    for tmpl, parts in zip(tut_templates(), TUT): todo.append(('tut-' + tag(tmpl), tmpl, parts))
    if len(tut_templates()) != len(TUT): sys.exit('the tutorial has %d lines, this tool cuts %d' % (len(tut_templates()), len(TUT)))
    spans = sorted((k, s, e) for _, _, ps in todo for k, s, e in ps)
    def edge(k, t, side):                       # shared quiet point between this line and its neighbour in the same recording
        i = spans.index(next(x for x in spans if x[0] == k and abs(x[1 if side == 'prev' else 2] - t) < 1e-6))
        nb = spans[i - 1] if side == 'prev' else (spans[i + 1] if i + 1 < len(spans) else None)
        dur = len(sig[k]) / 16000
        if side == 'prev':
            if i == 0 or nb[0] != k: return 0.0
            lo, hi = nb[2], t
        else:
            if nb is None or nb[0] != k: return dur
            lo, hi = t, nb[1]
        a, b = int(lo * 100), max(int(hi * 100), int(lo * 100) + 1)
        return (a + int(np.argmin(env[k][a:b + 1]))) / 100
    floor = {k: float(np.percentile(e, 10)) * 2 for k, e in env.items()}      # about 6 dB over the room tone of each recording
    def onset(k, s, lo):                        # walk back from the word's transcribed start to where the sound really begins
        i = int(s * 100)
        while i > int(lo * 100) and env[k][i] > floor[k]: i -= 1
        return max(lo, i / 100 - 0.05)
    def offset(k, e, hi):                       # walk on from the word's transcribed end to where the sound really stops
        j = min(int(e * 100), len(env[k]) - 1)
        while j < min(int(hi * 100), len(env[k]) - 1) and env[k][j] > floor[k]: j += 1
        return min(hi, j / 100 + 0.12)
    OUT.mkdir(exist_ok=True)
    for old in list(OUT.glob('tut-*.mp3')) + list(OUT.glob('ob-*.mp3')): old.unlink()
    for name, tmpl, parts in todo:
        cuts = []
        for k, s, e in parts:
            lo, hi = edge(k, s, 'prev'), edge(k, e, 'next')
            cuts.append((k, onset(k, s, lo), offset(k, e, hi)))
        chain, ins = [], []
        for n, (k, a, b) in enumerate(cuts):
            ins += ['-i', str(files[k])]
            chain.append(f'[{n}:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,volume={gain[k]:.2f}dB,afade=t=in:d=0.012,afade=t=out:st={b - a - 0.04:.3f}:d=0.04[p{n}]')
        join = ''.join(f'[p{n}]' for n in range(len(cuts))) + f'concat=n={len(cuts)}:v=0:a=1,alimiter=limit=0.89[o]'
        dst = OUT / (name + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(chain + [join]), '-map', '[o]', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', str(dst)], check=True)
        print(dst.name, f'{dst.stat().st_size // 1024} KB', ' + '.join(f'{k}[{a:.2f}-{b:.2f}]' for k, a, b in cuts), '|', tmpl[:60])

main()
