import * as Phaser from 'phaser';
import { uiIconSvg, type UiIconName } from '../../ui/design/uiIcons';
import { addSvgTexture } from '../svgTexture';
import { pixelRatio } from '../view';

/** Interface icons are rasterized once per colour at this size (CSS px) and drawn at their size or smaller. */
const ICON_PX = 48;

export const uiIconKey = (name: UiIconName, color: string) => `ui:${name}:${color}`;

/** Rasterizes an icon in a colour (once). */
export function prepareUiIcon(scene: Phaser.Scene, name: UiIconName, color: string): Promise<void> {
  return addSvgTexture(scene.textures, uiIconKey(name, color), uiIconSvg(name, color), ICON_PX * pixelRatio());
}

/**
 * An icon image `px` wide. If its texture is not ready yet it starts blank and fills in when it is, so
 * components never wait (and whatever visibility a component sets meanwhile is kept).
 */
export function uiIcon(scene: Phaser.Scene, name: UiIconName, color: string, px: number): Phaser.GameObjects.Image {
  const key = uiIconKey(name, color);
  const image = scene.add.image(0, 0, scene.textures.exists(key) ? key : '__DEFAULT').setDisplaySize(px, px);
  if (!scene.textures.exists(key)) {
    void prepareUiIcon(scene, name, color).then(() => {
      if (!image.scene) return;
      image.setTexture(key).setDisplaySize(px, px);
    });
  }
  return image;
}
