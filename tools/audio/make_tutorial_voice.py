#!/usr/bin/env python3
"""Records Medius's tutorial lines (the TS table in js/hw-04-part.js) as assets/audio/tut-<hash>.mp3.

Offline text-to-speech with Piper (https://github.com/rhasspy/piper), voice en_GB-northern_english_male-medium
(OpenSLR 83, CC-BY-SA 4.0: credit "Google / OpenSLR 83 en_GB male voices"). The raw voice is then lowered about 14% in
pitch and formant (asetrate) and slowed to an unhurried pace, with a little warmth, so Medius sounds like a deep,
older storyteller. Not a clone of any real person.
The file name is a hash of the line's text, so js/v6-medius.js only plays a recording that still matches the line on
screen; an edited line has no file and the app falls back to the browser's voice until this tool is run again.
{name} lines are recorded with "traveller" (a recording cannot know the user's name).

  pip install piper-tts numpy       # in a scratch venv, not in the repo
  python3 tools/audio/make_tutorial_voice.py PATH/TO/en_GB-northern_english_male-medium.onnx [--piper PATH/TO/piper]
Needs ffmpeg with libmp3lame."""
import re, subprocess, sys, tempfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PITCH = 0.86      # asetrate factor: pitch and formants down ~14%
PACE = 0.93       # overall speed after the pitch change (1 = same speed as the raw voice)

def tag(text):    # same hash as hashOf() in js/v6-medius.js
    x = 5381
    for ch in text:
        x = ((x << 5) + x + ord(ch)) & 0xFFFFFFFF
    n, s = x, ''
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

def lines():
    src = (ROOT / 'js/hw-04-part.js').read_text()
    block = src[src.index('const TS=['):src.index('const TUT=')]
    return [m.group(1).replace('\\"', '"') for m in re.finditer(r'^\[\'[^\']*\',(?:\'[^\']*\'|0),"((?:[^"\\]|\\.)*)"\]', block, re.M)]

def main():
    model = sys.argv[1]
    piper = sys.argv[sys.argv.index('--piper') + 1] if '--piper' in sys.argv else 'piper'
    out = ROOT / 'assets/audio'; out.mkdir(exist_ok=True)
    for old in out.glob('tut-*.mp3'): old.unlink()
    for text in lines():
        spoken = text.replace('{name}', 'traveller')
        with tempfile.TemporaryDirectory() as d:
            raw = pathlib.Path(d) / 'raw.wav'
            subprocess.run([piper, '-m', model, '-f', str(raw), '--length-scale', '1.15', '--sentence-silence', '0.3'],
                           input=spoken.encode(), check=True, capture_output=True)
            dst = out / ('tut-' + tag(text) + '.mp3')
            af = f'asetrate=22050*{PITCH},aresample=22050,atempo={PACE / PITCH:.4f},equalizer=f=140:t=q:w=1:g=3,highshelf=f=5000:g=-3,loudnorm=I=-18:TP=-2'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af', af, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', str(dst)], check=True)
        print(dst.name, f'{dst.stat().st_size // 1024} KB', '|', spoken)

main()
