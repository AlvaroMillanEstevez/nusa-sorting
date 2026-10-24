import type { AdService } from './AdService';
import type { PlatformService } from './PlatformService';

/**
 * Poki's SDK (developers.poki.com/guide/sdk-html5), loaded by the Poki build's index.html from Poki's own CDN.
 * With an ad blocker the script never arrives: the game plays on without it (no events, no ads, no rewards).
 */
interface PokiSdk {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  measure?(category: string, what: string, action: string): void;
}

/** Starts Poki's SDK; resolves to it once ready, or to null without it (blocked, failed): the game goes on either way. */
export function startPokiSdk(): Promise<PokiSdk | null> {
  const sdk = (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK;
  if (!sdk) return Promise.resolve(null);
  return sdk.init().then(
    () => sdk,
    // Poki: carry on loading the game in the catch branch too (an ad blocker, for one).
    () => sdk,
  );
}

/** What the game does while an ad plays: silence and stillness, then back. */
export interface AdPause {
  begin(): void;
  end(): void;
}

/** Loading, gameplay and level events for Poki. Events never fire twice in a row, nor while an ad plays. */
export class PokiPlatformService implements PlatformService {
  private playing = false;
  private sdk: PokiSdk | null = null;
  /** While an ad plays nothing is sent (Poki's rule); what the game wanted is caught up afterwards. */
  adPlaying = false;
  private wanted = false;
  private loaded = false;

  /** What the game reports before the SDK is ready is sent once it is. */
  constructor(ready: Promise<PokiSdk | null>) {
    void ready.then((sdk) => {
      this.sdk = sdk;
      if (this.loaded) sdk?.gameLoadingFinished();
      this.catchUp();
    });
  }

  loadingFinished(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.sdk?.gameLoadingFinished();
  }

  setPlaying(playing: boolean): void {
    this.wanted = playing;
    if (this.adPlaying || playing === this.playing || !this.sdk) return;
    this.playing = playing;
    if (playing) this.sdk.gameplayStart();
    else this.sdk.gameplayStop();
  }

  /** After an ad: the gameplay state the game wants now. */
  catchUp(): void {
    this.setPlaying(this.wanted);
  }

  levelEvent(level: number, action: 'start' | 'complete' | 'fail'): void {
    this.sdk?.measure?.('level', String(level), action);
  }
}

/**
 * Poki's ads: a commercial break between levels (Poki decides whether one plays, and how often: the game keeps no
 * timer of its own), and rewarded breaks the player chooses. The game is stopped (gameplayStop), silent and still
 * from before the call until the break ends.
 */
export class PokiAdService implements AdService {
  private sdk: PokiSdk | null = null;

  constructor(
    ready: Promise<PokiSdk | null>,
    private readonly platform: PokiPlatformService,
    private readonly pause: AdPause,
  ) {
    void ready.then((sdk) => (this.sdk = sdk));
  }

  get rewardedAvailable(): boolean {
    return this.sdk !== null;
  }

  showInterstitial(_placement: string): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve();
    return this.around(() => sdk.commercialBreak()).then(() => undefined);
  }

  showRewarded(_placement: string): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve(false);
    return this.around(() => sdk.rewardedBreak()).then((watched) => watched === true);
  }

  /** Stops gameplay, silences and stills the game, runs the break, then brings everything back (even if it fails). */
  private around<T>(run: () => Promise<T>): Promise<T | undefined> {
    this.platform.setPlaying(false);
    this.platform.adPlaying = true;
    this.pause.begin();
    const done = () => {
      this.pause.end();
      this.platform.adPlaying = false;
      this.platform.catchUp();
    };
    return run().then(
      (value) => {
        done();
        return value;
      },
      () => {
        done();
        return undefined;
      },
    );
  }
}
