import type * as Phaser from 'phaser';
import { ITEM_KINDS } from '../data/itemCatalog';
import type { ThemeId } from '../data/themes';
import { getLocale, t, textIn } from '../i18n';
import { hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import type { ThemeLook } from '../ui/themeLook';
import { itemTextureKey } from './itemTextures';
import { KitButton, KitModal, kitText } from './kit';
import { screenRect, viewSize } from './view';

/** Over the board and the HUD. */
const DEPTH_INTRO = 320;
const ICON_PX = 52;

/**
 * The panel shown the first time a player enters a themed level: the theme's name (in the current language,
 * with the other one under it), a band in its colours and the objects it brings. Closes with its button; the
 * game's clock keeps waiting.
 */
export class ThemeIntro {
  private modal: KitModal | null = null;
  private onClose: (() => void) | null = null;
  private shown: { theme: ThemeId; look: ThemeLook; marks: boolean } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get visible(): boolean {
    return this.shown !== null;
  }

  show(theme: ThemeId, look: ThemeLook, marks: boolean, onClose: () => void): void {
    this.shown = { theme, look, marks };
    this.onClose = onClose;
    this.build();
    this.modal?.popIn();
  }

  layout(): void {
    if (this.shown) this.build();
  }

  /** Drops the panel without calling back (e.g. another level starts). */
  clear(): void {
    this.shown = null;
    this.onClose = null;
    this.modal?.destroy();
    this.modal = null;
  }

  private close(): void {
    const onClose = this.onClose;
    this.clear();
    onClose?.();
  }

  private build(): void {
    this.modal?.destroy();
    const shown = this.shown;
    if (!shown) return;
    const screen = screenRect(this.scene);
    const safe = viewSize(this.scene);
    const kinds = ITEM_KINDS.filter((k) => k.theme === shown.theme);
    const panelW = Math.min(safe.width - SPACE.s * 2, 440);
    const columns = Math.min(kinds.length, Math.max(3, Math.floor((panelW - SPACE.l * 2 + 12) / (ICON_PX + 12))));
    const rows = Math.ceil(kinds.length / columns);
    const key = `theme.${shown.theme}` as const;
    const other = getLocale() === 'en' ? 'id' : 'en';
    const bilingual = textIn(other, key) !== t(key);
    const panelH = Math.min(safe.height - SPACE.s * 2, 210 + (bilingual ? 24 : 0) + rows * (ICON_PX + 12));
    const modal = new KitModal(this.scene, screen.width, screen.height, { skin: SKIN, width: panelW, height: panelH, title: t(key) });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_INTRO);
    const panel = modal.panel;
    let y = panel.contentTop;
    if (bilingual) {
      panel.add(kitText(this.scene, 'body', textIn(other, key), SKIN.text.secondary).setY(y + 4));
      y += 26;
    }
    // A band in the theme's colours, with its motif colours as dots: the theme's identity, not its text.
    const band = this.scene.add.graphics();
    const bandW = panelW - SPACE.l * 2;
    band.fillStyle(hexNumber(shown.look.accent), 1).fillRoundedRect(-bandW / 2, y + 6, bandW, 6, 3);
    shown.look.motifColors.forEach((color, i, all) => {
      band.fillStyle(hexNumber(color), 1).fillCircle(((i + 1) / (all.length + 1) - 0.5) * bandW, y + 9, 5);
    });
    panel.add(band);
    y += 24;
    panel.add(kitText(this.scene, 'label', t('themeIntro.newItems').toUpperCase(), SKIN.text.secondary).setY(y + 6));
    y += 22;
    const gridW = columns * (ICON_PX + 12) - 12;
    kinds.forEach((kind, i) => {
      const x = -gridW / 2 + (i % columns) * (ICON_PX + 12) + ICON_PX / 2;
      const iy = y + Math.floor(i / columns) * (ICON_PX + 12) + ICON_PX / 2;
      const textureKey = itemTextureKey(kind.id, shown.marks);
      if (this.scene.textures.exists(textureKey)) panel.add(this.scene.add.image(x, iy, textureKey).setDisplaySize(ICON_PX, ICON_PX));
    });
    panel.add(
      new KitButton(this.scene, 0, panelH / 2 - SPACE.m - 28, {
        skin: SKIN,
        variant: 'primary',
        label: t('themeIntro.start'),
        icon: 'play',
        width: Math.min(260, panelW - SPACE.l * 2),
        onPress: () => this.close(),
      }),
    );
    this.modal = modal;
  }
}
