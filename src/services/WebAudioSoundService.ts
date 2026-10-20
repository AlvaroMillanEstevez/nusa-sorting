import type { SoundEffect, SoundService } from './SoundService';

interface Tone {
  /** Start offset in seconds. */
  at: number;
  duration: number;
  freq: number;
  /** Frequency to glide to by the end of the tone. */
  freqEnd?: number;
  wave: OscillatorType;
  gain: number;
}

const note = (at: number, freq: number, duration = 0.09, wave: OscillatorType = 'triangle', gain = 0.22): Tone => ({
  at,
  duration,
  freq,
  wave,
  gain,
});

/**
 * Synthesized effects. The triple and the combo are always these; the others are stand-ins, played until the
 * recorded effects (src/assets/audio, see tools/audio/build_sfx.py) are loaded and decoded, or if one cannot be.
 */
const EFFECTS: Record<SoundEffect, readonly Tone[]> = {
  pick: [{ at: 0, duration: 0.06, freq: 620, freqEnd: 880, wave: 'sine', gain: 0.18 }],
  drop: [{ at: 0, duration: 0.08, freq: 240, freqEnd: 150, wave: 'triangle', gain: 0.3 }],
  invalid: [note(0, 150, 0.07, 'square', 0.08), note(0.09, 120, 0.09, 'square', 0.08)],
  clear: [note(0, 660), note(0.06, 830), note(0.12, 990, 0.16), note(0.12, 1980, 0.12, 'sine', 0.06)],
  advance: [{ at: 0, duration: 0.14, freq: 280, freqEnd: 460, wave: 'sine', gain: 0.12 }],
  tick: [note(0, 1200, 0.03, 'square', 0.05)],
  // Once, when time starts running low: a watch-alarm "beep-beep, beep-beep", unlike any other effect.
  timeLow: [0, 0.15, 0.45, 0.6].flatMap((at) => [note(at, 1047, 0.1, 'triangle', 0.26), note(at, 1047, 0.1, 'square', 0.05)]),
  win: [note(0, 523), note(0.1, 659), note(0.2, 784), note(0.3, 1047, 0.35)],
  lose: [note(0, 392, 0.18, 'sawtooth', 0.1), note(0.18, 330, 0.18, 'sawtooth', 0.1), note(0.36, 262, 0.4, 'sawtooth', 0.1)],
  combo: [{ at: 0, duration: 0.18, freq: 700, freqEnd: 1400, wave: 'square', gain: 0.07 }, note(0.12, 1760, 0.12, 'sine', 0.1)],
  unlock: [note(0, 880, 0.06, 'square', 0.08), note(0.07, 1175, 0.06, 'square', 0.08), note(0.14, 1568, 0.2, 'triangle', 0.18)],
  blockerMove: [{ at: 0, duration: 0.12, freq: 180, freqEnd: 320, wave: 'square', gain: 0.06 }],
  beltPick: [{ at: 0, duration: 0.05, freq: 520, freqEnd: 1040, wave: 'square', gain: 0.07 }, note(0.04, 1320, 0.05, 'sine', 0.12)],
  blockerGone: [{ at: 0, duration: 0.3, freq: 300, freqEnd: 1200, wave: 'triangle', gain: 0.2 }, note(0.25, 1600, 0.2, 'sine', 0.1)],
  // A bright chime per star, each a step higher (a major arpeggio), with a soft octave sparkle.
  star1: [note(0, 784, 0.16, 'triangle', 0.24), note(0.02, 1568, 0.12, 'sine', 0.07)],
  star2: [note(0, 988, 0.16, 'triangle', 0.24), note(0.02, 1976, 0.12, 'sine', 0.07)],
  star3: [note(0, 1175, 0.24, 'triangle', 0.26), note(0.02, 2349, 0.18, 'sine', 0.08), note(0.12, 1568, 0.2, 'sine', 0.06)],
  // A soft wooden knock: quiet, so tapping around never gets tiring.
  tap: [{ at: 0, duration: 0.05, freq: 420, freqEnd: 300, wave: 'triangle', gain: 0.12 }],
  open: [{ at: 0, duration: 0.14, freq: 300, freqEnd: 640, wave: 'sine', gain: 0.1 }],
  close: [{ at: 0, duration: 0.12, freq: 560, freqEnd: 280, wave: 'sine', gain: 0.08 }],
  starCollect: [note(0, 1568, 0.08, 'sine', 0.12), note(0.05, 2093, 0.1, 'sine', 0.08)],
  mapStep: [{ at: 0, duration: 0.07, freq: 520, freqEnd: 600, wave: 'triangle', gain: 0.08 }],
  // Something heavy settling: a low thud and a dull buzz, before the defeat panel.
  blocked: [{ at: 0, duration: 0.25, freq: 140, freqEnd: 70, wave: 'triangle', gain: 0.3 }, note(0.08, 98, 0.3, 'square', 0.05)],
  shelfClosed: [{ at: 0, duration: 0.2, freq: 200, freqEnd: 110, wave: 'triangle', gain: 0.25 }],
  chest: [note(0, 1319, 0.08, 'sine', 0.12), note(0.06, 1568, 0.08, 'sine', 0.12), note(0.12, 2093, 0.14, 'sine', 0.1)],
  // Food going off: a short soft sag downwards with a little wobble, more "oh no" than alarm.
  spoil: [{ at: 0, duration: 0.24, freq: 440, freqEnd: 196, wave: 'triangle', gain: 0.16 }, { at: 0.12, duration: 0.16, freq: 230, freqEnd: 170, wave: 'sine', gain: 0.08 }],
};

/** The recorded effects, by file name (the effect's name, or 'star' for the three stars). */
const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/audio/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length),
    url,
  ]),
);
/**
 * Background music: the first track in src/assets/audio/music (built by tools/audio/build_music.py), and how long
 * its loop is (MP3 adds silent samples at its start, so the loop is played as an exact stretch, not the file).
 */
const MUSIC_URL: string | null =
  Object.values(import.meta.glob('../assets/audio/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)[0] ?? null;
const MUSIC_LOOP: number | null =
  Object.values(import.meta.glob('../assets/audio/music/*.json', { eager: true, import: 'loopSeconds' }) as Record<string, number>)[0] ?? null;
/** The track itself is mastered well under the effects; this is only the fade's top. */
const MUSIC_GAIN = 1;
/** Seconds to fade the music in (on the home screen and map) and out (going into a level). */
const MUSIC_FADE_IN = 2;
const MUSIC_FADE_OUT = 1.5;

/** Which recording an effect plays, and how much higher. The stars rise a major third, then a fifth. */
const RECORDING: Partial<Record<SoundEffect, { file: string; rate: number }>> = {
  star1: { file: 'star', rate: 1 },
  star2: { file: 'star', rate: 2 ** (4 / 12) },
  star3: { file: 'star', rate: 2 ** (7 / 12) },
};
/**
 * The triple and the combo are synthesized (Koke preferred them to recorded ones). A combo climbs a pentatonic
 * scale from its second step: each step a little higher, never a jump bigger than a minor third, up to an octave
 * and a third.
 */
const COMBO_SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const comboRate = (step: number) => 2 ** (COMBO_SCALE[Math.min(Math.max(step, 2) - 2, COMBO_SCALE.length - 1)]! / 12);
/** Synthesized effects lose the same highs as the recorded ones (see tools/audio/build_sfx.py), without the room. */
const SYNTH_HIGHCUT = 7000;

export class WebAudioSoundService implements SoundService {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  /** The recordings, fetched as soon as the game starts and decoded once audio is unlocked. */
  private readonly encoded = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private musicOn = true;
  /** The screen wants music (home screen and map), not a level. */
  private musicWanted = false;
  private musicGain: GainNode | null = null;
  private musicBuffer: Promise<AudioBuffer | null> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  /** Where the loop starts in the decoded track (after MP3's silent lead-in), and where it was when it stopped. */
  private musicLoopStart = 0;
  private musicPosition = 0;
  private musicStartedAt = 0;
  private musicStop: ReturnType<typeof setTimeout> | null = null;
  private synthFilter: BiquadFilterNode | null = null;

  readonly hasMusic = MUSIC_URL !== null;

  constructor() {
    const load = (url: string) =>
      fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null);
    for (const [name, url] of Object.entries(FILES)) this.encoded.set(name, load(url));
    // Music only stops while the page is hidden; it comes back with the next gesture (see unlock).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.context?.suspend().catch(() => undefined);
    });
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master && this.context) this.master.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.updateMusic();
  }

  /** The home screen and map want music; a level does not: it fades in or out. */
  wantMusic(wanted: boolean): void {
    this.musicWanted = wanted;
    this.updateMusic();
  }

  unlock(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this._muted ? 0 : 1;
        this.master.connect(this.context.destination);
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = 0;
        this.musicGain.connect(this.master);
        this.decodeAll(this.context);
      }
      // 'suspended' before the first gesture or after the page was hidden; 'interrupted' on iOS after a call or
      // switching apps. Either way it only resumes inside a user gesture.
      if (this.context.state !== 'running' && this.context.state !== 'closed') void this.context.resume();
      this.updateMusic();
    } catch {
      // No Web Audio support: the game stays silent.
      this.context = null;
    }
  }

  private decodeAll(context: AudioContext): void {
    for (const [name, encoded] of this.encoded) {
      void encoded.then(async (data) => {
        if (!data) return;
        try {
          this.buffers.set(name, await context.decodeAudioData(data));
        } catch {
          // Not decodable here: the synthesized stand-in keeps playing for it.
        }
      });
    }
  }

  /** Starts, resumes or fades out the music to match what is wanted now. */
  private updateMusic(): void {
    const { context, musicGain } = this;
    if (!context || !musicGain || !MUSIC_URL) return;
    const now = context.currentTime;
    if (this.musicWanted && this.musicOn) {
      if (this.musicStop) clearTimeout(this.musicStop);
      this.musicStop = null;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(MUSIC_GAIN, now + MUSIC_FADE_IN);
      if (!this.musicSource) void this.startMusic(context, musicGain);
      return;
    }
    if (!this.musicSource || this.musicStop) return;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_OUT);
    // Stopped once silent; it comes back from where it was.
    this.musicStop = setTimeout(() => {
      this.musicStop = null;
      const source = this.musicSource;
      if (!source) return;
      this.musicPosition = this.loopPosition(context);
      source.stop();
      this.musicSource = null;
    }, MUSIC_FADE_OUT * 1000 + 50);
  }

  private async startMusic(context: AudioContext, musicGain: GainNode): Promise<void> {
    this.musicBuffer ??= fetch(MUSIC_URL!)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        // The loop starts at the first sound, after the MP3's silent lead-in.
        const samples = buffer.getChannelData(0);
        let first = 0;
        while (first < samples.length && Math.abs(samples[first]!) < 1e-4) first++;
        this.musicLoopStart = first / buffer.sampleRate;
        return buffer;
      })
      .catch(() => null);
    const buffer = await this.musicBuffer;
    // Still wanted, and not started meanwhile?
    if (!buffer || this.musicSource || !this.musicWanted || !this.musicOn) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = this.musicLoopStart;
    source.loopEnd = Math.min(buffer.duration, this.musicLoopStart + (MUSIC_LOOP ?? buffer.duration));
    source.connect(musicGain);
    source.start(0, this.musicLoopStart + this.musicPosition);
    this.musicStartedAt = context.currentTime - this.musicPosition;
    this.musicSource = source;
  }

  /** Seconds into the loop the music is now. */
  private loopPosition(context: AudioContext): number {
    const length = MUSIC_LOOP ?? 0;
    const played = context.currentTime - this.musicStartedAt;
    return length > 0 ? played % length : 0;
  }

  play(effect: SoundEffect, step?: number): void {
    const { context, master } = this;
    if (!context || !master || this._muted || context.state !== 'running') return;
    const recording = RECORDING[effect] ?? { file: effect, rate: 1 };
    const buffer = this.buffers.get(recording.file);
    if (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = recording.rate;
      source.connect(master);
      source.start();
      return;
    }
    this.synthesize(context, this.synthOut(context, master), effect, effect === 'combo' ? comboRate(step ?? 2) : 1);
  }

  /** Where synthesized tones go: through the same high cut as the recordings, then to the master. */
  private synthOut(context: AudioContext, master: GainNode): AudioNode {
    if (!this.synthFilter) {
      this.synthFilter = context.createBiquadFilter();
      this.synthFilter.type = 'lowpass';
      this.synthFilter.frequency.value = SYNTH_HIGHCUT;
      this.synthFilter.Q.value = Math.SQRT1_2;
      this.synthFilter.connect(master);
    }
    return this.synthFilter;
  }

  /** Plays an effect's tones; `rate` raises them all (the combo's scale). */
  private synthesize(context: AudioContext, out: AudioNode, effect: SoundEffect, rate = 1): void {
    const now = context.currentTime;
    for (const tone of EFFECTS[effect]) {
      const start = now + tone.at;
      const end = start + tone.duration;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = tone.wave;
      osc.frequency.setValueAtTime(tone.freq * rate, start);
      if (tone.freqEnd) osc.frequency.exponentialRampToValueAtTime(tone.freqEnd * rate, end);
      // Short attack and exponential release so tones don't click.
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(out);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}
