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

/** Placeholder effects synthesized on the fly: no audio files, so no licensing to worry about. */
const EFFECTS: Record<SoundEffect, readonly Tone[]> = {
  pick: [{ at: 0, duration: 0.06, freq: 620, freqEnd: 880, wave: 'sine', gain: 0.18 }],
  drop: [{ at: 0, duration: 0.08, freq: 240, freqEnd: 150, wave: 'triangle', gain: 0.3 }],
  invalid: [note(0, 150, 0.07, 'square', 0.08), note(0.09, 120, 0.09, 'square', 0.08)],
  clear: [note(0, 660), note(0.06, 830), note(0.12, 990, 0.16), note(0.12, 1980, 0.12, 'sine', 0.06)],
  advance: [{ at: 0, duration: 0.14, freq: 280, freqEnd: 460, wave: 'sine', gain: 0.12 }],
  tick: [note(0, 1200, 0.03, 'square', 0.05)],
  // Soft two-note chime, once, when time starts running low.
  timeLow: [note(0, 660, 0.14, 'sine', 0.12), note(0.16, 880, 0.2, 'sine', 0.1)],
  win: [note(0, 523), note(0.1, 659), note(0.2, 784), note(0.3, 1047, 0.35)],
  lose: [note(0, 392, 0.18, 'sawtooth', 0.1), note(0.18, 330, 0.18, 'sawtooth', 0.1), note(0.36, 262, 0.4, 'sawtooth', 0.1)],
  combo: [{ at: 0, duration: 0.18, freq: 700, freqEnd: 1400, wave: 'square', gain: 0.07 }, note(0.12, 1760, 0.12, 'sine', 0.1)],
  unlock: [note(0, 880, 0.06, 'square', 0.08), note(0.07, 1175, 0.06, 'square', 0.08), note(0.14, 1568, 0.2, 'triangle', 0.18)],
  blockerMove: [{ at: 0, duration: 0.12, freq: 180, freqEnd: 320, wave: 'square', gain: 0.06 }],
  beltPick: [{ at: 0, duration: 0.05, freq: 520, freqEnd: 1040, wave: 'square', gain: 0.07 }, note(0.04, 1320, 0.05, 'sine', 0.12)],
  blockerGone: [{ at: 0, duration: 0.3, freq: 300, freqEnd: 1200, wave: 'triangle', gain: 0.2 }, note(0.25, 1600, 0.2, 'sine', 0.1)],
};

export class WebAudioSoundService implements SoundService {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master && this.context) this.master.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
  }

  unlock(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this._muted ? 0 : 1;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      // No Web Audio support: the game stays silent.
      this.context = null;
    }
  }

  play(effect: SoundEffect): void {
    const { context, master } = this;
    if (!context || !master || this._muted || context.state !== 'running') return;
    const now = context.currentTime;
    for (const tone of EFFECTS[effect]) {
      const start = now + tone.at;
      const end = start + tone.duration;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = tone.wave;
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.freqEnd) osc.frequency.exponentialRampToValueAtTime(tone.freqEnd, end);
      // Short attack and exponential release so tones don't click.
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}
