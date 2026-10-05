import * as Phaser from 'phaser';
import { ITEM_KINDS } from '../data/itemCatalog';
import type { ThemeId } from '../data/themes';
import { getLocale, t, textIn } from '../i18n';
import type { ThemeLook } from '../ui/themeLook';
import { theme as colours } from '../ui/theme';
import { itemTextureKey } from './itemTextures';
import { RENDER_RATIO } from './view';

/** Over the board and the HUD. */
const DEPTH_INTRO = 320;
const ICON_PX = 52;

/**
 * The screen shown the first time a player enters a themed level: the theme's name (in the current language,
 * with the other one under it) and the objects it brings. Closes on a tap; the game's clock keeps waiting.
 */
export class ThemeIntro {
  private parts: Phaser.GameObjects.GameObject[] = [];
  private onClose: (() => void) | null = null;
  private shown: { theme: ThemeId; look: ThemeLook; marks: boolean } | null = null;
  private width = 0;
  private height = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get visible(): boolean {
    return this.shown !== null;
  }

  show(theme: ThemeId, look: ThemeLook, marks: boolean, onClose: () => void): void {
    this.shown = { theme, look, marks };
    this.onClose = onClose;
    this.build();
    for (const part of this.parts) (part as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    this.scene.tweens.add({ targets: this.parts, alpha: 1, duration: 220 });
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.shown) this.build();
  }

  /** Drops the screen without calling back (e.g. another level starts). */
  clear(): void {
    this.shown = null;
    this.onClose = null;
    for (const part of this.parts) part.destroy();
    this.parts = [];
  }

  private close(): void {
    const onClose = this.onClose;
    this.clear();
    onClose?.();
  }

  private build(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    const shown = this.shown;
    if (!shown) return;
    const { width, height } = this;
    const add = <T extends Phaser.GameObjects.GameObject>(part: T): T => {
      (part as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH_INTRO);
      this.parts.push(part);
      return part;
    };
    const accent = Phaser.Display.Color.HexStringToColor(shown.look.accent).color;
    // The dim catches every tap: one closes the screen, none reaches the board.
    const dim = add(this.scene.add.rectangle(0, 0, width, height, colours.overlayDim, 0.82).setOrigin(0).setInteractive());
    dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.close());

    const kinds = ITEM_KINDS.filter((k) => k.theme === shown.theme);
    const columns = Math.min(kinds.length, Math.max(3, Math.floor((Math.min(width, 520) - 48) / (ICON_PX + 14))));
    const rows = Math.ceil(kinds.length / columns);
    const panelW = Math.min(width - 32, 520);
    const panelH = 190 + rows * (ICON_PX + 14);
    const cx = width / 2;
    const top = Math.max(16, height / 2 - panelH / 2);
    const panel = add(this.scene.add.graphics());
    panel.fillStyle(colours.panelColor, 1).fillRoundedRect(cx - panelW / 2, top, panelW, panelH, 18);
    panel.lineStyle(3, accent, 1).strokeRoundedRect(cx - panelW / 2, top, panelW, panelH, 18);

    const text = (y: number, value: string, size: number, color: string) =>
      add(
        this.scene.add
          .text(cx, y, value, { fontFamily: colours.fontFamily, fontStyle: 'bold', fontSize: `${size}px`, color, align: 'center' })
          .setOrigin(0.5)
          .setResolution(RENDER_RATIO),
      );
    const key = `theme.${shown.theme}` as const;
    const other = getLocale() === 'en' ? 'id' : 'en';
    text(top + 40, t(key), 30, shown.look.accent);
    if (textIn(other, key) !== t(key)) text(top + 72, textIn(other, key), 18, colours.textColor);
    text(top + 108, t('themeIntro.newItems'), 16, colours.textColor);

    const gridW = columns * (ICON_PX + 14) - 14;
    kinds.forEach((kind, i) => {
      const x = cx - gridW / 2 + (i % columns) * (ICON_PX + 14) + ICON_PX / 2;
      const y = top + 140 + Math.floor(i / columns) * (ICON_PX + 14) + ICON_PX / 2;
      const key = itemTextureKey(kind.id, shown.marks);
      if (this.scene.textures.exists(key)) add(this.scene.add.image(x, y, key).setDisplaySize(ICON_PX, ICON_PX));
    });
    text(top + panelH - 26, t('themeIntro.continue'), 15, colours.textColor).setAlpha(0.85);
  }
}
