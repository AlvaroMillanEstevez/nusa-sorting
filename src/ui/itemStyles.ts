import type { ItemType } from '../core';

export type ItemShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'star' | 'hexagon';

export interface ItemStyle {
  readonly color: number;
  readonly shape: ItemShape;
}

/**
 * Placeholder look for each item type until there is art. Every type differs in both color and shape,
 * so they stay distinguishable without relying on color alone.
 */
export const ITEM_STYLES: Readonly<Record<ItemType, ItemStyle>> = {
  apple: { color: 0xe5484d, shape: 'circle' },
  banana: { color: 0xf5d90a, shape: 'triangle' },
  grape: { color: 0xa855f7, shape: 'diamond' },
  lime: { color: 0x30a46c, shape: 'square' },
  blueberry: { color: 0x3b82f6, shape: 'star' },
};

const FALLBACK_STYLE: ItemStyle = { color: 0xbbbbbb, shape: 'hexagon' };

export function itemStyle(type: ItemType): ItemStyle {
  return ITEM_STYLES[type] ?? FALLBACK_STYLE;
}

export const itemTextureKey = (type: ItemType) => `item:${type}`;
