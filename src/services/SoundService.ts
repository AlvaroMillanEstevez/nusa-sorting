export type SoundEffect =
  | 'pick'
  | 'drop'
  | 'invalid'
  | 'clear'
  | 'advance'
  | 'tick'
  | 'timeLow'
  | 'win'
  | 'lose'
  | 'combo'
  | 'unlock'
  | 'blockerMove'
  | 'blockerGone'
  | 'beltPick'
  /** Each star filling in on the victory panel, rising: the first, second and third. */
  | 'star1'
  | 'star2'
  | 'star3'
  /** Interface: a button pressed, a panel opening and closing. */
  | 'tap'
  | 'open'
  | 'close'
  /** A star landing on the map's total; the player's marker stepping along the path. */
  | 'starCollect'
  | 'mapStep'
  /** The board fills up: no free slot left. */
  | 'blocked'
  /** A shelf that closes once emptied is boarded up. */
  | 'shelfClosed'
  /** A star chest opens. */
  | 'chest'
  /** A fresh food spoils (basi): its countdown ran out. */
  | 'spoil'
  /** A fresh food enters its last moves: a soft heads-up, unlike the spoiling. */
  | 'freshWarn';

/** Sound boundary. Scenes ask for effects by name and never touch audio APIs directly. */
export interface SoundService {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** Must be called from a user gesture: browsers keep audio locked until then. */
  unlock(): void;
  /** `step` raises some effects' pitch: the combo's count (it rises with every step of a combo). */
  play(effect: SoundEffect, step?: number): void;
  /** Whether the game has background music (the setting is only offered then). */
  readonly hasMusic: boolean;
  /** Background music on or off (it still only plays while sound is not muted). */
  setMusic(on: boolean): void;
  /** Whether the screen wants music: the home screen and map do, levels do not (it fades in and out). */
  wantMusic(wanted: boolean): void;
}

export class NoopSoundService implements SoundService {
  muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  unlock(): void {}

  play(_effect: SoundEffect, _step?: number): void {}

  readonly hasMusic = false;

  setMusic(_on: boolean): void {}

  wantMusic(_wanted: boolean): void {}
}
