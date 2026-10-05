import * as Phaser from 'phaser';
import { isCompleted } from '../core';
import { playList } from './playList';
import { t } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { clampScroll, computeLevelGrid, scrollToShow, tileAt, type LevelGrid } from '../ui/levelGrid';
import { theme } from '../ui/theme';
import { fitCamera, pointerAt, RENDER_RATIO, viewSize } from './view';

/** Passed by the game when it opens the list. */
export interface LevelSelectData {
  /** Level being played, highlighted and scrolled into view. */
  readonly currentIndex: number;
  readonly onChoose: (index: number) => void;
  readonly onClose: () => void;
  /** The colour-blind mode setting was switched (it is already saved). */
  readonly onColorBlindModeChanged: () => void;
}

/** Pointer travel (px) after which a press is a scroll, not a tap. */
const TAP_SLOP = 10;

/**
 * Full-screen list of levels over the paused game: locked, open and completed levels with their best score.
 * Scrolls by dragging or with the mouse wheel when there are more levels than fit.
 */
export class LevelSelectScene extends Phaser.Scene {
  private data_!: LevelSelectData;
  private grid!: LevelGrid;
  private scroll = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;

  private content!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private headerBar!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Text;
  private colorBlindButton!: Phaser.GameObjects.Text;
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
    const resolution = RENDER_RATIO;
    const style = { fontFamily: theme.fontFamily, fontStyle: 'bold' };
    this.background = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.HexStringToColor(theme.background).color).setOrigin(0);
    this.content = this.add.container(0, 0);
    // The header is opaque and drawn above the content, which scrolls underneath it.
    this.headerBar = this.add.rectangle(0, 0, 1, 1, theme.panelColor).setOrigin(0).setDepth(10);
    this.title = this.add
      .text(0, 0, t('levels.title'), { ...style, color: theme.titleColor })
      .setOrigin(0, 0.5)
      .setResolution(resolution)
      .setDepth(11);
    this.backButton = this.add
      .text(0, 0, t('levels.back'), { ...style, color: theme.textColor, backgroundColor: theme.buttonColor })
      .setOrigin(1, 0.5)
      .setResolution(resolution)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.backButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.close(() => this.data_.onClose()));
    // Colour-blind mode: variants of an item also get a mark that does not rely on colour.
    this.colorBlindButton = this.add
      .text(0, 0, '', { ...style, color: theme.textColor, backgroundColor: theme.buttonColor })
      .setOrigin(1, 0.5)
      .setResolution(resolution)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.colorBlindButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.store.setColorBlindMode(!this.store.colorBlindMode);
      this.sfx.play('pick');
      this.data_.onColorBlindModeChanged();
      this.relayout();
    });

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

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this));

    this.relayout();
    this.setScroll(scrollToShow(this.grid, this.data_.currentIndex));
  }

  private relayout(): void {
    fitCamera(this);
    const { width, height } = viewSize(this);
    this.grid = computeLevelGrid(width, height, playList.length);
    const { header } = this.grid;
    this.background.setSize(width, height);
    this.headerBar.setSize(width, header.height);
    this.title.setFontSize(Math.round(header.height * 0.4)).setPosition(16, header.height / 2);
    const pad = Math.round(header.height * 0.18);
    this.backButton
      .setFontSize(Math.round(header.height * 0.3))
      .setPadding(pad * 1.4, pad, pad * 1.4, pad)
      .setPosition(width - 12, header.height / 2);
    const state = t(this.store.colorBlindMode ? 'settings.on' : 'settings.off');
    // As tall as the back button (a comfortable finger target); on narrow screens its text gets smaller to fit
    // between the title and the back button.
    const fontSize = Math.round(header.height * 0.24);
    const side = pad * 0.8;
    this.colorBlindButton
      .setText(t('settings.colorBlind', { state }))
      .setFontSize(fontSize)
      .setPadding(side, 0, side, 0)
      .setPosition(this.backButton.x - this.backButton.width - 8, header.height / 2);
    const room = this.colorBlindButton.x - (this.title.x + this.title.width + 8);
    if (this.colorBlindButton.width > room) {
      this.colorBlindButton.setFontSize(Math.max(10, Math.floor((fontSize * (room - side * 2)) / (this.colorBlindButton.width - side * 2))));
    }
    const vertical = Math.max(0, (this.backButton.height - this.colorBlindButton.height) / 2);
    this.colorBlindButton.setPadding(side, vertical, side, vertical);
    this.buildTiles();
    this.setScroll(this.scroll);
  }

  private buildTiles(): void {
    for (const tile of this.tiles) tile.destroy();
    const ids = playList.map((entry) => entry.level.id);
    const resolution = RENDER_RATIO;
    this.tiles = this.grid.tiles.map((rect, index) => {
      const id = ids[index]!;
      const unlocked = this.store.isUnlocked(ids, index);
      const done = isCompleted(this.store.progress, id);
      const best = this.store.bestScore(id);
      const size = rect.width;

      const g = this.add.graphics();
      g.fillStyle(unlocked ? theme.shelfBack : theme.lockVeil, 1).fillRoundedRect(0, 0, size, size, size * 0.14);
      if (index === this.data_.currentIndex) {
        g.lineStyle(Math.max(3, size * 0.04), Phaser.Display.Color.HexStringToColor(theme.comboColor).color, 1);
        g.strokeRoundedRect(0, 0, size, size, size * 0.14);
      }
      if (done) drawCheck(g, size * 0.8, size * 0.2, size * 0.13);
      const parts: Phaser.GameObjects.GameObject[] = [g];

      const number = this.add
        .text(size / 2, best !== null ? size * 0.42 : size / 2, String(playList[index]!.number), {
          fontFamily: theme.fontFamily,
          fontStyle: 'bold',
          color: unlocked ? theme.textColor : '#55677a',
        })
        .setOrigin(0.5)
        .setResolution(resolution)
        .setFontSize(Math.round(size * 0.36));
      parts.push(number);
      if (!unlocked) drawPadlock(g, size * 0.8, size * 0.8, size * 0.22);
      if (best !== null) {
        const label = this.add
          .text(size / 2, size * 0.76, t('levels.best', { score: best }), {
            fontFamily: theme.fontFamily,
            fontStyle: 'bold',
            color: theme.comboColor,
          })
          .setOrigin(0.5)
          .setResolution(resolution)
          .setFontSize(Math.round(size * 0.13));
        // Long scores or translations shrink to fit the tile.
        if (label.width > size * 0.9) label.setScale((size * 0.9) / label.width);
        parts.push(label);
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

function drawCheck(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(0x30a46c, 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(2, r * 0.3), 0xffffff, 1);
  g.beginPath();
  g.moveTo(x - r * 0.45, y);
  g.lineTo(x - r * 0.1, y + r * 0.35);
  g.lineTo(x + r * 0.5, y - r * 0.35);
  g.strokePath();
}

function drawPadlock(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  g.lineStyle(Math.max(2, size * 0.14), 0x55677a, 1);
  g.beginPath();
  g.arc(x, y - size * 0.15, size * 0.28, Math.PI, 0);
  g.strokePath();
  g.fillStyle(0x55677a, 1).fillRoundedRect(x - size * 0.42, y - size * 0.15, size * 0.84, size * 0.62, size * 0.1);
}
