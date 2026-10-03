export type SoundEffect =
  | 'pick'
  | 'drop'
  | 'invalid'
  | 'clear'
  | 'advance'
  | 'tick'
  | 'win'
  | 'lose'
  | 'combo'
  | 'unlock'
  | 'blockerMove'
  | 'blockerGone'
  | 'beltPick';

/** Sound boundary. Scenes ask for effects by name and never touch audio APIs directly. */
export interface SoundService {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** Must be called from a user gesture: browsers keep audio locked until then. */
  unlock(): void;
  play(effect: SoundEffect): void;
}

export class NoopSoundService implements SoundService {
  muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  unlock(): void {}

  play(_effect: SoundEffect): void {}
}
