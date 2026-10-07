import * as Phaser from 'phaser';
import { ITEM_KINDS, itemTypeId, VARIANTS, type ItemKind } from '../data/itemCatalog';
import { THEMES } from '../data/themes';
import { getLocale, t, type MessageKey } from '../i18n';
import { shelfHeightUnits, shelfLayoutAt } from '../ui/boardLayout';
import { mapWood } from '../ui/art/wood';
import { simulateSvg, simulateVision, type Vision } from '../ui/icons/color';
import { renderItemSvg } from '../ui/icons/icons';
import { ITEM_FILL } from '../ui/levelLayout';
import { theme } from '../ui/theme';
import { makeWoodArt } from '../scenes/art/woodArt';
import type { ArtSet } from '../scenes/art/ArtSet';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, pointerAt, RENDER_RATIO, viewSize } from '../scenes/view';

/**
 * Development only (`?gallery`): every item kind in its three variants at real in-game sizes, on the wooden
 * shelves, with colour-blindness and greyscale simulations applied to icons and shelves alike, and the kinds
 * most likely to be mixed up side by side.
 */

/** Kinds to compare side by side: confusable groups of the catalogue and other pairs that might look alike. */
const LOOK_ALIKES: readonly (readonly string[])[] = [
  ['tempe', 'tahu-goreng', 'martabak-manis'],
  ['klepon', 'dadar-gulung', 'onde-onde'],
  ['cabai', 'rambutan', 'salak'],
  ['bakso', 'mie-goreng', 'nasi-goreng'],
  ['ayam-goreng', 'pisang-goreng', 'sate'],
  ['es-teh-manis', 'jamu', 'es-cendol'],
  ['gado-gado', 'rendang', 'ketupat'],
  ['es-kelapa-muda', 'manggis', 'durian'],
  ['kerupuk-udang', 'ikan-bakar', 'tempe'],
  // Cultural objects next to food (and each other) that might look alike.
  ['kelapa', 'es-kelapa-muda', 'manggis'],
  ['layangan', 'ketupat', 'kipas'],
  ['bintang-laut', 'kembang-api', 'durian'],
  ['balon', 'rambutan', 'lampion'],
  ['peci', 'blangkon', 'caping'],
  ['karung', 'batik', 'tempe'],
  ['gong', 'kerang', 'onde-onde'],
  ['topeng', 'wayang-kulit', 'arum-manis'],
  ['bendera', 'panjat-pinang', 'terompet'],
  ['kendang', 'jaring', 'pinisi'],
  ['arum-manis', 'kerupuk-udang', 'klepon'],
];

const SIZES = [36, 40, 52] as const;
const TOGETHER_PX = 40;
const VISIONS: readonly Vision[] = ['normal', 'deuteranopia', 'protanopia', 'grayscale'];
const PAD = 16;
const GAP = 14;
const LABEL_W = 46;
const TAP_SLOP = 10;

interface Section {
  readonly title: string;
  /** Kinds side by side on shelves of three, as in a level (item type ids; 'blocker' and 'locked' too). */
  readonly shelves: readonly (readonly (string | null)[])[];
  readonly shelvesLabel: string;
  /** Kinds with a card each: their three variants at every size. */
  readonly cards: readonly ItemKind[];
}

export class GalleryScene extends Phaser.Scene {
  private vision: Vision = 'normal';
  /** Colour-blind mode: variant badges on. */
  private marks = false;
  private art!: ArtSet;
  private scroll = 0;
  private headerHeight = 0;
  private contentHeight = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;
  private content!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Container;
  private drawing = 0;

  constructor() {
    super('Gallery');
  }

  create(): void {
    fitCamera(this);
    this.cameras.main.setBackgroundColor(theme.background);
    this.content = this.add.container(0, 0);
    this.header = this.add.container(0, 0).setDepth(10);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.press = { y: pointerAt(pointer).y, scroll: this.scroll, moved: false };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.press || !pointer.isDown) return;
      const dy = pointerAt(pointer).y - this.press.y;
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
    const inThrees = (kinds: readonly ItemKind[]) => {
      const shelves: (string | null)[][] = [];
      for (let i = 0; i < kinds.length; i += 3) shelves.push(kinds.slice(i, i + 3).map((k) => k.id));
      return shelves;
    };
    const food = ITEM_KINDS.filter((k) => !k.theme);
    const themed = THEMES.map((theme): Section => {
      const kinds = ITEM_KINDS.filter((k) => k.theme === theme.id);
      return {
        title: t('gallery.theme', { name: t(`theme.${theme.id}`), level: theme.level }),
        shelves: inThrees(kinds),
        shelvesLabel: t('gallery.together'),
        cards: kinds,
      };
    });
    return [
      {
        title: t('gallery.icons'),
        shelves: [...inThrees(food), ['blocker', null, null], ['locked', null, null]],
        shelvesLabel: t('gallery.together'),
        cards: food,
      },
      ...themed,
      { title: t('gallery.lookAlikes'), shelves: LOOK_ALIKES, shelvesLabel: t('gallery.together'), cards: [] },
    ];
  }

  private textureKey(type: string, px: number): string {
    return `gallery:${this.vision}:${this.marks ? 'marked' : 'plain'}:${px}:${type}`;
  }

  /** Rasterizes every icon the gallery shows, for the current vision, then draws the page. */
  private async setVision(vision: Vision): Promise<void> {
    this.vision = vision;
    this.art = makeWoodArt(mapWood((color) => simulateVision(color, vision)));
    const run = ++this.drawing;
    this.drawHeader(true);
    const jobs: Promise<void>[] = [];
    for (const section of this.sections())
      for (const kind of section.cards)
        for (const variant of VARIANTS) {
          const type = itemTypeId(kind.id, variant);
          const svg = simulateSvg(renderItemSvg(type, this.marks), vision);
          // Rasterized at exactly the size they show at, in device pixels.
          for (const px of SIZES) jobs.push(addSvgTexture(this.textures, this.textureKey(type, px), svg, px * RENDER_RATIO));
        }
    await Promise.all(jobs);
    if (run === this.drawing) this.redraw();
  }

  private redraw(): void {
    fitCamera(this);
    const { width } = viewSize(this);
    this.drawHeader(false);
    this.content.removeAll(true);

    let y = PAD;
    for (const section of this.sections()) {
      this.content.add(this.label(PAD, y, section.title, 20, theme.titleColor));
      y += 34;
      this.content.add(this.label(PAD, y, section.shelvesLabel, 14, theme.textColor));
      y = this.drawTogether(section.shelves, y + 24, width) + GAP * 2;

      // Cards: the kind's name, then one shelf per size with its three variants.
      const s = SIZES[SIZES.length - 1]! / ITEM_FILL;
      const cardW = LABEL_W + shelfLayoutAt(0, 0, s).rect.width;
      const columns = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (cardW + GAP)));
      let rowBottom = y;
      section.cards.forEach((kind, i) => {
        const col = i % columns;
        if (col === 0) y = rowBottom;
        const bottom = this.drawCard(kind, PAD + col * (cardW + GAP), y);
        rowBottom = Math.max(rowBottom, bottom + GAP);
      });
      y = rowBottom + GAP;
    }
    this.contentHeight = y;
    this.setScroll(this.scroll);
  }

  /** Kinds in their original colours on shelves of three; 'blocker' shows the crate, 'locked' a locked shelf. */
  private drawTogether(groups: readonly (readonly (string | null)[])[], top: number, width: number): number {
    const s = TOGETHER_PX / ITEM_FILL;
    const shelfW = shelfLayoutAt(0, 0, s).rect.width;
    const columns = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (shelfW + GAP)));
    let bottom = top;
    groups.forEach((group, i) => {
      const shelf = shelfLayoutAt(PAD + (i % columns) * (shelfW + GAP), top + Math.floor(i / columns) * (s * shelfHeightUnits() + GAP * 1.5), s);
      const g = this.add.graphics();
      this.art.drawShelf(g, shelf, s);
      this.content.add(g);
      group.forEach((type, slot) => {
        const at = shelf.slots[slot]!;
        if (type === 'blocker') {
          const crate = this.add.graphics().setPosition(at.x, at.y);
          this.art.drawBlocker(crate, s);
          this.content.add(crate);
        } else if (type === 'locked') {
          const veil = this.add.graphics().setPosition(shelf.rect.x + shelf.rect.width / 2, shelf.rect.y + shelf.rect.height / 2);
          this.art.drawLockVeil(veil, shelf.rect.width, shelf.rect.height, s);
          this.content.add(veil);
          this.content.add(
            this.label(veil.x - s * 0.12, veil.y, t('shelf.locked', { n: 2 }), Math.round(s * 0.3), theme.textColor).setOrigin(0, 0.5),
          );
        } else if (type) {
          this.content.add(this.icon(type, TOGETHER_PX, at.x, at.y));
        }
      });
      bottom = Math.max(bottom, shelf.rect.y + shelf.rect.height);
    });
    return bottom;
  }

  private drawCard(kind: ItemKind, x: number, top: number): number {
    this.content.add(this.label(x, top, kind.name[getLocale()], 15, theme.textColor));
    let y = top + 22;
    for (const px of SIZES) {
      const s = px / ITEM_FILL;
      const shelf = shelfLayoutAt(x + LABEL_W, y, s);
      const g = this.add.graphics();
      this.art.drawShelf(g, shelf, s);
      this.content.add(g);
      this.content.add(this.label(x, shelf.slots[0]!.y - 8, t('gallery.px', { n: px }), 12, theme.textColor));
      VARIANTS.forEach((variant, i) => {
        const slot = shelf.slots[i]!;
        this.content.add(this.icon(itemTypeId(kind.id, variant), px, slot.x, slot.y));
      });
      y = shelf.rect.y + shelf.rect.height + s * 0.25;
    }
    return y;
  }

  private icon(type: string, px: number, x: number, y: number): Phaser.GameObjects.Image {
    return this.add.image(Math.round(x), Math.round(y), this.textureKey(type, px)).setDisplaySize(px, px);
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: theme.fontFamily, fontStyle: 'bold', fontSize: `${size}px`, color })
      .setResolution(RENDER_RATIO);
  }

  /** Title and vision buttons, wrapping onto more rows on narrow screens. */
  private drawHeader(loading: boolean): void {
    const { width } = viewSize(this);
    this.header.removeAll(true);
    const background = this.add.rectangle(0, 0, width, 1, theme.panelColor).setOrigin(0);
    this.header.add(background);
    this.header.add(this.label(PAD, 12, loading ? t('gallery.loading') : t('gallery.title'), 20, theme.titleColor));
    let x = PAD;
    let y = 48;
    const marksLabel = t('settings.colorBlind', { state: t(this.marks ? 'settings.on' : 'settings.off') });
    for (const vision of [...VISIONS, 'marks' as const]) {
      const active = vision === this.vision || (vision === 'marks' && this.marks);
      const button = this.add
        .text(0, 0, vision === 'marks' ? marksLabel : t(`gallery.vision.${vision}` as MessageKey), {
          fontFamily: theme.fontFamily,
          fontStyle: 'bold',
          fontSize: '14px',
          color: theme.textColor,
          backgroundColor: active ? theme.accentButtonColor : theme.buttonColor,
          padding: { x: 10, y: 7 },
        })
        .setResolution(RENDER_RATIO)
        .setInteractive({ useHandCursor: true });
      if (x > PAD && x + button.width > width - PAD) {
        x = PAD;
        y += button.height + 8;
      }
      button.setPosition(x, y);
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (this.press?.moved) return;
        if (vision === 'marks') {
          this.marks = !this.marks;
          void this.setVision(this.vision);
        } else if (vision !== this.vision) {
          void this.setVision(vision);
        }
      });
      this.header.add(button);
      x += button.width + 8;
      this.headerHeight = y + button.height + 12;
    }
    background.setSize(width, this.headerHeight);
  }

  private setScroll(scroll: number): void {
    const visible = viewSize(this).height - this.headerHeight;
    this.scroll = Math.max(0, Math.min(scroll, this.contentHeight - visible));
    this.content.setY(this.headerHeight - this.scroll);
  }
}
