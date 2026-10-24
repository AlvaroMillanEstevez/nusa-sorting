import { describe, expect, it } from 'vitest';
import { NoopAdService } from '../src/services/AdService';
import { PokiAdService, PokiPlatformService } from '../src/services/PokiServices';

/** A stand-in for Poki's SDK that records every call, with ads that resolve when told to. */
function fakeSdk(rewardedResult = true) {
  const calls: string[] = [];
  let finishAd: () => void = () => {};
  const sdk = {
    init: () => Promise.resolve(),
    gameLoadingFinished: () => calls.push('loadingFinished'),
    gameplayStart: () => calls.push('start'),
    gameplayStop: () => calls.push('stop'),
    commercialBreak: () => {
      calls.push('commercialBreak');
      return new Promise<void>((resolve) => (finishAd = resolve));
    },
    rewardedBreak: () => {
      calls.push('rewardedBreak');
      return new Promise<boolean>((resolve) => (finishAd = () => resolve(rewardedResult)));
    },
    measure: (category: string, what: string, action: string) => calls.push(`measure ${category} ${what} ${action}`),
  };
  return { sdk, calls, finishAd: () => finishAd() };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Poki services', () => {
  it('send loading finished once the SDK is ready, even if the game was ready first', async () => {
    const { sdk, calls } = fakeSdk();
    let ready!: (value: typeof sdk) => void;
    const platform = new PokiPlatformService(new Promise((resolve) => (ready = resolve)));
    platform.loadingFinished();
    platform.loadingFinished();
    expect(calls).toEqual([]);
    ready(sdk);
    await tick();
    expect(calls).toEqual(['loadingFinished']);
  });

  it('never send the same gameplay event twice in a row', async () => {
    const { sdk, calls } = fakeSdk();
    const platform = new PokiPlatformService(Promise.resolve(sdk));
    await tick();
    platform.setPlaying(false);
    platform.setPlaying(true);
    platform.setPlaying(true);
    platform.setPlaying(false);
    platform.setPlaying(false);
    platform.setPlaying(true);
    expect(calls).toEqual(['start', 'stop', 'start']);
  });

  it('stop gameplay, silence and still the game during an ad, send nothing meanwhile, then catch up', async () => {
    const { sdk, calls, finishAd } = fakeSdk();
    const ready = Promise.resolve(sdk);
    const platform = new PokiPlatformService(ready);
    const pauses: string[] = [];
    const ads = new PokiAdService(ready, platform, { begin: () => pauses.push('begin'), end: () => pauses.push('end') });
    await tick();
    platform.setPlaying(true);
    const shown = ads.showRewarded('continue');
    expect(calls).toEqual(['start', 'stop', 'rewardedBreak']);
    expect(pauses).toEqual(['begin']);
    // The game would carry on asking (its update loop): nothing reaches Poki while the ad plays.
    platform.setPlaying(true);
    expect(calls).toEqual(['start', 'stop', 'rewardedBreak']);
    finishAd();
    expect(await shown).toBe(true);
    expect(pauses).toEqual(['begin', 'end']);
    expect(calls).toEqual(['start', 'stop', 'rewardedBreak', 'start']);
  });

  it('give no reward for an ad not watched to the end', async () => {
    const { sdk, finishAd } = fakeSdk(false);
    const ready = Promise.resolve(sdk);
    const ads = new PokiAdService(ready, new PokiPlatformService(ready), { begin: () => {}, end: () => {} });
    await tick();
    const shown = ads.showRewarded('continue');
    finishAd();
    expect(await shown).toBe(false);
  });

  it('let the game play on without the SDK (an ad blocker): no events, no ads, no rewards offered', async () => {
    const ready = Promise.resolve(null);
    const platform = new PokiPlatformService(ready);
    const ads = new PokiAdService(ready, platform, { begin: () => {}, end: () => {} });
    await tick();
    platform.setPlaying(true);
    platform.loadingFinished();
    expect(ads.rewardedAvailable).toBe(false);
    expect(await ads.showRewarded('continue')).toBe(false);
    await expect(ads.showInterstitial('level')).resolves.toBeUndefined();
  });

  it('send level progress for Poki’s analytics', async () => {
    const { sdk, calls } = fakeSdk();
    const platform = new PokiPlatformService(Promise.resolve(sdk));
    await tick();
    platform.levelEvent(3, 'start');
    platform.levelEvent(3, 'fail');
    expect(calls).toEqual(['measure level 3 start', 'measure level 3 fail']);
  });

  it('the game’s own build offers no rewarded ads', () => {
    expect(new NoopAdService().rewardedAvailable).toBe(false);
  });
});
