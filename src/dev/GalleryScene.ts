import * as Phaser from 'phaser';
import { ITEM_KINDS, itemTypeId, VARIANTS, type ItemKind } from '../data/itemCatalog';
import { getLocale, t, type MessageKey } from '../i18n';
import { shelfLayoutAt } from '../ui/boardLayout';
import { simulateSvg, type Vision } from '../ui/icons/color';
import { DRAWN_KINDS, ICON_STYLES, renderItemSvg, type IconStyle } from '../ui/icons/icons';
import { ITEM_FILL } from '../ui/levelLayout';
import { theme } from '../ui/theme';
import { drawShelf } from '../scenes/shelfArt';
import { addSvgTexture } from '../scenes/svgTexture';

/**
 * Development only (`?gallery`): every item kind in its three variants at real in-game sizes, on shelves, in
 * both candidate icon styles, with a colour-blindness simulation. Kinds without art show their placeholder.
 */

const SIZES = [36, 40, 52] as const;
const TOGETHER_PX = 40;
const VISIONS: readonly Vision[] = ['normal', 'deuteranopia', 'protanopia'];
const HEADER = 96;
const PAD = 16;
const GAP = 14;
const LABEL_W = 46;
const TAP_SLOP = 10;

interface Section {
  readonly title: string;
  readonly style: IconStyle;
  readonly kinds: readonly ItemKind[];
  /** Also show the kinds side by side on one long shelf. */
  readonly together: boolean;
}

export class GalleryScene extends Phaser.Scene {
  private vision: Vision = 'normal';
  private scroll = 0;
  private contentHeight = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;
  private content!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Container;
  private drawing = 0;

  constructor() {
    super('Gallery');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(theme.background);
    this.content = this.add.container(0, HEADER);
    this.header = this.add.container(0, 0).setDepth(10);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.press = { y: pointer.y, scroll: this.scroll, moved: false };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.press || !pointer.isDown) return;
      const dy = pointer.y - this.press.y;
      if (Math.abs(dy) > TAP_SLOP) this.press.moved = true;
      if (this.press.moved) this.setScroll(this.press.scroll - dy);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.press = null));
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.setScroll(this.scroll + dy),
    );
    this.scale.on(Phaser.Scale.Events.RESIZE, this.redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.redraw, this));

    void this.setVision('normal');
  }

  private sections(): Section[] {
    const drawn = DRAWN_KINDS.map((id) => ITEM_KINDS.find((k) => k.id === id)!);
    return [
      ...ICON_STYLES.map((style) => ({
        title: t(`gallery.style.${style}` as MessageKey),
        style,
        kinds: drawn,
        together: true,
      })),
      {
        title: t('gallery.placeholders'),
        style: 'soft' as const,
        kinds: ITEM_KINDS.filter((k) => !DRAWN_KINDS.includes(k.id)),
        together: false,
      },
    ];
  }

  private textureKey(type: string, style: IconStyle, px: number): string {
    return `gallery:${this.vision}:${style}:${px}:${type}`;
  }

  /** Rasterizes every icon the gallery shows, for the current vision, then draws the page. */
  private async setVision(vision: Vision): Promise<void> {
    this.vision = vision;
    const run = ++this.drawing;
    this.drawHeader(true);
    const jobs: Promise<void>[] = [];
    for (const section of this.sections())
      for (const kind of section.kinds)
        for (const variant of VARIANTS) {
          const type = itemTypeId(kind.id, variant);
          const svg = simulateSvg(renderItemSvg(type, section.style), vision);
          for (const px of SIZES) jobs.push(addSvgTexture(this.textures, this.textureKey(type, section.style, px), svg, px));
        }
    await Promise.all(jobs);
    if (run === this.drawing) this.redraw();
  }

  private redraw(): void {
    const { width } = this.scale.gameSize;
    this.cameras.main.setSize(width, this.scale.gameSize.height);
    this.drawHeader(false);
    this.content.removeAll(true);

    let y = PAD;
    for (const section of this.sections()) {
      this.content.add(this.label(PAD, y, section.title, 20, theme.titleColor));
      y += 34;
      if (section.together) y = this.drawTogether(section, y) + GAP;

      // Cards: the kind's name, then one shelf per size with its three variants.
      const s = SIZES[SIZES.length - 1]! / ITEM_FILL;
      const cardW = LABEL_W + shelfLayoutAt(0, 0, s).rect.width;
      const columns = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (cardW + GAP)));
      let rowBottom = y;
      section.kinds.forEach((kind, i) => {
        const col = i % columns;
        if (col === 0) y = rowBottom;
        const bottom = this.drawCard(section.style, kind, PAD + col * (cardW + GAP), y);
        rowBottom = Math.max(rowBottom, bottom + GAP);
      });
      y = rowBottom + GAP;
    }
    this.contentHeight = y;
    this.setScroll(this.scroll);
  }

  private drawTogether(section: Section, top: number): number {
    const s = TOGETHER_PX / ITEM_FILL;
    const count = section.kinds.length;
    const shelf = shelfLayoutAt(PAD, top, s, count);
    const g = this.add.graphics();
    drawShelf(g, shelf, s);
    this.content.add(g);
    section.kinds.forEach((kind, i) => {
      const slot = shelf.slots[i]!;
      this.content.add(this.icon(itemTypeId(kind.id), section.style, TOGETHER_PX, slot.x, slot.y));
    });
    return shelf.rect.y + shelf.rect.height;
  }

  private drawCard(style: IconStyle, kind: ItemKind, x: number, top: number): number {
    this.content.add(this.label(x, top, kind.name[getLocale()], 15, theme.textColor));
    let y = top + 22;
    for (const px of SIZES) {
      const s = px / ITEM_FILL;
      const shelf = shelfLayoutAt(x + LABEL_W, y, s);
      const g = this.add.graphics();
      drawShelf(g, shelf, s);
      this.content.add(g);
      this.content.add(this.label(x, shelf.slots[0]!.y - 8, t('gallery.px', { n: px }), 12, theme.textColor));
      VARIANTS.forEach((variant, i) => {
        const slot = shelf.slots[i]!;
        this.content.add(this.icon(itemTypeId(kind.id, variant), style, px, slot.x, slot.y));
      });
      y = shelf.rect.y + shelf.rect.height + 6;
    }
    return y;
  }

  private icon(type: string, style: IconStyle, px: number, x: number, y: number): Phaser.GameObjects.Image {
    return this.add.image(Math.round(x), Math.round(y), this.textureKey(type, style, px)).setDisplaySize(px, px);
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: theme.fontFamily, fontStyle: 'bold', fontSize: `${size}px`, color })
      .setResolution(window.devicePixelRatio || 1);
  }

  private drawHeader(loading: boolean): void {
    const { width } = this.scale.gameSize;
    this.header.removeAll(true);
    this.header.add(this.add.rectangle(0, 0, width, HEADER, theme.panelColor).setOrigin(0));
    this.header.add(this.label(PAD, 12, loading ? t('gallery.loading') : t('gallery.title'), 20, theme.titleColor));
    let x = PAD;
    for (const vision of VISIONS) {
      const active = vision === this.vision;
      const button = this.add
        .text(x, 52, t(`gallery.vision.${vision}` as MessageKey), {
          fontFamily: theme.fontFamily,
          fontStyle: 'bold',
          fontSize: '14px',
          color: theme.textColor,
          backgroundColor: active ? theme.accentButtonColor : theme.buttonColor,
          padding: { x: 10, y: 7 },
        })
        .setResolution(window.devicePixelRatio || 1)
        .setInteractive({ useHandCursor: true });
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (vision !== this.vision && !this.press?.moved) void this.setVision(vision);
      });
      this.header.add(button);
      x += button.width + 8;
    }
  }

  private setScroll(scroll: number): void {
    const visible = this.scale.gameSize.height - HEADER;
    this.scroll = Math.max(0, Math.min(scroll, this.contentHeight - visible));
    this.content.setY(HEADER - this.scroll);
  }
}
