/**
 * Ads boundary. Gameplay code only talks to this interface. The game's own build has no ads (NoopAdService) and
 * shows no ad button; a portal build (Poki: see PokiServices.ts) brings the portal's ads:
 * - interstitials ("commercial breaks") only between levels, as the next one is about to start, never during play;
 * - rewarded ads only where coins are spent, always optional and beside the way that costs no ad (placements such
 *   as 'continue').
 * The game is silent and still while an ad plays.
 */
export interface AdService {
  /** Whether rewarded ads can be offered at all (the UI shows their buttons only then). */
  readonly rewardedAvailable: boolean;
  /** Resolves to true if the player watched the ad to completion (only then is the reward given). */
  showRewarded(placement: string): Promise<boolean>;
  /** A chance for an interstitial between levels; the portal decides whether one plays. */
  showInterstitial(placement: string): Promise<void>;
}

/** Default implementation: no ads are shown and no reward is granted. */
export class NoopAdService implements AdService {
  readonly rewardedAvailable = false;

  showRewarded(_placement: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  showInterstitial(_placement: string): Promise<void> {
    return Promise.resolve();
  }
}
