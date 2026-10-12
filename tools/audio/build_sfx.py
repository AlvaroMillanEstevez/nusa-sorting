#!/usr/bin/env python3
"""
Builds the game's sound effects (src/assets/audio/*.mp3) from recorded CC0 sources: packs by Kenney
(www.kenney.nl), downloaded once into a cache, and single metallophone notes cut from "Gamelan — Generative Sound
by Glorb" by bassimat (Freesound 855565, CC0 1.0), kept as a WAV in src/assets/audio/source/ (not in git, not in
the build). Each sound's silences are cut, its loudness set by kind of sound so all of them sit together, and it
is encoded as a short mono MP3. Sources and licences: docs/audio-licenses.md.

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
from scipy.signal import butter, fftconvolve, sosfilt

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
    # The interface: soft and warm, no hiss. A low wooden tock for buttons; a deep swell that rises to open a
    # panel and its counterpart that sinks to close one (filtered and faded in, see INTERFACE).
    'tap': ('interface-sounds', 'Audio/drop_003.ogg', SOFT, 1.0),
    'open': ('interface-sounds', 'Audio/maximize_006.ogg', SOFT, 1.0),
    'close': ('interface-sounds', 'Audio/minimize_008.ogg', SOFT, 1.0),
    'pick': ('impact-sounds', 'Audio/impactWood_light_002.ogg', PLAY - 3, 1.3),
    'drop': ('impact-sounds', 'Audio/impactWood_light_001.ogg', PLAY, 1.0),
    'beltPick': ('impact-sounds', 'Audio/impactWood_light_003.ogg', PLAY - 3, 1.2),
    'advance': ('casino-audio', 'Audio/card-slide-2.ogg', PLAY - 2, 1.0),
    'invalid': ('interface-sounds', 'Audio/error_004.ogg', PLAY, 1.0),
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
    # Steel drums: a falling phrase to lose (winning is a gamelan phrase, see GAMELAN).
    'lose': ('music-jingles', 'Audio/Steel jingles/jingles_STEEL14.ogg', BIG - 1, 1.0),
    'chest': ('rpg-audio', 'Audio/handleCoins.ogg', EVENT, 1.0),
}


# Interface sounds: no highs (they made the old ones hiss) and a gentle start, so nothing clicks.
INTERFACE = {'tap', 'open', 'close'}
INTERFACE_FILTER = 'lowpass=f=5000,afade=t=in:d=0.003'

# Gamelan: single notes of the metallophone ("saron"-like, inharmonic partials with beating pairs), each starting
# after digital silence in the source, so they cut cleanly. Pitch is the strongest partial; played an octave
# higher (pitch 2) so they ring clearly on phone speakers.
GAMELAN = ROOT / 'src/assets/audio/source/855565__bassimat__gamelan-generative-sound-by-glorb.wav'
# The five notes of its scale, low to high: (start in the source, seconds).
SCALE = [(62.41, 1.72), (22.24, 2.38), (79.77, 2.11), (18.84, 2.38), (47.66, 0.64)]
# A low, gong-like note to round off the win.
GONG = (95.67, 2.62)


def pack(name: str) -> Path:
    folder = CACHE / name
    if not folder.exists():
        print(f'downloading {name}')
        data = urllib.request.urlopen(PACKS[name], timeout=120).read()
        zipfile.ZipFile(io.BytesIO(data)).extractall(folder)
    return folder


def note(start: float, length: float, pitch: float, keep: float, attack: float = 0.0, highcut: float | None = None) -> np.ndarray:
    """
    A note of the gamelan recording, `keep` seconds of it at the most, faded out over its last third; `attack`
    softens its start (a fade in, in seconds) and `highcut` takes its highs off above that frequency.
    """
    x = decode(GAMELAN, 1.0)[int((start - 0.005) * RATE) : int((start + length) * RATE)]
    x = resample(x, pitch)
    x = x[: int(keep * RATE)].copy()
    if highcut:
        x = sosfilt(butter(2, highcut, 'lowpass', fs=RATE, output='sos'), x).astype(np.float32)
    if attack > 0:
        n = min(x.size, int(attack * RATE))
        x[:n] *= np.linspace(0, 1, n)
    fade = x.size // 3
    x[-fade:] *= np.linspace(1, 0, fade) ** 2
    return x


def resample(x: np.ndarray, pitch: float) -> np.ndarray:
    if pitch == 1.0:
        return x
    positions = np.arange(0, x.size - 1, pitch)
    return np.interp(positions, np.arange(x.size), x).astype(np.float32)


_decoded: dict = {}


def gamelan_sounds() -> dict:
    """Triple, combo steps and win, from the gamelan's notes."""
    sounds = {}
    # The triple: the fourth note in its own (warm) octave, with a soft start and no harsh highs, under the
    # other events' level.
    sounds['clear'] = (note(*SCALE[3], 1.0, 1.1, attack=0.01, highcut=3000), EVENT - 4)
    # A combo climbs the scale gently: step n of a combo plays combo{n}, staying on the fifth beyond it.
    for i, (start, length) in enumerate(SCALE):
        sounds[f'combo{i + 1}'] = (note(start, length, 1.0, 0.9, attack=0.01, highcut=3000), EVENT - 5)
    # The win: the scale rising and the first note an octave up, ringing out over a soft low gong.
    steps = [note(start, length, 2.0, 0.8) for start, length in SCALE] + [note(*SCALE[0], 4.0, 1.4)]
    gap = int(0.11 * RATE)
    total = max(i * gap + step.size for i, step in enumerate(steps))
    win = np.zeros(total, dtype=np.float32)
    for i, step in enumerate(steps):
        win[i * gap : i * gap + step.size] += step * (0.8 if i < len(steps) - 1 else 1.0)
    gong = note(*GONG, 1.0, 1.6) * 0.35
    at = gap * (len(steps) - 1)
    end = min(total, at + gong.size)
    win[at:end] += gong[: end - at]
    sounds['win'] = (win, BIG)
    return sounds


def decode(path: Path, pitch: float) -> np.ndarray:
    key = (str(path), pitch)
    if key in _decoded:
        return _decoded[key]
    # A higher pitch: resampled as if recorded at a lower rate, then played back at RATE.
    filters = f'asetrate={int(RATE * pitch)},aresample={RATE}' if pitch != 1.0 else 'anull'
    if path.name in INTERFACE_FILES:
        filters += ',' + INTERFACE_FILTER
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-af', filters, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
        capture_output=True,
        check=True,
    ).stdout
    _decoded[key] = np.frombuffer(raw, dtype=np.float32).copy()
    return _decoded[key]


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


INTERFACE_FILES = {Path(SOUNDS[effect][1]).name for effect in INTERFACE}

# What every effect goes through, Kenney's and the gamelan's alike, so they sound like one family: the same
# gentle cut of the highest highs, and a very light small-room reverb (a short, dark tail mixed well under the dry
# sound) that puts them all in the same space.
POLISH_HIGHCUT = 7000
ROOM_SECONDS = 0.35
ROOM_DECAY = 0.07
ROOM_WET = 0.12


def room_impulse() -> np.ndarray:
    rng = np.random.default_rng(7)
    n = int(ROOM_SECONDS * RATE)
    t = np.arange(n) / RATE
    ir = rng.standard_normal(n) * np.exp(-t / ROOM_DECAY)
    # A dark room: its reflections lose their highs.
    ir = sosfilt(butter(2, 3500, 'lowpass', fs=RATE, output='sos'), ir)
    ir[: int(0.008 * RATE)] = 0  # pre-delay
    return (ir / np.sqrt(np.sum(ir**2))).astype(np.float32)


ROOM = room_impulse()
HIGHCUT = butter(2, POLISH_HIGHCUT, 'lowpass', fs=RATE, output='sos')


def polish(x: np.ndarray) -> np.ndarray:
    """The common processing: the high cut, then the room (the dry sound plus its tail)."""
    dry = sosfilt(HIGHCUT, x).astype(np.float32)
    wet = fftconvolve(dry, ROOM)[: dry.size + int(ROOM_SECONDS * RATE * 0.6)]
    out = np.zeros(wet.size, dtype=np.float32)
    out[: dry.size] += dry
    out += ROOM_WET * wet.astype(np.float32)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    sources = {effect: (trim(decode(pack(pack_name) / file, pitch)), target) for effect, (pack_name, file, target, pitch) in SOUNDS.items()}
    sources.update({effect: (trim(x), target) for effect, (x, target) in gamelan_sounds().items()})
    for effect, (x, target) in sources.items():
        x = polish(x)
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
