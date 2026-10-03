import { describe, expect, it } from 'vitest';
import { parseLevelParam } from '../src/dev/levelParam';

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
