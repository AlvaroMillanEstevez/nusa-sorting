import { describe, expect, it } from 'vitest';
import { wantsGallery } from '../src/dev/galleryParam';
import { parseLevelParam } from '../src/dev/levelParam';
import { wantsSaveReset } from '../src/dev/saveParams';

describe('parseLevelParam (dev only)', () => {
  it('turns a 1-based level number into an index', () => {
    expect(parseLevelParam('?level=5', 7)).toBe(4);
    expect(parseLevelParam('?foo=1&level=1', 7)).toBe(0);
  });

  it('ignores missing, malformed or out-of-range values', () => {
    for (const search of ['', '?level=', '?level=0', '?level=8', '?level=-1', '?level=2.5', '?level=abc']) {
      expect(parseLevelParam(search, 7)).toBeNull();
    }
  });
});

describe('wantsSaveReset (dev only)', () => {
  it('is set by ?resetSave, with or without a value, alongside other parameters', () => {
    expect(wantsSaveReset('?resetSave')).toBe(true);
    expect(wantsSaveReset('?level=3&resetSave=1')).toBe(true);
    expect(wantsSaveReset('?level=3')).toBe(false);
    expect(wantsSaveReset('')).toBe(false);
  });
});

describe('wantsGallery (dev only)', () => {
  it('is set by ?gallery, alongside other parameters', () => {
    expect(wantsGallery('?gallery')).toBe(true);
    expect(wantsGallery('?resetSave&gallery=1')).toBe(true);
    expect(wantsGallery('?level=3')).toBe(false);
    expect(wantsGallery('')).toBe(false);
  });
});
