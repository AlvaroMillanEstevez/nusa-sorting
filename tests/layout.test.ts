import { describe, expect, it } from 'vitest';
import { titleFontSize } from '../src/ui/layout';

describe('titleFontSize', () => {
  it('scales with the short side of the viewport', () => {
    expect(titleFontSize(390, 844)).toBe(titleFontSize(844, 390));
    expect(titleFontSize(500, 800)).toBe(60);
  });

  it('clamps to a readable range', () => {
    expect(titleFontSize(100, 100)).toBe(28);
    expect(titleFontSize(4000, 3000)).toBe(96);
  });
});
