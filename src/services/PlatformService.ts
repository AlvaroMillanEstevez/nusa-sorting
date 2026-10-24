/**
 * Portal boundary for what a game page tells its host besides ads: that loading is done, when the player is
 * actually playing (and when not: paused, a panel, between levels), and progress events for its analytics. The
 * game's own build has none (NoopPlatformService); Poki's is in PokiServices.ts.
 */
export interface PlatformService {
  /** The first screen is ready to play. Once. */
  loadingFinished(): void;
  /** Whether the player is playing right now; repeated calls with the same value are ignored. */
  setPlaying(playing: boolean): void;
  /** A level attempt: started, completed or failed (one of the last two per attempt). */
  levelEvent(level: number, action: 'start' | 'complete' | 'fail'): void;
}

export class NoopPlatformService implements PlatformService {
  loadingFinished(): void {}
  setPlaying(_playing: boolean): void {}
  levelEvent(_level: number, _action: 'start' | 'complete' | 'fail'): void {}
}
