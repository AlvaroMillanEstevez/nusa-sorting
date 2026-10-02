/** Ads boundary. Gameplay code only talks to this interface. */
export interface AdService {
  /** Resolves to true if the player watched the ad to completion. */
  showRewarded(placement: string): Promise<boolean>;
  showInterstitial(placement: string): Promise<void>;
}

/** Default implementation: no ads are shown and no reward is granted. */
export class NoopAdService implements AdService {
  showRewarded(_placement: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  showInterstitial(_placement: string): Promise<void> {
    return Promise.resolve();
  }
}
