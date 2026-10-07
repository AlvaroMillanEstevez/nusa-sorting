import * as Phaser from 'phaser';
import { isSpecialLevel } from '../core';
import { playList } from './playList';
import { t } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { clampScroll, computeLevelGrid, scrollToShow, tileAt, type LevelGrid } from '../ui/levelGrid';
import { hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import { themeLook } from '../ui/themeLook';
import { roundRect, softShadow, strokeRoundRect, woodGrain } from './kit/draw';
import { KitIconButton, KitPill, KitStars, kitText, uiIcon } from './kit';
import { fitCamera, pointerAt, screenRect, viewSize } from './view';

/** Passed by the game when it opens the list. */
export interface LevelSelectData {
  /** Level being played, highlighted and scrolled into view. */
  readonly currentIndex: number;
  readonly onChoose: (index: number) => void;
  /** The player went back without choosing a level. */
  readonly onClose: () => void;
}

/** Pointer travel (px) after which a press is a scroll, not a tap. */
const TAP_SLOP = 10;
const TILE_LIP = 4;

/**
 * Full-screen list of levels over the paused game: wooden tiles with each level's number and the most stars
 * earned in it (locked levels show a padlock), and the total of stars in the header. Scrolls by dragging or with
 * the mouse wheel when there are more levels than fit.
 */
export class LevelSelectScene extends Phaser.Scene {
  private data_!: LevelSelectData;
  private grid!: LevelGrid;
  private scroll = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;

  private content!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private tiles: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly sfx: SoundService,
    private readonly store: ProgressStore,
  ) {
    super('LevelSelect');
  }

  init(data: LevelSelectData): void {
    this.data_ = data;
    this.scroll = 0;
    this.press = null;
  }

  create(): void {
    this.background = this.add.graphics();
    this.content = this.add.container(0, 0);
    // The header is opaque and drawn above the content, which scrolls underneath it.
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
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const press = this.press;
      this.press = null;
      if (!press || press.moved) return;
      const at = pointerAt(pointer);
      const index = tileAt(this.grid, at.x, at.y, this.scroll);
      if (index !== null) this.choose(index);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.setScroll(this.scroll + dy),
    );
    this.input.keyboard?.on('keydown-ESC', () => this.close(() => this.data_.onClose()));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this));

    this.relayout();
    this.setScroll(scrollToShow(this.grid, this.data_.currentIndex));
  }

  private relayout(): void {
    fitCamera(this);
    const { width, height } = viewSize(this);
    const screen = screenRect(this);
    this.grid = computeLevelGrid(width, height, playList.length);
    const [top, bottom] = SKIN.backdrop.map(hexNumber) as [number, number];
    this.background.clear().fillGradientStyle(top, top, bottom, bottom, 1).fillRect(screen.x, screen.y, screen.width, screen.height);
    this.buildHeader(width, screen);
    this.buildTiles();
    this.setScroll(this.scroll);
  }

  /** A wooden board across the top (under the notch too): back, the title and the stars earned so far. */
  private buildHeader(width: number, screen: { x: number; y: number; width: number }): void {
    this.header.removeAll(true);
    const h = this.grid.header.height;
    const g = this.add.graphics();
    const top = screen.y;
    g.fillStyle(hexNumber(SKIN.surface.border), 1).fillRect(screen.x, top, screen.width, h - top + 4);
    g.fillStyle(hexNumber(SKIN.surface.fill), 1).fillRect(screen.x, top, screen.width, h - top);
    woodGrain(g, screen.x, top, screen.width, h - top, 6, SKIN.surface.grain ?? SKIN.surface.border, 7);
    g.fillStyle(hexNumber(SKIN.surface.highlight), 0.5).fillRect(screen.x, h - 3, screen.width, 2);
    this.header.add(g);
    const cy = h / 2;
    const back = new KitIconButton(this, SPACE.s + 22, cy, { skin: SKIN, icon: 'back', onPress: () => this.close(() => this.data_.onClose()) });
    const total = playList.length * 3;
    const stars = new KitPill(this, 0, cy, { skin: SKIN, icon: 'starFilled', value: `${this.store.totalStars}/${total}`, tint: SKIN.star.filled, height: 36 });
    stars.setX(width - SPACE.s - stars.pillWidth / 2);
    const title = kitText(this, 'title', t('levels.title'), SKIN.text.primary, Math.min(28, h * 0.42)).setPosition(width / 2, cy);
    // The title moves aside (and shrinks) if a translation would run into the stars.
    const room = stars.x - stars.pillWidth / 2 - (back.x + 22) - SPACE.s * 2;
    if (title.width > room) title.setScale(Math.max(0.7, room / title.width));
    title.setX(back.x + 22 + SPACE.s + room / 2);
    this.header.add([back, title, stars]);
  }

  private buildTiles(): void {
    for (const tile of this.tiles) tile.destroy();
    const ids = playList.map((entry) => entry.level.id);
    this.tiles = this.grid.tiles.map((rect, index) => {
      const entry = playList[index]!;
      const unlocked = this.store.isUnlocked(ids, index);
      const stars = this.store.bestStars(entry.level.id) ?? 0;
      const size = rect.width;
      const current = index === this.data_.currentIndex;
      const parts: Phaser.GameObjects.GameObject[] = [];

      // A small wooden board on its darker lip; a locked one is sunk and dark.
      const g = this.add.graphics();
      const r = size * 0.16;
      if (unlocked) softShadow(g, 0, TILE_LIP, size, size - TILE_LIP, r, SKIN.elevation.low);
      g.fillStyle(hexNumber(SKIN.surface.border), 1);
      roundRect(g, 0, TILE_LIP, size, size - TILE_LIP, r);
      g.fillStyle(hexNumber(unlocked ? SKIN.surface.fill : SKIN.well), 1);
      roundRect(g, 0, 0, size, size - TILE_LIP, r);
      if (unlocked) {
        woodGrain(g, 0, 0, size, size - TILE_LIP, r * 0.6, SKIN.surface.grain ?? SKIN.surface.border, index + 1);
        g.fillStyle(hexNumber(SKIN.surface.highlight), 0.55);
        roundRect(g, r * 0.5, 2, size - r, 3, 1.5);
      }
      // The level being played: a thick light frame.
      if (current) {
        g.lineStyle(3, hexNumber(SKIN.status.combo), 1);
        strokeRoundRect(g, -2, -2, size + 4, size + 4 - TILE_LIP, r + 2);
      }
      parts.push(g);

      const faceH = size - TILE_LIP;
      if (unlocked) {
        parts.push(kitText(this, 'title', String(entry.number), SKIN.text.primary, Math.round(size * 0.36)).setPosition(size / 2, faceH * 0.4));
        parts.push(new KitStars(this, size / 2, faceH * 0.78, SKIN, size * 0.2, false).setStars(stars));
      } else {
        parts.push(uiIcon(this, 'lock', SKIN.text.secondary, size * 0.32).setPosition(size / 2, faceH * 0.42));
        parts.push(kitText(this, 'caption', String(entry.number), SKIN.text.secondary).setPosition(size / 2, faceH * 0.78));
      }
      // A special level: a badge in its theme's colour with a star in the corner.
      if (isSpecialLevel(entry.level)) {
        const accent = themeLook(entry.level.theme)?.accent ?? SKIN.text.accent;
        const badge = this.add.graphics();
        const br = size * 0.15;
        badge.fillStyle(hexNumber(SKIN.surface.border), 1).fillCircle(size - br * 0.7, br * 0.7, br + 2);
        badge.fillStyle(hexNumber(accent), 1).fillCircle(size - br * 0.7, br * 0.7, br);
        parts.push(badge, uiIcon(this, 'starFilled', SKIN.surface.border, br * 1.3).setPosition(size - br * 0.7, br * 0.7));
      }
      const tile = this.add.container(rect.x, rect.y, parts);
      this.content.add(tile);
      return tile;
    });
  }

  private setScroll(scroll: number): void {
    this.scroll = clampScroll(this.grid, scroll);
    this.content.setY(this.grid.header.height - this.scroll);
  }

  private choose(index: number): void {
    const ids = playList.map((entry) => entry.level.id);
    if (!this.store.isUnlocked(ids, index)) {
      this.sfx.play('invalid');
      const tile = this.tiles[index];
      if (tile) {
        const x = tile.x;
        this.tweens.add({ targets: tile, x: x + 6, duration: 50, yoyo: true, repeat: 2, onComplete: () => tile.setX(x) });
      }
      return;
    }
    this.sfx.play('pick');
    this.close(() => this.data_.onChoose(index));
  }

  /** Stops this scene first so the game is resumed with the list gone. */
  private close(then: () => void): void {
    this.scene.stop();
    then();
  }
}
