import type * as Phaser from 'phaser';
import { createGame, stackOf, type LevelDefinition } from '../core';
import { parseItemType } from '../data/itemCatalog';
import { itemBackTextureKey, itemTextureKey } from '../scenes/itemTextures';
import { setArtHooks } from '../scenes/artHooks';
import { setItemBoundsOverride } from '../ui/itemFit';
import pilot from './artpilot/pilot.json';

/**
 * Development only (?artpilot): a mock-up of the illustrated art Koke is trying (art-source/pilot, prepared by
 * tools/art/prepare_pilot.py) in a real level, with the game's own HUD and layout: the six illustrated objects
 * stand in for the level's kinds (repeated when it has more than six), illustrated shelves cover the drawn ones,
 * and the game backgrounds (portrait on phones, landscape on desktops) replace the drawn backdrop in levels
 * without a theme. Nothing here reaches the game: it only runs with ?artpilot, in development.
 */

const URLS = import.meta.glob('./artpilot/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (name: string) => URLS[`./artpilot/${name}.webp`]!;
export const PILOT_OBJECTS = Object.keys(pilot.objects) as (keyof typeof pilot.objects)[];

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
  const names = [...PILOT_OBJECTS.flatMap((o) => [o, `${o}-back`, `${o}-grey`]), 'shelf', 'background-portrait', 'background-landscape'];
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
      if (!scene.textures.exists('pilot:shelf')) scene.textures.addImage('pilot:shelf', images.get('shelf')!);
      return shelves.map((shelf) =>
        scene.add
          .image(shelf.rect.x, shelf.rect.y - g.overhangTop * s, 'pilot:shelf')
          .setOrigin(0)
          .setDisplaySize(shelfWidth * s, shelfHeight * s)
          .setDepth(1),
      );
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
