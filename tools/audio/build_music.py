#!/usr/bin/env python3
"""
Turns the background music's source recording into a compressed, seamless loop for the game.

    python3 tools/audio/build_music.py  [source.wav]   (needs ffmpeg with libmp3lame, and numpy)

Source: "Java Jurami" by SieuAmThanh (Freesound 423647, CC0 1.0), kept as a WAV in src/assets/audio/music/ (not
in git, not in the build). Writes src/assets/audio/music/java-jurami.mp3 and .json:

- The loop leaves out the quieter first seconds, and ends where the rhythm best lines up with where it starts
  again; the last seconds are crossfaded (equal power) into the start, so the seam is not heard.
- Loudness is set to MUSIC_LUFS, well under the effects (see build_sfx.py): background, never the lead.
- MP3 adds a few silent samples at its start, which a plain loop would play as a click: the .json says how long
  the loop is, so the game loops exactly that stretch, from the first sound on (WebAudioSoundService).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
MUSIC = ROOT / 'src/assets/audio/music'
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else MUSIC / '423647__sieuamthanh__java-jurami.wav'
NAME = 'java-jurami'
RATE = 44100
# Where the loop starts (after the quieter opening), and how long the crossfade at the seam is.
HEAD = 2.0
CROSSFADE = 4.0
MUSIC_LUFS = -30.0


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def onset_envelope(mono: np.ndarray, hop: int = 512) -> np.ndarray:
    frames = mono.size // hop
    energy = np.array([np.sqrt(np.mean(mono[i * hop : (i + 1) * hop] ** 2)) for i in range(frames)])
    return np.maximum(0, np.diff(energy, prepend=energy[0]))


def best_loop_end(x: np.ndarray) -> int:
    """The end, in the last 20 s, whose crossfade window's rhythm best matches the loop's start."""
    hop = 512
    mono = x.mean(axis=1)
    env = onset_envelope(mono, hop)
    head = env[int(HEAD * RATE / hop) : int((HEAD + CROSSFADE) * RATE / hop)]
    head = (head - head.mean()) / (head.std() + 1e-9)
    best, best_score = None, -np.inf
    total = mono.size / RATE
    for end_s in np.arange(total - 20, total - 0.5, hop / RATE):
        a = int((end_s - CROSSFADE) * RATE / hop)
        tail = env[a : a + head.size]
        if tail.size < head.size:
            continue
        tail = (tail - tail.mean()) / (tail.std() + 1e-9)
        score = float(np.dot(head, tail)) / head.size
        if score > best_score:
            best, best_score = end_s, score
    print(f'loop end at {best:.2f} s (rhythm match {best_score:.2f})')
    return int(best * RATE)


def loudness(path: Path) -> float:
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    line = [l for l in out.splitlines() if l.strip().startswith('I:')][-1]
    return float(line.split()[1])


def main() -> None:
    x = decode(SOURCE)
    end = best_loop_end(x)
    head, fade = int(HEAD * RATE), int(CROSSFADE * RATE)
    # The loop: from the end of the opening crossfade to `end`, its last seconds blended into the loop's start.
    body = x[head + fade : end].copy()
    t = np.linspace(0, np.pi / 2, fade)[:, None]
    body[-fade:] = body[-fade:] * np.cos(t) + x[head : head + fade] * np.sin(t)
    seconds = body.shape[0] / RATE
    wav = MUSIC / f'{NAME}.loop.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-i', '-', str(wav)], input=body.astype(np.float32).tobytes(), check=True)
    gain = MUSIC_LUFS - loudness(wav)
    out = MUSIC / f'{NAME}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-af', f'volume={gain:.2f}dB', '-c:a', 'libmp3lame', '-b:a', '96k', str(out)], check=True)
    wav.unlink()
    (MUSIC / f'{NAME}.json').write_text(json.dumps({'loopSeconds': round(seconds, 6)}) + '\n')
    print(f'{out.relative_to(ROOT)}: {seconds:.2f} s loop, {out.stat().st_size / 1024:.0f} KB, {loudness(out):.1f} LUFS')


if __name__ == '__main__':
    main()
