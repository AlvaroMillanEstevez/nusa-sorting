import * as Phaser from 'phaser';
import type { ShelfMove } from '../core';
import { slotRect, type BoardLayout } from '../ui/boardLayout';
import { FONTS, hexNumber, SKIN, TYPE } from '../ui/design/tokens';
import { t } from '../i18n';
import { KitButton } from './kit';
import { addSvgTexture } from './svgTexture';
import { pixelRatio } from './view';

export const HAND_TEXTURE = 'tutorial:hand';
const HAND_TEXTURE_SIZE = 192;
/** The fingertip in the hand drawing (64 units), as a share of its size: it is placed on what it touches. */
const TIP = { x: 27 / 64, y: 5 / 64 };

/**
 * A cartoon hand pointing up. Every shape is stroked first and filled after, so the outline only shows around
 * the whole hand.
 */
const HAND_SHAPES = [
  '<rect x="22" y="5" width="10" height="34" rx="5"/>',
  '<rect x="31" y="23" width="8" height="15" rx="4"/>',
  '<rect x="38" y="25" width="8" height="15" rx="4"/>',
  '<rect x="10" y="32" width="15" height="9" rx="4.5" transform="rotate(35 17 36)"/>',
  '<rect x="18" y="27" width="29" height="29" rx="10"/>',
].join('');
const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<g fill="#3b2a1a" stroke="#3b2a1a" stroke-width="5" stroke-linejoin="round">${HAND_SHAPES}</g>
<g fill="#fff7ea">${HAND_SHAPES}</g>
<rect x="21" y="53" width="23" height="8" rx="2" fill="#d9822b" stroke="#3b2a1a" stroke-width="2.5"/>
</svg>`;

/** Rasterizes the hand once, before the game starts. */
export function prepareTutorialTextures(scene: Phaser.Scene): Promise<void> {
  return addSvgTexture(scene.textures, HAND_TEXTURE, HAND_SVG, HAND_TEXTURE_SIZE);
}

/** Over items, the drop outline and dragged items; under popups and panels. */
const DEPTH_MARKS = 104;
const DEPTH_GHOST = 106;
const DEPTH_HAND = 108;
const DEPTH_BANNER = 110;
/** The "Skip" button: height, and gap to the sign. */
const SKIP_H = 44;
const SKIP_GAP = 12;

/** One showing of the gesture: press on the item, drag it over, let go, pause. */
const CYCLE_MS = 2400;

export interface TutorialShow {
  readonly text: string;
  /** The move to show; null shows the text alone. */
  readonly move: ShelfMove | null;
  /** Texture of the item the move carries. */
  readonly itemTexture: string | null;
}

/**
 * The first-triple tutorial over the board: a short line of text, outlines on the item to move and on the slot
 * it goes to, and a hand dragging a faded copy of the item there, again and again. It takes no input: presses go
 * through to the board as usual.
 */
export class TutorialHint {
  private shown: TutorialShow | null = null;
  private board: BoardLayout | null = null;
  private itemScale = 1;
  private width = 0;
  private height = 0;

  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly hand: Phaser.GameObjects.Image;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  /** "Skip": ends the tutorial for good, for players who know the genre. */
  private readonly skip: KitButton;
  private readonly progress = { t: 0 };
  private loop: Phaser.Tweens.Tween | null = null;
  /** Hand and copy hide while the player is touching the board, so they do not get in the way. */
  private touching = false;

  constructor(
    private readonly scene: Phaser.Scene,
    onSkip: () => void,
  ) {
    this.marks = scene.add.graphics().setDepth(DEPTH_MARKS).setVisible(false);
    this.ghost = scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH_GHOST).setVisible(false);
    this.hand = scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH_HAND).setOrigin(TIP.x, TIP.y).setVisible(false);
    this.panel = scene.add.graphics().setDepth(DEPTH_BANNER).setVisible(false);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONTS.display, fontStyle: String(TYPE.button.weight), color: SKIN.text.primary, align: 'center' })
      .setOrigin(0.5)
      .setResolution(pixelRatio())
      .setDepth(DEPTH_BANNER + 1)
      .setVisible(false);
    this.skip = new KitButton(scene, 0, 0, { skin: SKIN, variant: 'secondary', label: t('tutorial.skip'), height: SKIP_H, onPress: onSkip });
    this.skip.setDepth(DEPTH_BANNER + 1).setVisible(false);
  }

  get visible(): boolean {
    return this.shown !== null;
  }

  /** Shows the tutorial, or updates what it points at after the board changed. */
  show(shown: TutorialShow): void {
    this.shown = shown;
    if (shown.itemTexture && this.scene.textures.exists(shown.itemTexture)) this.ghost.setTexture(shown.itemTexture);
    if (this.scene.textures.exists(HAND_TEXTURE)) this.hand.setTexture(HAND_TEXTURE);
    if (!this.loop) {
      this.progress.t = 0;
      this.loop = this.scene.tweens.add({
        targets: this.progress,
        t: 1,
        duration: CYCLE_MS,
        repeat: -1,
        onUpdate: () => this.animate(),
      });
    }
    this.draw();
  }

  /** Where the board is now and how big its items are drawn. */
  layout(width: number, height: number, board: BoardLayout, itemScale: number): void {
    this.width = width;
    this.height = height;
    this.board = board;
    this.itemScale = itemScale;
    this.draw();
  }

  setTouching(touching: boolean): void {
    this.touching = touching;
    this.animate();
  }

  /** Fades the tutorial out for good (when completed). */
  finish(): void {
    const parts = [this.marks, this.ghost, this.hand, this.panel, this.label, this.skip];
    this.stopLoop();
    this.shown = null;
    this.scene.tweens.add({
      targets: parts,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        // Shown again in the meantime (another level start): leave it.
        if (!this.shown) for (const part of parts) part.setVisible(false).setAlpha(1);
      },
    });
  }

  /** Hides it at once (another level starts). */
  clear(): void {
    this.stopLoop();
    this.shown = null;
    for (const part of [this.marks, this.ghost, this.hand, this.panel, this.label, this.skip]) {
      this.scene.tweens.killTweensOf(part);
      part.setVisible(false).setAlpha(1);
    }
  }

  private stopLoop(): void {
    this.loop?.remove();
    this.loop = null;
  }

  private slots(): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
    const move = this.shown?.move;
    const board = this.board;
    if (!move || !board) return null;
    const from = board.shelves[move.from.shelf]?.slots[move.from.slot];
    const to = board.shelves[move.to.shelf]?.slots[move.to.slot];
    return from && to ? { from, to } : null;
  }

  private draw(): void {
    const shown = this.shown;
    const board = this.board;
    if (!shown || !board) return;
    const s = board.slotSize;

    // Outlines on the item to move and on its destination.
    const g = this.marks.clear().setVisible(true).setAlpha(1);
    const slots = this.slots();
    const move = shown.move;
    if (slots && move) {
      const color = hexNumber(SKIN.status.combo);
      g.lineStyle(Math.max(3, s * 0.08), color, 1);
      // Each outline takes the whole slot, as tall as it is.
      for (const at of [move.from, move.to]) {
        const cell = slotRect(board.shelves[at.shelf]!, at.slot, s);
        const inset = s * 0.01;
        g.strokeRoundedRect(cell.x + inset, cell.y + inset, cell.width - inset * 2, cell.height - inset * 2, s * 0.16);
      }
    }

    // The text, with "Skip" beside it (or under it if the row does not fit): in the gap above the board if they
    // fit there, else below it, else at the screen edge farthest from the move.
    const fontSize = Math.round(Math.max(16, Math.min(TYPE.button.size, this.width / 20)));
    const skipW = this.skip.width;
    // Wide screens: in the HUD's column, under its sign, where nothing else is.
    const column = board.side?.hud;
    const besides = this.width - 48 - skipW - SKIP_GAP;
    const stacked = column !== undefined || besides < 220;
    const wrap = column ? column.width + 24 : Math.min(stacked ? this.width - 48 : besides, 460);
    this.label.setFontSize(column ? Math.min(fontSize, 18) : fontSize).setWordWrapWidth(wrap).setText(shown.text).setVisible(true).setAlpha(1);
    const boxW = this.label.width + 28;
    const boxH = this.label.height + 16;
    const rowW = stacked ? Math.max(boxW, skipW) : boxW + SKIP_GAP + skipW;
    const rowH = stacked ? boxH + SKIP_GAP + SKIP_H : Math.max(boxH, SKIP_H);
    const boardTop = Math.min(...board.shelves.map((shelf) => shelf.rect.y));
    const boardBottom = Math.max(...board.shelves.map((shelf) => shelf.rect.y + shelf.rect.height));
    const hudBottom = board.hud.y + board.hud.height;
    let y: number;
    if (column) y = column.y + column.height + SKIP_GAP * 2 + rowH / 2;
    else if (boardTop - hudBottom >= rowH + 8) y = (hudBottom + boardTop) / 2;
    else if (this.height - boardBottom >= rowH + 8) y = (boardBottom + this.height) / 2;
    else {
      const moveY = slots ? (slots.from.y + slots.to.y) / 2 : this.height / 2;
      y = moveY > (hudBottom + this.height) / 2 ? hudBottom + 8 + rowH / 2 : this.height - 8 - rowH / 2;
    }
    // The sign, then the button: side by side, or one above the other.
    const centre = column ? column.x + column.width / 2 : this.width / 2;
    const x = stacked ? centre : centre - rowW / 2 + boxW / 2;
    const signY = stacked ? y - rowH / 2 + boxH / 2 : y;
    this.skip.setPosition(stacked ? centre : x + boxW / 2 + SKIP_GAP + skipW / 2, stacked ? y + rowH / 2 - SKIP_H / 2 : y).setVisible(true).setAlpha(1);
    this.label.setPosition(x, signY);
    this.panel.clear().setVisible(true).setAlpha(1);
    // A small wooden sign, like the interface's panels.
    this.panel.fillStyle(hexNumber(SKIN.surface.border), 1).fillRoundedRect(x - boxW / 2, signY - boxH / 2 + 4, boxW, boxH, 12);
    this.panel.fillStyle(hexNumber(SKIN.surface.fill), 1).fillRoundedRect(x - boxW / 2, signY - boxH / 2, boxW, boxH, 12);
    this.panel.lineStyle(2, hexNumber(SKIN.status.combo), 0.9).strokeRoundedRect(x - boxW / 2, signY - boxH / 2, boxW, boxH, 12);
    this.animate();
  }

  /** One frame of the gesture, from the loop's progress. */
  private animate(): void {
    const slots = this.slots();
    const board = this.board;
    const visible = this.shown !== null && slots !== null && board !== null && !this.touching;
    this.hand.setVisible(visible && this.hand.texture.key === HAND_TEXTURE);
    this.ghost.setVisible(visible && this.shown?.itemTexture !== null);
    if (!visible || !slots || !board) return;
    const t = this.progress.t;
    const s = board.slotSize;
    // 0-0.12 appear on the item, 0.12-0.2 press, 0.2-0.6 drag, 0.6-0.68 let go, 0.68-0.8 fade, then rest.
    const k = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp((t - 0.2) / 0.4, 0, 1));
    const x = Phaser.Math.Linear(slots.from.x, slots.to.x, k);
    const y = Phaser.Math.Linear(slots.from.y, slots.to.y, k);
    const fadeIn = Phaser.Math.Clamp(t / 0.12, 0, 1);
    const fadeOut = 1 - Phaser.Math.Clamp((t - 0.68) / 0.12, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const pressed = t >= 0.12 && t < 0.68;
    const handPx = s * 0.75;
    this.hand
      .setPosition(x + s * 0.08, y + s * 0.12)
      .setDisplaySize(handPx * (pressed ? 0.92 : 1), handPx * (pressed ? 0.92 : 1))
      .setAlpha(alpha);
    // The copy of the item rides under the finger while it is pressed.
    const carried = Phaser.Math.Clamp((t - 0.12) / 0.08, 0, 1) * (1 - Phaser.Math.Clamp((t - 0.6) / 0.08, 0, 1));
    this.ghost.setPosition(x, y - s * 0.1).setScale(this.itemScale * 1.08).setAlpha(0.6 * carried);
  }
}
