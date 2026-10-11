/**
 * The player's titles: a cultural title for each stretch of player levels, from a street vendor to a merchant of
 * the whole archipelago. `from` is the player level that brings it. Names are in the i18n catalogues
 * (`playerTitle.<id>`); Koke and his wife review them.
 */
export const PLAYER_TITLES = [
  { id: 'kaki-lima', from: 1 },
  { id: 'keliling', from: 2 },
  { id: 'penjual-pasar', from: 4 },
  { id: 'pemilik-warung', from: 6 },
  { id: 'juragan-warung', from: 8 },
  { id: 'pedagang-besar', from: 11 },
  { id: 'saudagar', from: 14 },
  { id: 'saudagar-nusantara', from: 18 },
] as const;

export type PlayerTitleId = (typeof PLAYER_TITLES)[number]['id'];
