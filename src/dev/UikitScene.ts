import * as Phaser from 'phaser';
import { createGame } from '../core';
import { getLocale, t, type MessageKey } from '../i18n';
import { loadShelfArt, placeShelf, SHELF_TEXTURE } from '../scenes/art/shelfArt';
import { itemTextureKey, prepareItemTextures } from '../scenes/itemTextures';
import {
  KitButton,
  KitIconButton,
  KitPanel,
  KitPill,
  KitProgressBar,
  KitToggle,
  kitText,
  loadUiFonts,
  uiIcon,
  type ButtonVariant,
} from '../scenes/kit';
import { playList } from '../scenes/playList';
import { fitCamera, pointerAt, viewSize } from '../scenes/view';
import { setSlotAspect, shelfLayoutAt, SLOT_ASPECT } from '../ui/boardLayout';
import { hexNumber, mapSkin, SKIN, SPACE, TYPE, type Skin, type TypeRole } from '../ui/design/tokens';
import { UI_ICON_NAMES } from '../ui/design/uiIcons';
import { simulateVision, type Vision } from '../ui/icons/color';
import { itemFit, placeItem } from '../ui/itemFit';
import { ITEM_FILL, itemSize, layoutForLevel } from '../ui/levelLayout';

/**
 * Development only (`?uikit`): the interface kit. Every component in its states, the interface icons, and the
 * slot shapes. The game's own screens are the reference for the HUD and panels (`?show=` opens them).
 */

type Page = 'components' | 'icons' | 'slots';
const PAGES: readonly Page[] = ['components', 'icons', 'slots'];
const VISIONS: readonly Vision[] = ['normal', 'deuteranopia', 'protanopia', 'grayscale'];
const FRAMES: readonly (readonly [number, number])[] = [
  [390, 844],
  [844, 390],
];
/** Kinds on the tall-slot shelves: tall ones (glass, kite, balloon, lantern) next to low and floating ones. */
const SLOT_SAMPLE = ['es-teh-manis', 'layangan', 'balon', 'lampion', 'sate', 'peci', 'kendang', 'rambutan', 'bakso'];
const PAD = SPACE.s;
const TAP_SLOP = 10;

export class UikitScene extends Phaser.Scene {
  private page: Page = 'components';
  private vision: Vision = 'normal';
  private ready = false;
  private header!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Graphics;
  private headerHeight = 0;
  private contentHeight = 0;
  private scroll = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;

  constructor() {
    super('Uikit');
  }

  create(): void {
    // ?uikit=hud&dir=b&vision=grayscale opens a page directly.
    const params = new URLSearchParams(window.location.search);
    const page = params.get('uikit') as Page;
    if (PAGES.includes(page)) this.page = page;
    const vision = params.get('vision') as Vision;
    if (VISIONS.includes(vision)) this.vision = vision;
    fitCamera(this);
    this.backdrop = this.add.graphics();
    this.content = this.add.container(0, 0);
    this.header = this.add.container(0, 0).setDepth(10);
    const { width } = viewSize(this);
    this.header.add(kitText(this, 'title', t('uikit.loading'), SKIN.text.primary).setPosition(width / 2, 60));

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
    this.scale.on(Phaser.Scale.Events.RESIZE, this.rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.rebuild, this));

    void this.prepare();
  }

  /** Fonts, the board's item textures and the item icons in both styles at the sizes shown. */
  private async prepare(): Promise<void> {
    const jobs: Promise<void>[] = [loadUiFonts(), prepareItemTextures(this), loadShelfArt(this.textures)];
    await Promise.all(jobs);
    this.ready = true;
    this.rebuild();
  }

  /** The game's skin, seen through the chosen colour vision. */
  private skin(): Skin {
    return this.vision === 'normal' ? SKIN : mapSkin(SKIN, (hex) => simulateVision(hex, this.vision));
  }

  private rebuild(): void {
    if (!this.ready) return;
    fitCamera(this);
    this.tweens.killAll();
    this.header.removeAll(true);
    this.content.removeAll(true);
    const { width, height } = viewSize(this);
    const skin = this.skin();
    const [top, bottom] = skin.backdrop;
    this.backdrop.clear().fillGradientStyle(hexNumber(top), hexNumber(top), hexNumber(bottom), hexNumber(bottom), 1).fillRect(0, 0, width, height);
    this.buildHeader(width, skin);
    const builders: Record<Page, (w: number, s: Skin) => number> = {
      components: (w, s) => this.buildComponents(w, s),
      icons: (w, s) => this.buildIcons(w, s),
      slots: (w, s) => this.buildSlots(w, s),
    };
    this.contentHeight = builders[this.page](width, skin) + SPACE.xl;
    this.setScroll(this.scroll);
  }

  // ---------------------------------------------------------------- header

  private buildHeader(width: number, skin: Skin): void {
    const bar = this.add.graphics();
    this.header.add(bar);
    let x = PAD;
    let y = PAD + 40;
    const rowH = 44;
    const place = (w: number) => {
      if (x > PAD && x + w > width - PAD) {
        x = PAD;
        y += rowH + SPACE.xs;
      }
      const at = x;
      x += w + SPACE.xs;
      return at;
    };
    const choice = (label: string, active: boolean, onPress: () => void) => {
      const button = new KitButton(this, 0, 0, { skin, variant: active ? 'primary' : 'secondary', label, height: rowH - skin.lip, onPress });
      const w = button.width;
      button.setPosition(place(w) + w / 2, y);
      this.header.add(button);
    };
    const title = kitText(this, 'label', t('uikit.title').toUpperCase(), skin.text.secondary).setOrigin(0, 0.5).setPosition(PAD, PAD + 2);
    this.header.add(title);
    y += 4;
    for (const page of PAGES) choice(t(`uikit.page.${page}` as MessageKey), this.page === page, () => this.set({ page, scroll: 0 }));
    x = width;
    for (const vision of VISIONS) choice(t(`gallery.vision.${vision}` as MessageKey), this.vision === vision, () => this.set({ vision }));
    this.headerHeight = y + rowH / 2 + SPACE.xs;
    bar.fillStyle(hexNumber(skin.backdrop[0]), 0.96).fillRect(0, 0, width, this.headerHeight);
    bar.fillStyle(0x000000, 0.25).fillRect(0, this.headerHeight, width, 3);
  }

  private set(change: { page?: Page; vision?: Vision; scroll?: number }): void {
    if (change.page) this.page = change.page;
    if (change.vision) this.vision = change.vision;
    if (change.scroll !== undefined) this.scroll = change.scroll;
    // Rebuild after the press that asked for it has finished.
    this.time.delayedCall(0, () => this.rebuild());
  }

  private setScroll(scroll: number): void {
    const visible = viewSize(this).height - this.headerHeight;
    this.scroll = Math.max(0, Math.min(scroll, this.contentHeight - visible));
    this.content.setY(this.headerHeight - this.scroll);
  }

  // ---------------------------------------------------------------- components

  /** Places things left to right, wrapping, with captions; returns where the next row starts. */
  private flow(width: number, startY: number) {
    let x = PAD;
    let y = startY;
    let rowH = 0;
    const api = {
      section: (title: string) => {
        api.newline();
        y += SPACE.s;
        this.content.add(kitText(this, 'title', title, this.skin().text.primary, 22).setOrigin(0, 0.5).setPosition(PAD, y + 14));
        y += 28 + SPACE.s;
      },
      /** Adds a thing `w` × `h` (built centred on the point given) with an optional caption under it. */
      add: (w: number, h: number, build: (cx: number, cy: number) => void, caption?: string) => {
        const total = h + (caption ? 22 : 0);
        if (x > PAD && x + w > width - PAD) api.newline();
        build(x + w / 2, y + h / 2);
        if (caption) this.content.add(kitText(this, 'caption', caption, this.skin().text.secondary).setPosition(x + w / 2, y + h + 12));
        x += w + SPACE.m;
        rowH = Math.max(rowH, total);
      },
      newline: () => {
        if (rowH > 0) y += rowH + SPACE.m;
        x = PAD;
        rowH = 0;
      },
      end: () => {
        api.newline();
        return y;
      },
    };
    return api;
  }

  private buildComponents(width: number, skin: Skin): number {
    const f = this.flow(width, SPACE.s);
    const states = ['normal', 'pressed', 'disabled'] as const;
    const caption = (state: (typeof states)[number]) => t(`uikit.state.${state}`);
    const style = (button: KitButton | KitIconButton, state: (typeof states)[number]) => {
      if (state === 'pressed') button.setPressed(true);
      if (state === 'disabled') button.setDisabled(true);
    };

    f.section(t('uikit.section.buttons'));
    const labels: Record<ButtonVariant, string> = {
      primary: t('uikit.button.play'),
      secondary: t('result.levels'),
      positive: t('uikit.button.confirm'),
      danger: t('result.retry'),
    };
    const icons = { primary: 'play', secondary: 'levels', positive: 'check', danger: 'restart' } as const;
    for (const variant of ['primary', 'secondary', 'positive', 'danger'] as const) {
      for (const state of states) {
        f.add(176, 64, (cx, cy) => {
          const button = new KitButton(this, cx, cy, { skin, variant, label: labels[variant], icon: icons[variant], width: 168 });
          style(button, state);
          this.content.add(button);
        }, caption(state));
      }
      f.newline();
    }

    f.section(t('uikit.section.iconButtons'));
    for (const look of ['chip', 'primary', 'secondary'] as const) {
      for (const [icon, state] of [
        ['levels', 'normal'],
        ['sound', 'normal'],
        ['restart', 'pressed'],
        ['settings', 'disabled'],
      ] as const) {
        f.add(56, 60, (cx, cy) => {
          const button = new KitIconButton(this, cx, cy, { skin, icon: look === 'primary' ? 'play' : look === 'secondary' ? 'close' : icon, look, size: 48 });
          style(button, state);
          this.content.add(button);
        }, caption(state));
      }
      f.newline();
    }

    f.section(t('uikit.section.pills'));
    const pill = (make: (cx: number, cy: number) => KitPill, captionText: string, w = 150) =>
      f.add(w, 44, (cx, cy) => this.content.add(make(cx, cy)), captionText);
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, label: t('uikit.label.level'), value: '12' }), t('uikit.label.level'));
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, icon: 'clock', value: '2:05', width: 112 }), caption('normal'), 120);
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, icon: 'clock', value: '0:24', width: 112 }).setAlert('low'), t('uikit.state.low'), 120);
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, icon: 'clock', value: '0:07', width: 112 }).setAlert('critical'), t('uikit.state.critical'), 120);
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, icon: 'star', value: '12 450' }), t('uikit.label.score'));
    pill((cx, cy) => new KitPill(this, cx, cy, { skin, icon: 'combo', value: '×3', tint: skin.status.combo, width: 96 }).setProgress(0.6), 'Combo', 110);

    f.section(t('uikit.section.toggles'));
    for (const [label, on] of [
      [t('uikit.toggle.sound'), true],
      [t('uikit.toggle.colorBlind'), false],
    ] as const) {
      f.add(260, 44, (cx, cy) => {
        this.content.add(kitText(this, 'body', label, skin.text.primary).setOrigin(0, 0.5).setPosition(cx - 130, cy));
        this.content.add(new KitToggle(this, cx + 100, cy, skin, on));
      }, on ? t('settings.on') : t('settings.off'));
    }

    f.section(t('uikit.section.progress'));
    for (const share of [0.2, 0.65, 1]) {
      f.add(260, 24, (cx, cy) => this.content.add(new KitProgressBar(this, cx - 24, cy, skin, 200, (s) => `${Math.round(s * 5)}/5`).setProgress(share)));
    }

    f.section(t('uikit.section.panel'));
    const panelW = Math.min(360, width - PAD * 2);
    f.add(panelW, 250, (cx, cy) => {
      const panel = new KitPanel(this, cx, cy, { skin, width: panelW, height: 236, title: t('uikit.panel.title') });
      const body = kitText(this, 'body', t('uikit.panel.body'), skin.text.secondary).setY(panel.contentTop + 22);
      body.setWordWrapWidth(panelW - SPACE.l * 2);
      panel.add(body);
      panel.add(new KitToggle(this, panelW / 2 - SPACE.l - 30, panel.contentTop + 76, skin, true));
      panel.add(kitText(this, 'body', t('uikit.toggle.sound'), skin.text.primary).setOrigin(0, 0.5).setPosition(-panelW / 2 + SPACE.l, panel.contentTop + 76));
      panel.add(new KitButton(this, 0, 118 - 30, { skin, variant: 'primary', label: t('levels.back'), icon: 'back', width: panelW - SPACE.l * 2 }));
      panel.add(new KitIconButton(this, panelW / 2 - 30, -118 + 30, { skin, icon: 'close', size: 44 }));
      this.content.add(panel);
    });

    f.section(t('uikit.section.type'));
    for (const role of Object.keys(TYPE) as TypeRole[]) {
      const style = TYPE[role];
      const sample = role === 'number' ? '1:58  12 450' : role === 'hero' || role === 'title' ? t('result.won.title') : t('uikit.sample');
      const text = kitText(this, role, sample, skin.text.primary).setOrigin(0, 0.5);
      text.setWordWrapWidth(width - PAD * 2);
      f.add(Math.min(width - PAD * 2, Math.max(text.width, 200)), text.height + 4, (cx, cy) => {
        text.setPosition(cx - Math.min(width - PAD * 2, Math.max(text.width, 200)) / 2, cy);
        this.content.add(text);
      }, `${role} · ${style.font === 'display' ? 'Fredoka' : 'Plus Jakarta Sans'} ${style.weight} · ${style.size}px`);
      f.newline();
    }
    return f.end();
  }

  // ---------------------------------------------------------------- icons

  private buildIcons(width: number, skin: Skin): number {
    const f = this.flow(width, SPACE.s);
    f.section(t('uikit.icons.ui'));
    for (const px of [24, 32, 48]) {
      for (const name of UI_ICON_NAMES) f.add(px, px, (cx, cy) => this.content.add(uiIcon(this, name, skin.text.primary, px).setPosition(cx, cy)), px === 48 ? name : undefined);
      f.newline();
    }
    for (const name of UI_ICON_NAMES) {
      f.add(48, 48, (cx, cy) => this.content.add(new KitIconButton(this, cx, cy, { skin, icon: name, look: 'primary', size: 44 })));
    }
    return f.end();
  }

  // ---------------------------------------------------------------- tall slots

  private buildSlots(width: number, skin: Skin): number {
    const f = this.flow(width, SPACE.s);
    const intro = kitText(this, 'body', t('uikit.slots.intro'), skin.text.secondary).setOrigin(0, 0.5);
    intro.setWordWrapWidth(width - PAD * 2);
    f.add(width - PAD * 2, intro.height, (cx, cy) => this.content.add(intro.setPosition(cx - (width - PAD * 2) / 2, cy)));
    for (const aspect of [1, 1.2]) {
      f.section(t('uikit.slots.aspect', { ratio: aspect.toLocaleString(getLocale() === 'id' ? 'id-ID' : 'en-US') }));
      setSlotAspect(aspect);
      const s = 56 / ITEM_FILL;
      const sample = shelfLayoutAt(0, 0, s);
      for (let i = 0; i < SLOT_SAMPLE.length; i += 3) {
        const kinds = SLOT_SAMPLE.slice(i, i + 3);
        const placedAspect = aspect;
        f.add(sample.rect.width, sample.rect.height + s * 0.15, (cx, cy) => {
          setSlotAspect(placedAspect);
          const shelf = shelfLayoutAt(cx - sample.rect.width / 2, cy - sample.rect.height / 2, s);
          this.content.add(placeShelf(this.add.image(0, 0, SHELF_TEXTURE), shelf, s));
          kinds.forEach((kind, j) => {
            const slot = shelf.slots[j]!;
            const fit = itemFit(kind, placedAspect);
            const at = placeItem(slot.y, s, ITEM_FILL, fit);
            this.content.add(this.add.image(slot.x, at.y, itemTextureKey(kind, false)).setDisplaySize(at.size, at.size));
          });
        });
      }
      f.newline();
    }
    setSlotAspect(SLOT_ASPECT);
    // Item sizes in the three-column levels, square and 1.2 tall.
    for (const [w, h] of FRAMES) {
      const sizes = (aspect: number) => {
        setSlotAspect(aspect);
        const px = playList
          .filter(({ level }) => (level.layout?.columns.length ?? 0) === 3)
          .map(({ level }) => itemSize(layoutForLevel(level, createGame(level), w, h)));
        setSlotAspect(SLOT_ASPECT);
        return `${Math.min(...px).toFixed(1)}–${Math.max(...px).toFixed(1)}`;
      };
      const line = `${t('uikit.slots.screen', { w, h })}: ${t('uikit.slots.sizes', { square: sizes(1), tall: sizes(1.2) })}`;
      const text = kitText(this, 'body', line, skin.text.primary).setOrigin(0, 0.5);
      text.setWordWrapWidth(width - PAD * 2);
      f.add(width - PAD * 2, text.height, (cx, cy) => this.content.add(text.setPosition(cx - (width - PAD * 2) / 2, cy)));
      f.newline();
    }
    return f.end();
  }
}
