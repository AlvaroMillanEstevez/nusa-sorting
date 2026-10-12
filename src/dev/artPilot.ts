import type * as Phaser from 'phaser';
import { createGame, stackOf, type LevelDefinition } from '../core';
import { parseItemType } from '../data/itemCatalog';
import { itemBackTextureKey, itemTextureKey } from '../scenes/itemTextures';
import { setArtHooks } from '../scenes/artHooks';
import { setItemBoundsOverride } from '../ui/itemFit';
import pilot from './artpilot/pilot.json';

/**
 * Development only (?artpilot): a mock-up of the illustrated art Koke is trying (art-source/pilot, prepared by
 * tools/art/prepare_pilot.py) in a real level, with the game's own HUD and layout: the illustrated objects stand
 * in for the level's kinds (repeated when it has more kinds than there are drawings), illustrated shelves cover
 * the drawn ones, and the game backgrounds (portrait on phones, landscape on desktops) replace the drawn backdrop
 * in levels without a theme. Nothing here reaches the game: it only runs with ?artpilot, in development.
 */

const URLS = import.meta.glob('./artpilot/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (name: string) => URLS[`./artpilot/${name}.webp`]!;

type PilotObject = keyof typeof pilot.objects;
/** Every drawing, sheet by sheet (the gallery's order). Kinds drawn again carry '-2' or '-3'. */
export const PILOT_SHEETS_ORDER = Object.keys(pilot.objects) as PilotObject[];
/** The kind a drawing is of. */
export const pilotKind = (object: string) => object.replace(/-\d$/, '');

/**
 * The order the mock-up gives a level's kinds the drawings in: the latest drawing of each kind first, then the
 * earlier drawings of the kinds drawn more than once (last), so levels show no two drawings of one food while
 * they have fewer kinds than there are foods drawn.
 */
export const PILOT_OBJECTS: readonly PilotObject[] = (() => {
  const latest = new Map<string, PilotObject>();
  for (const object of PILOT_SHEETS_ORDER) latest.set(pilotKind(object), object);
  const first = [...latest.values()];
  return [...first, ...PILOT_SHEETS_ORDER.filter((object) => !first.includes(object))];
})();

const images = new Map<string, HTMLImageElement>();

async function load(name: string): Promise<void> {
  const image = new Image();
  image.src = url(name);
  await image.decode();
  images.set(name, image);
}

/** Puts an image in as a texture, replacing what the key had. */
function setTexture(textures: Phaser.Textures.TextureManager, key: string, name: string): void {
  if (textures.exists(key)) textures.remove(key);
  textures.addImage(key, images.get(name)!);
}

/** The kinds a level uses, in the order they first appear on its board. */
function kindsOf(level: LevelDefinition): string[] {
  const state = createGame(level);
  const types: string[] = [];
  const note = (type: string) => types.includes(type) || types.push(type);
  state.shelves.forEach((shelf) => shelf.layers.forEach((layer) => layer.forEach((item) => item && note(item.type))));
  state.tracks.forEach((track) => track.carriers.forEach((carrier) => stackOf(carrier).forEach((item) => note(item.type))));
  return types;
}

/** Loads the pilot art and dresses every level with it. */
export async function installArtPilot(): Promise<void> {
  const views = ['', '-back', '-grey', '-deut', '-prot'];
  const names = [
    ...PILOT_SHEETS_ORDER.flatMap((o) => views.map((view) => `${o}${view}`)),
    'shelf',
    'shelf-v2',
    'shelf-v2-fit',
    'background-portrait',
    'background-landscape',
  ];
  await Promise.all(names.map(load));
  const g = pilot.shelf.geometry;
  const shelfWidth = g.post * 2 + g.interior * 3 + g.divider * 2;
  const shelfHeight = g.beam + g.slot + g.plank;
  setArtHooks({
    dressLevel(scene, level) {
      const bounds: Record<string, readonly [number, number, number, number]> = {};
      kindsOf(level).forEach((type, i) => {
        const object = PILOT_OBJECTS[i % PILOT_OBJECTS.length]!;
        setTexture(scene.textures, itemTextureKey(type, false), object);
        setTexture(scene.textures, itemTextureKey(type, true), object);
        setTexture(scene.textures, itemBackTextureKey(type), `${object}-back`);
        const kind = parseItemType(type)?.kind.id ?? type;
        bounds[kind] = pilot.objects[object].bounds as unknown as [number, number, number, number];
      });
      setItemBoundsOverride(bounds);
    },
    drawShelves(scene, shelves, s) {
      // ?shelf=v2 (the default): the second shelf as it is, scaled uniformly, its compartments centred on the
      // slots and its floor on their base; v2fit: the second shelf with its height fitted to the slots; v1: the
      // first shelf, rebuilt from its pieces.
      const choice = new URLSearchParams(window.location.search).get('shelf') ?? 'v2';
      const place = (shelf: (typeof shelves)[number]): { name: string; x: number; y: number; w: number; h: number } => {
        const { x, y } = shelf.rect;
        if (choice === 'v1') return { name: 'shelf', x, y: y - g.overhangTop * s, w: shelfWidth * s, h: shelfHeight * s };
        if (choice === 'v2fit') {
          const u = pilot.shelfV2Fit.units;
          return { name: 'shelf-v2-fit', x: x + (0.55 - u.firstCentre) * s, y: y - g.overhangTop * s, w: u.width * s, h: shelfHeight * s };
        }
        const u = pilot.shelfV2.units;
        // The slots' base is the shelf's top pad and one slot height down (see ui/boardLayout).
        const base = y + (0.08 + g.slot) * s;
        return { name: 'shelf-v2', x: x + (0.55 - u.centres[0]!) * s, y: base - u.floor * s, w: u.width * s, h: u.height * s };
      };
      return shelves.map((shelf) => {
        const { name, x, y, w, h } = place(shelf);
        const key = `pilot:${name}`;
        if (!scene.textures.exists(key)) scene.textures.addImage(key, images.get(name)!);
        return scene.add.image(x, y, key).setOrigin(0).setDisplaySize(w, h).setDepth(1);
      });
    },
    backdrop(scene, screen, wide) {
      const name = wide ? 'background-landscape' : 'background-portrait';
      const key = `pilot:${name}`;
      if (!scene.textures.exists(key)) scene.textures.addImage(key, images.get(name)!);
      const image = images.get(name)!;
      // Covers the whole screen, centred, cropping what does not fit.
      const scale = Math.max(screen.width / image.width, screen.height / image.height);
      return scene.add
        .image(screen.x + screen.width / 2, screen.y + screen.height / 2, key)
        .setScale(scale)
        .setDepth(-101);
    },
  });
}

/** The pilot's images by name (for the gallery page). */
export function pilotImage(name: string): HTMLImageElement | undefined {
  return images.get(name);
}
