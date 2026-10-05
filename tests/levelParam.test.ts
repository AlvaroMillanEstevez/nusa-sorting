import { describe, expect, it } from 'vitest';
import { wantsGallery } from '../src/dev/galleryParam';
import { parseArrangementParam, parseLevelParam } from '../src/dev/levelParam';
import { wantsSaveReset } from '../src/dev/saveParams';

describe('parseLevelParam (dev only)', () => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

  it('finds the level with that number, including levels made ahead of their turn', () => {
    expect(parseLevelParam('?level=5', numbers)).toBe(4);
    expect(parseLevelParam('?foo=1&level=1', numbers)).toBe(0);
    expect(parseLevelParam('?level=15', numbers)).toBe(10);
    expect(parseLevelParam('?level=20', numbers)).toBe(11);
  });

  it('ignores missing, malformed or unknown numbers', () => {
    for (const search of ['', '?level=', '?level=0', '?level=11', '?level=21', '?level=-1', '?level=2.5', '?level=abc']) {
      expect(parseLevelParam(search, numbers)).toBeNull();
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

describe('parseArrangementParam (dev only)', () => {
  it('picks an arrangement the level has, 0 being the level as written', () => {
    expect(parseArrangementParam('?level=3&arrangement=0', 8)).toBe(0);
    expect(parseArrangementParam('?arrangement=7', 8)).toBe(7);
    for (const search of ['', '?arrangement=', '?arrangement=8', '?arrangement=-1', '?arrangement=x']) {
      expect(parseArrangementParam(search, 8)).toBeNull();
    }
  });
});
