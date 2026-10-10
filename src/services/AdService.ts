/**
 * Ads boundary. Gameplay code only talks to this interface. There are no ads yet, and the game shows no ad
 * button (CrazyGames rejects ad buttons that do nothing in Basic Launch). When ads come, rewarded ones will be an
 * alternative to coins at the same moments coins are spent: buying a booster, continuing after a defeat
 * (placements such as 'booster', 'continue').
 */
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
