import { ALBUM_PAGES } from '../../src/core/album';
import { BUKU_NENEK } from '../../src/data/bukuNenek';
import { ITEM_KINDS } from '../../src/data/itemCatalog';

/** Page names for the review document (the game's own come from i18n). */
const PAGE_NAMES: Readonly<Record<string, string>> = {
  dish: 'Platos (Hidangan)',
  snack: 'Fritos (Gorengan)',
  sweet: 'Dulces (Jajanan manis)',
  drink: 'Bebidas (Minuman)',
  fruit: 'Fruta y chile (Buah dan cabai)',
  'budaya-jawa': 'Budaya Jawa',
  '17-agustus': '17 Agustus',
  'pasar-malam': 'Pasar Malam',
  'laut-nusantara': 'Laut Nusantara',
  olahraga: 'Olahraga',
  'permainan-tradisional': 'Permainan Tradisional',
  'rempah-maluku': 'Rempah Maluku',
  sawah: 'Sawah',
  'fauna-nusantara': 'Fauna Nusantara',
};

const cell = (text: string | undefined) => (text ?? '–').replace(/\|/g, '\\|');

/** docs/buku-nenek.md: every entry of Buku Nenek in a table, for review before publishing. */
export function main(): string {
  const lines = [
    '# Buku Nenek · textos para revisar',
    '',
    'Generado desde `src/data/bukuNenek.ts` con `node tools/docs/buku-nenek.mjs` (no editar a mano: corregir el archivo de datos y volver a generar).',
    '',
    '**Todas las entradas están pendientes de revisión.** Para cada una: comprobar que el dato es cierto y que el indonesio suena natural; corregir en el archivo de datos. Los nombres vienen del catálogo de objetos (`src/data/itemCatalog.ts`).',
    '',
    '| # | Página | Objeto | Nombre (EN) | Nombre (ID) | Región (EN) | Región (ID) | Dato (EN) | Dato (ID) | Estado |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  let n = 0;
  for (const page of ALBUM_PAGES) {
    for (const id of page.kinds) {
      const kind = ITEM_KINDS.find((k) => k.id === id)!;
      const entry = BUKU_NENEK[id]!;
      n++;
      lines.push(
        `| ${n} | ${PAGE_NAMES[page.id]} | \`${id}\` | ${cell(kind.name.en)} | ${cell(kind.name.id)} | ${cell(entry.region?.en)} | ${cell(entry.region?.id)} | ${cell(entry.fact.en)} | ${cell(entry.fact.id)} | pendiente de revisión |`,
      );
    }
  }
  return lines.join('\n') + '\n';
}
