#!/usr/bin/env python3
"""
Builds the game's sound effects (src/assets/audio/*.mp3) from recorded CC0 packs by Kenney (www.kenney.nl):
downloads the packs once into a cache, cuts each sound's silences, sets its loudness by kind of sound so all of
them sit together, and encodes a short mono MP3. Sources and licences: docs/audio-licenses.md.

    python3 tools/audio/build_sfx.py            (needs ffmpeg with libmp3lame, and numpy)

Change a sound by editing SOUNDS below and running it again; review the result by ear.
"""
import io
import json
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src/assets/audio'
CACHE = Path.home() / '.cache/nusa-audio'
RATE = 44100

# CC0 packs (licence checked on each page: "Creative Commons CC0"; also in each zip's License.txt).
PACKS = {
    'interface-sounds': 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
    'impact-sounds': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    'casino-audio': 'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip',
    'rpg-audio': 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
    'music-jingles': 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip',
}

# Loudness targets (RMS of the audible part, dBFS) by kind of sound, so levels are consistent: the interface
# quietest, play in the middle, events above it, and the big moments loudest.
SOFT, PLAY, EVENT, BIG = -27.0, -23.0, -20.0, -18.0

# effect: (pack, file in the pack, target, pitch) — pitch > 1 plays the recording higher (and shorter).
SOUNDS = {
    'tap': ('interface-sounds', 'Audio/click_002.ogg', SOFT, 1.0),
    'open': ('interface-sounds', 'Audio/open_002.ogg', SOFT, 1.0),
    'close': ('interface-sounds', 'Audio/close_002.ogg', SOFT, 1.0),
    'pick': ('impact-sounds', 'Audio/impactWood_light_002.ogg', PLAY - 3, 1.3),
    'drop': ('impact-sounds', 'Audio/impactWood_light_001.ogg', PLAY, 1.0),
    'beltPick': ('impact-sounds', 'Audio/impactWood_light_003.ogg', PLAY - 3, 1.2),
    'advance': ('casino-audio', 'Audio/card-slide-2.ogg', PLAY - 2, 1.0),
    'invalid': ('interface-sounds', 'Audio/error_004.ogg', PLAY, 1.0),
    'clear': ('interface-sounds', 'Audio/confirmation_002.ogg', EVENT, 1.0),
    # Played higher with every step of a combo (see WebAudioSoundService).
    'combo': ('interface-sounds', 'Audio/glass_001.ogg', EVENT, 1.0),
    # The three stars of a win: one chime, played higher for each star.
    'star': ('interface-sounds', 'Audio/glass_002.ogg', EVENT, 1.0),
    'starCollect': ('interface-sounds', 'Audio/glass_004.ogg', SOFT + 2, 1.0),
    'mapStep': ('impact-sounds', 'Audio/footstep_wood_001.ogg', SOFT - 2, 1.0),
    'tick': ('interface-sounds', 'Audio/tick_002.ogg', PLAY, 1.0),
    'timeLow': ('interface-sounds', 'Audio/bong_001.ogg', EVENT, 1.0),
    'unlock': ('rpg-audio', 'Audio/metalLatch.ogg', EVENT, 1.0),
    'shelfClosed': ('impact-sounds', 'Audio/impactPlank_medium_000.ogg', EVENT, 1.0),
    'blockerMove': ('impact-sounds', 'Audio/impactWood_medium_002.ogg', PLAY - 1, 1.0),
    'blockerGone': ('impact-sounds', 'Audio/impactPlank_medium_003.ogg', EVENT, 1.1),
    'blocked': ('impact-sounds', 'Audio/impactWood_heavy_000.ogg', BIG, 0.9),
    # Steel drums: a rising phrase to win, a falling one to lose.
    'win': ('music-jingles', 'Audio/Steel jingles/jingles_STEEL02.ogg', BIG, 1.0),
    'lose': ('music-jingles', 'Audio/Steel jingles/jingles_STEEL14.ogg', BIG - 1, 1.0),
    'chest': ('rpg-audio', 'Audio/handleCoins.ogg', EVENT, 1.0),
}


def pack(name: str) -> Path:
    folder = CACHE / name
    if not folder.exists():
        print(f'downloading {name}')
        data = urllib.request.urlopen(PACKS[name], timeout=120).read()
        zipfile.ZipFile(io.BytesIO(data)).extractall(folder)
    return folder


def decode(path: Path, pitch: float) -> np.ndarray:
    # A higher pitch: resampled as if recorded at a lower rate, then played back at RATE.
    filters = f'asetrate={int(RATE * pitch)},aresample={RATE}' if pitch != 1.0 else 'anull'
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-af', filters, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim(x: np.ndarray, floor_db: float = -50.0) -> np.ndarray:
    level = 10 ** (floor_db / 20)
    loud = np.flatnonzero(np.abs(x) > level)
    if loud.size == 0:
        return x
    start = max(0, loud[0] - int(0.002 * RATE))
    end = min(x.size, loud[-1] + int(0.03 * RATE))
    return x[start:end]


def active_rms_db(x: np.ndarray) -> float:
    frame = int(0.01 * RATE)
    frames = [x[i : i + frame] for i in range(0, max(1, x.size - frame), frame)]
    rms = np.array([np.sqrt(np.mean(f**2)) for f in frames if f.size])
    loud = rms[rms > rms.max() * 0.1]
    return float(20 * np.log10(np.sqrt(np.mean(loud**2)) + 1e-12))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for effect, (pack_name, file, target, pitch) in SOUNDS.items():
        x = trim(decode(pack(pack_name) / file, pitch))
        gain = 10 ** ((target - active_rms_db(x)) / 20)
        # Never past -1 dBFS: quieter than the target rather than clipped.
        peak = np.abs(x).max() * gain
        if peak > 10 ** (-1 / 20):
            gain *= 10 ** (-1 / 20) / peak
        y = x * gain
        # A short fade at the end so nothing clicks.
        fade = min(y.size, int(0.01 * RATE))
        y[-fade:] *= np.linspace(1, 0, fade)
        out = OUT / f'{effect}.mp3'
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', str(out)],
            input=y.astype(np.float32).tobytes(),
            check=True,
        )
        report[effect] = {'seconds': round(y.size / RATE, 2), 'rms_db': round(active_rms_db(y), 1), 'peak_db': round(float(20 * np.log10(np.abs(y).max())), 1), 'kb': round(out.stat().st_size / 1024, 1)}
    print(json.dumps(report, indent=1))
    print(f'total {sum(r["kb"] for r in report.values()):.0f} KB in {len(report)} files', file=sys.stderr)


if __name__ == '__main__':
    main()
