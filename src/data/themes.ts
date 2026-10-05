/**
 * Themed levels: each brings its own decoration and a set of cultural objects, which appear for the first time
 * in its level and can turn up in any level after it, never before.
 */
export const THEMES = [
  { id: 'budaya-jawa', level: 5 },
  { id: '17-agustus', level: 10 },
  { id: 'pasar-malam', level: 15 },
  { id: 'laut-nusantara', level: 20 },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function themeById(id: string): (typeof THEMES)[number] | undefined {
  return THEMES.find((t) => t.id === id);
}
