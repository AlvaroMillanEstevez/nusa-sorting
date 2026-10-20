import * as Phaser from 'phaser';
import { ITEM_KINDS, itemTypeId, VARIANTS, type ItemKind } from '../data/itemCatalog';
import { THEMES } from '../data/themes';
import { getLocale, t, type MessageKey } from '../i18n';
import { shelfHeightUnits, shelfLayoutAt, slotAspect } from '../ui/boardLayout';
import { placeItem, typeFit } from '../ui/itemFit';
import { simulateSvg, type Vision } from '../ui/icons/color';
import { renderBoosterSvg } from '../ui/icons/icons';
import { simulatePixels } from '../ui/art/itemPixels';
import { canvasOf, frontPixels, picture } from '../scenes/itemTextures';
import { freshCanvas } from '../scenes/FreshLooks';
import { loadShelfArt, placeShelf, SHELF_TEXTURE } from '../scenes/art/shelfArt';
import { BOOSTER_IDS, type BoosterId } from '../data/economy';
import { KitBoosterButton } from '../scenes/kit';
import { ITEM_FILL } from '../ui/levelLayout';
import { FONTS, SKIN } from '../ui/design/tokens';
import { ART_KEYS, loadArtPieces, makeBlocker, makeLockVeil, type ArtKeys } from '../scenes/art/ArtSet';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, pointerAt, RENDER_RATIO, viewSize } from '../scenes/view';

/**
 * Development only (`?gallery`): every item kind in its three variants (the original and the two colour variants
 * the game makes from its picture, see ui/art/itemPixels) at real in-game sizes, on the illustrated shelves, with
 * colour-blindness and greyscale simulations applied to items and shelves alike, and the kinds most likely to be
 * mixed up side by side.
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
  // Levels 25-45 against the whole catalogue: round things.
  ['sepak-takraw', 'congklak', 'onde-onde'],
  ['sepak-takraw', 'kelapa', 'kelereng'],
  ['sepatu', 'raket', 'karung'],
  ['sepatu', 'pinisi', 'ikan-bakar'],
  ['yoyo', 'gasing', 'rambutan'],
  ['bekel', 'manggis', 'balon'],
  ['peluit', 'terompet', 'bekel'],
  ['lada', 'klepon', 'durian'],
  ['pala', 'rambutan', 'manggis'],
  ['penyu', 'kerang', 'bintang-laut'],
  // Birds, faces and animals.
  ['rangkong', 'cendrawasih', 'komodo'],
  ['orangutan', 'tarsius', 'topeng'],
  ['kerbau', 'blangkon', 'topeng'],
  ['komodo', 'ikan-bakar', 'sate'],
  // Tall and thin things.
  ['egrang', 'panjat-pinang', 'raket'],
  ['kayu-manis', 'sate', 'tempe'],
  ['cengkeh', 'kembang-api', 'cabai'],
  ['padi', 'kembang-api', 'cengkeh'],
  ['cangkul', 'raket', 'kipas'],
  ['orang-orangan', 'wayang-kulit', 'caping'],
  // Containers and buildings.
  ['karung-rempah', 'karung', 'bakul'],
  ['bakul', 'bakso', 'cobek'],
  ['cobek', 'gong', 'nasi-goreng'],
  ['piala', 'gong', 'es-teh-manis'],
  ['gubuk', 'caping', 'bianglala'],
  ['kok', 'arum-manis', 'terompet'],
  ['congklak', 'pinisi', 'tempe'],
  ['lompat-tali', 'jaring', 'kerupuk-udang'],
];

const SIZES = [36, 40, 52] as const;
/** Foods the fresh countdown is tried on: light, mid and dark ones. */
const FRESH_SAMPLES = ['rambutan', 'kerupuk-udang', 'sate'] as const;
/** The countdown's states, left to right: fresh, in its last moves (swollen), spoiled. */
const FRESH_STATES: readonly (readonly [string, Parameters<typeof freshCanvas>[2]])[] = [
  ['fresh', { spoiled: false, moves: 12, warn: false, big: false }],
  ['warn', { spoiled: false, moves: 2, warn: true, big: true }],
  ['spoiled', { spoiled: true }],
];
/** Sizes a booster's icon shows at: the shop's tile, the game's bar, an offer. */
const BOOSTER_SIZES = [28, 40, 64] as const;
const TILE = 56;
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
  /** The board's wood, seen with the current vision. */
  private keys: ArtKeys = ART_KEYS;
  private scroll = 0;
  private headerHeight = 0;
  private contentHeight = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;
  private content!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Container;
  private drawing = 0;
  private ready = false;

  constructor() {
    super('Gallery');
  }

  create(): void {
    fitCamera(this);
    this.cameras.main.setBackgroundColor(SKIN.backdrop[1]);
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
    // A theme with no objects of its own (the closing festival) has nothing to show here.
    const themed = THEMES.filter((theme) => ITEM_KINDS.some((k) => k.theme === theme.id)).map((theme): Section => {
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

  private boosterKey(id: BoosterId): string {
    return `gallery:${this.vision}:booster:${id}`;
  }

  /**
   * The boosters: each icon at the sizes it shows at, and its tile in every state (available, none left, locked,
   * in use). Returns the bottom.
   */
  private drawBoosters(top: number, width: number): number {
    this.content.add(this.label(PAD, top, t('gallery.boosters'), 20, SKIN.text.accent));
    let y = top + 40;
    const states = [
      ['ready', 'gallery.tile.ready'],
      ['empty', 'gallery.tile.empty'],
      ['locked', 'gallery.tile.locked'],
      ['inUse', 'gallery.tile.inUse'],
    ] as const;
    for (const id of BOOSTER_IDS) {
      this.content.add(this.label(PAD, y, t(`booster.${id}.name`), 15, SKIN.text.primary));
      y += 24;
      let x = PAD;
      const rowMid = y + 34;
      for (const px of BOOSTER_SIZES) {
        this.content.add(this.add.image(x + px / 2, rowMid, this.boosterKey(id)).setDisplaySize(px, px));
        x += px + GAP;
      }
      x += GAP;
      for (const [state, label] of states) {
        if (x + TILE + PAD > width) {
          x = PAD + BOOSTER_SIZES.reduce((sum, px) => sum + px + GAP, 0) + GAP;
          y += TILE + 36;
        }
        const tile = new KitBoosterButton(this, x + TILE / 2, y + 34, { texture: this.boosterKey(id), size: TILE, state: state === 'inUse' ? 'ready' : state, count: 2 });
        if (state === 'inUse') tile.setInUse(true);
        this.content.add(tile);
        this.content.add(this.label(x, y + 34 + TILE / 2 + 10, t(label), 12, SKIN.text.secondary));
        x += TILE + GAP * 2;
      }
      y += TILE + 48;
    }
    return y;
  }

  private textureKey(type: string): string {
    return `gallery:${this.vision}:${this.marks ? 'marked' : 'plain'}:${type}`;
  }

  /** Prepares every item the gallery shows, for the current vision, then draws the page. */
  private async setVision(vision: Vision): Promise<void> {
    this.vision = vision;
    const run = ++this.drawing;
    this.drawHeader(true);
    const see = (pixels: Uint8ClampedArray) => (vision === 'normal' ? pixels : simulatePixels(pixels, vision));
    await Promise.all([loadShelfArt(this.textures), loadArtPieces(this.textures)]);
    // The board's wood through the same simulation as the items.
    const simulated = (key: string) => {
      const seen = `gallery:${vision}:${key}`;
      if (!this.textures.exists(seen)) {
        const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(source, 0, 0);
        const pixels = see(context.getImageData(0, 0, source.width, source.height).data);
        context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, source.width, source.height), 0, 0);
        this.textures.addImage(seen, canvas as unknown as HTMLImageElement);
      }
      return seen;
    };
    this.keys = Object.fromEntries(Object.entries(ART_KEYS).map(([name, key]) => [name, simulated(key)])) as unknown as ArtKeys;
    const jobs: Promise<void>[] = [];
    for (const section of this.sections())
      for (const kind of section.cards)
        for (const variant of VARIANTS) {
          const type = itemTypeId(kind.id, variant);
          const key = this.textureKey(type);
          if (this.textures.exists(key)) continue;
          jobs.push(
            picture(kind.id).then((image) => {
              if (!this.textures.exists(key)) this.textures.addImage(key, canvasOf(see(frontPixels(type, image)), this.marks ? variant : null) as unknown as HTMLImageElement);
            }),
          );
        }

    // Boosters' icons, once per vision, big enough for the largest tile.
    for (const id of BOOSTER_IDS) jobs.push(addSvgTexture(this.textures, this.boosterKey(id), simulateSvg(renderBoosterSvg(id), vision), 128 * RENDER_RATIO));
    // Fresh foods' countdown, in both styles and every state, through the same simulation.
    for (const type of FRESH_SAMPLES)
      jobs.push(
        picture(type).then((image) => {
          const plain = canvasOf(frontPixels(type, image), null);
          for (const [state, look] of FRESH_STATES) {
              const key = this.freshKey(state, type);
              if (this.textures.exists(key)) continue;
              const canvas = freshCanvas(plain, plain.width, look);
              const context = canvas.getContext('2d', { willReadFrequently: true })!;
              const pixels = see(context.getImageData(0, 0, canvas.width, canvas.height).data);
              context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height), 0, 0);
              this.textures.addImage(key, canvas as unknown as HTMLImageElement);
            }
        }),
      );
    await Promise.all(jobs);
    this.ready = true;
    if (run === this.drawing) this.redraw();
  }

  private freshKey(state: string, type: string): string {
    return `gallery:${this.vision}:fresh:${state}:${type}`;
  }

  /**
   * Fresh foods' countdown: a shelf per size with one food fresh, in its last moves (as it swells) and spoiled.
   * Returns the bottom.
   */
  private drawFresh(top: number, width: number): number {
    this.content.add(this.label(PAD, top, t('gallery.fresh'), 20, SKIN.text.accent));
    let y = top + 34;
    const s = SIZES[SIZES.length - 1]! / ITEM_FILL;
    const blockW = LABEL_W + shelfLayoutAt(0, 0, s).rect.width;
    const columns = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (blockW + GAP)));
    let rowBottom = y;
    FRESH_SAMPLES.forEach((type, i) => {
        const col = i % columns;
        if (col === 0) y = rowBottom;
        const x = PAD + col * (blockW + GAP);
        this.content.add(this.label(x, y, ITEM_KINDS.find((k) => k.id === type)!.name[getLocale()], 15, SKIN.text.primary));
        let sy = y + 22;
        for (const px of SIZES) {
          const ss = px / ITEM_FILL;
          const shelf = shelfLayoutAt(x + LABEL_W, sy, ss);
          this.content.add(placeShelf(this.add.image(0, 0, SHELF_TEXTURE), shelf, ss).setTexture(this.keys.shelf));
          this.content.add(this.label(x, shelf.slots[0]!.y - 8, t('gallery.px', { n: px }), 12, SKIN.text.primary));
          FRESH_STATES.forEach(([state], j) => {
            const slot = shelf.slots[j]!;
            const at = placeItem(slot.y, ss, ITEM_FILL, typeFit(type, slotAspect()));
            this.content.add(this.add.image(Math.round(slot.x), Math.round(at.y), this.freshKey(state, type)).setDisplaySize(at.size, at.size));
          });
          sy = shelf.rect.y + shelf.rect.height + ss * 0.25;
        }
        rowBottom = Math.max(rowBottom, sy + GAP);
    });
    return rowBottom + GAP;
  }

  private redraw(): void {
    // A resize before the first vision is ready waits for it (it draws the page itself).
    if (!this.ready) return;
    fitCamera(this);
    const { width } = viewSize(this);
    this.drawHeader(false);
    this.content.removeAll(true);

    let y = this.drawFresh(PAD, width) + GAP;
    y = this.drawBoosters(y, width) + GAP;
    for (const section of this.sections()) {
      this.content.add(this.label(PAD, y, section.title, 20, SKIN.text.accent));
      y += 34;
      this.content.add(this.label(PAD, y, section.shelvesLabel, 14, SKIN.text.primary));
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
      this.content.add(placeShelf(this.add.image(0, 0, SHELF_TEXTURE), shelf, s).setTexture(this.keys.shelf));
      group.forEach((type, slot) => {
        const at = shelf.slots[slot]!;
        if (type === 'blocker') {
          this.content.add(makeBlocker(this, s, this.keys).setPosition(at.x, at.y));
        } else if (type === 'locked') {
          const veil = makeLockVeil(this, shelf.rect.width, shelf.rect.height, s, this.keys).setPosition(shelf.rect.x + shelf.rect.width / 2, shelf.rect.y + shelf.rect.height / 2);
          this.content.add(veil);
          this.content.add(
            this.label(veil.x - s * 0.12, veil.y, t('shelf.locked', { n: 2 }), Math.round(s * 0.3), SKIN.text.primary).setOrigin(0, 0.5),
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
    this.content.add(this.label(x, top, kind.name[getLocale()], 15, SKIN.text.primary));
    let y = top + 22;
    for (const px of SIZES) {
      const s = px / ITEM_FILL;
      const shelf = shelfLayoutAt(x + LABEL_W, y, s);
      this.content.add(placeShelf(this.add.image(0, 0, SHELF_TEXTURE), shelf, s).setTexture(this.keys.shelf));
      this.content.add(this.label(x, shelf.slots[0]!.y - 8, t('gallery.px', { n: px }), 12, SKIN.text.primary));
      VARIANTS.forEach((variant, i) => {
        const slot = shelf.slots[i]!;
        this.content.add(this.icon(itemTypeId(kind.id, variant), px, slot.x, slot.y));
      });
      y = shelf.rect.y + shelf.rect.height + s * 0.25;
    }
    return y;
  }

  /** An item in a slot whose square-item centre is (x, slotY), `px` its plain size: resting on the base, as in a level. */
  private icon(type: string, px: number, x: number, slotY: number): Phaser.GameObjects.Image {
    const at = placeItem(slotY, px / ITEM_FILL, ITEM_FILL, typeFit(type, slotAspect()));
    return this.add.image(Math.round(x), Math.round(at.y), this.textureKey(type)).setDisplaySize(at.size, at.size);
  }

  private label(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, { fontFamily: FONTS.text, fontStyle: 'bold', fontSize: `${size}px`, color })
      .setResolution(RENDER_RATIO);
  }

  /** Title and vision buttons, wrapping onto more rows on narrow screens. */
  private drawHeader(loading: boolean): void {
    const { width } = viewSize(this);
    this.header.removeAll(true);
    const background = this.add.rectangle(0, 0, width, 1, 0x2e1b0d).setOrigin(0);
    this.header.add(background);
    this.header.add(this.label(PAD, 12, loading ? t('gallery.loading') : t('gallery.title'), 20, SKIN.text.accent));
    let x = PAD;
    let y = 48;
    const marksLabel = t('settings.colorBlind', { state: t(this.marks ? 'settings.on' : 'settings.off') });
    for (const vision of [...VISIONS, 'marks' as const]) {
      const active = vision === this.vision || (vision === 'marks' && this.marks);
      const button = this.add
        .text(0, 0, vision === 'marks' ? marksLabel : t(`gallery.vision.${vision}` as MessageKey), {
          fontFamily: FONTS.text,
          fontStyle: 'bold',
          fontSize: '14px',
          color: SKIN.text.primary,
          backgroundColor: active ? SKIN.fills.primary.face : SKIN.surface.fill,
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
