import * as Phaser from 'phaser';
import { marketCategory } from '../../core';
import { ITEM_KINDS } from '../../data/itemCatalog';
import { marketCategoryOf, type Pasaran } from '../../data/pasaran';
import { t } from '../../i18n';
import { hexNumber, SKIN, SPACE } from '../../ui/design/tokens';
import { kitText } from '../kit';
import { roundRect, strokeRoundRect } from '../kit/draw';
import { itemTextureKey, prepareTypes } from '../itemTextures';

/** Item pictures on the sign: up to this many of the day's food, this size. */
const ICONS = 4;
const ICON_PX = 26;
const ROW_H = 36;

/**
 * The market day on the map, under the title: a dark chip like the counters' with "Today is Kliwon: fruit day" and
 * pictures of that food. With `explain` (the first time, or after a tap) a second line says what pasaran is and
 * what the day's food does. Tapping it calls `onPress` (the home screen shows or hides that line).
 */
export class MarketSign extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly line: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly icons: Phaser.GameObjects.Container;
  private readonly kinds: readonly string[];
  private readonly explaining: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly maxWidth: number,
    day: Pasaran,
    explain: boolean,
    onPress: () => void,
  ) {
    super(scene, x, y);
    const category = marketCategory(day);
    this.kinds = ITEM_KINDS.filter((kind) => marketCategoryOf(kind) === category).map((kind) => kind.id);
    this.face = scene.add.graphics();
    this.line = kitText(scene, 'body', t('pasaran.today', { day: t(`pasaran.day.${day}`), food: t(`pasaran.food.${category}`) }), SKIN.text.primary, 15).setOrigin(0, 0.5);
    this.note = kitText(scene, 'body', t('pasaran.explain'), SKIN.text.secondary, 13).setOrigin(0.5, 0).setAlign('center');
    this.icons = scene.add.container(0, 0);
    this.add([this.face, this.line, this.icons, this.note]);
    this.explaining = explain;
    this.setSize(maxWidth, ROW_H).setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, maxWidth, ROW_H), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onPress);
    scene.add.existing(this);
    this.layout();
    // The pictures come once they are downloaded (a few small images); the sign is right without them meanwhile.
    void prepareTypes(scene, this.kinds.slice(0, ICONS)).then(() => {
      if (!this.scene) return;
      this.kinds.slice(0, ICONS).forEach((kind) => this.icons.add(scene.add.image(0, 0, itemTextureKey(kind, false)).setDisplaySize(ICON_PX, ICON_PX)));
      this.layout();
    });
  }

  /** Height of the sign as shown now (with or without its explanation). */
  get signHeight(): number {
    return this.explaining ? ROW_H + this.note.height + SPACE.xs : ROW_H;
  }

  /** Text then pictures on one row, centred, shrinking the text if the row would not fit; the note below. */
  private layout(): void {
    const inner = this.maxWidth - SPACE.s * 2;
    const iconsW = this.icons.length * ICON_PX + Math.max(0, this.icons.length - 1) * 2;
    this.line.setScale(1);
    const room = inner - (iconsW > 0 ? iconsW + SPACE.xs : 0);
    if (this.line.width > room) this.line.setScale(Math.max(0.75, room / this.line.width));
    this.note.setWordWrapWidth(Math.max(inner, 200)).setVisible(this.explaining);
    const rowW = Math.min(inner, this.line.width * this.line.scaleX + (iconsW > 0 ? SPACE.xs + iconsW : 0));
    const w = Math.min(this.maxWidth, rowW + SPACE.s * 2);
    const rowY = -this.signHeight / 2 + ROW_H / 2;
    this.line.setPosition(-rowW / 2, rowY);
    this.icons.list.forEach((icon, i) => (icon as Phaser.GameObjects.Image).setPosition(-rowW / 2 + this.line.width * this.line.scaleX + SPACE.xs + ICON_PX / 2 + i * (ICON_PX + 2), rowY));
    const width = this.explaining ? Math.max(w, Math.min(this.maxWidth, this.note.width + SPACE.s * 2)) : w;
    this.note.setPosition(0, rowY + ROW_H / 2 - SPACE.hair);
    const h = this.signHeight;
    const g = this.face.clear();
    g.fillStyle(hexNumber(SKIN.chip.fill), SKIN.chip.alpha);
    roundRect(g, -width / 2, -h / 2, width, h, SKIN.chipRadius);
    g.lineStyle(1.5, hexNumber(SKIN.chip.border), SKIN.chip.borderAlpha);
    strokeRoundRect(g, -width / 2 + 0.75, -h / 2 + 0.75, width - 1.5, h - 1.5, SKIN.chipRadius);
    // Taps anywhere on it, at least 44 px tall.
    this.setSize(width, Math.max(44, h));
    this.input?.hitArea.setTo(0, 0, width, Math.max(44, h));
  }
}
