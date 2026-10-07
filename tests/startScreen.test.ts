import { describe, expect, it } from 'vitest';
import { startScreen } from '../src/ui/startScreen';
import { parseArrivalParam, wantsHome } from '../src/dev/uiParams';

describe('where the game opens', () => {
  it('drops a first-time player straight into level 1, and opens the home screen after that', () => {
    expect(startScreen(0)).toEqual({ scene: 'Game', levelIndex: 0 });
    expect(startScreen(1)).toEqual({ scene: 'Home' });
    expect(startScreen(24)).toEqual({ scene: 'Home' });
  });

  it('follows ?level and ?home in development', () => {
    expect(startScreen(5, { level: 2, home: false })).toEqual({ scene: 'Game', levelIndex: 2 });
    expect(startScreen(0, { level: null, home: true })).toEqual({ scene: 'Home' });
    expect(wantsHome('?home')).toBe(true);
    expect(wantsHome('?arrival=3')).toBe(true);
    expect(parseArrivalParam('?arrival=3', 24)).toBe(2);
    expect(parseArrivalParam('?arrival=30', 24)).toBeNull();
  });
});
