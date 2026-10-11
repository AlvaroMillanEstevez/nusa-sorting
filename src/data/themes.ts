/**
 * Themed levels: each brings its own decoration and a set of cultural objects, which appear for the first time
 * in its level and can turn up in any level after it, never before.
 */
export const THEMES = [
  { id: 'budaya-jawa', level: 5 },
  { id: '17-agustus', level: 10 },
  { id: 'pasar-malam', level: 15 },
  { id: 'laut-nusantara', level: 20 },
  { id: 'olahraga', level: 25 },
  { id: 'permainan-tradisional', level: 30 },
  { id: 'rempah-maluku', level: 35 },
  { id: 'sawah', level: 40 },
  { id: 'fauna-nusantara', level: 45 },
  // The closing festival: no objects of its own, a party mixing every island's.
  { id: 'festival-nusantara', level: 50 },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function themeById(id: string): (typeof THEMES)[number] | undefined {
  return THEMES.find((t) => t.id === id);
}
