import * as Phaser from 'phaser';
import { DURATION, EASE, hexNumber, type Skin } from '../../ui/design/tokens';
import { roundRect, strokeRoundRect } from './draw';
import { Pressable } from './Pressable';
import { uiIcon } from './uiIconTextures';

const TRACK_W = 60;
const TRACK_H = 34;

/**
 * An on/off switch. On and off differ in the knob's side and in the mark on it (a check or a cross), not only
 * in colour.
 */
export class KitToggle extends Pressable {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Container;
  private readonly knobFace: Phaser.GameObjects.Graphics;
  private isOn: boolean;
  private marks: { on: Phaser.GameObjects.Image; off: Phaser.GameObjects.Image };

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly skin: Skin, on: boolean, onChange?: (on: boolean) => void) {
    super(scene, x, y, null);
    this.isOn = on;
    this.track = scene.add.graphics();
    this.knobFace = scene.add.graphics();
    const knobD = TRACK_H - 8;
    this.marks = {
      on: uiIcon(scene, 'check', skin.fills.positive.lip, knobD * 0.62),
      off: uiIcon(scene, 'close', '#5b6672', knobD * 0.5),
    };
    this.knob = scene.add.container(0, 0, [this.knobFace, this.marks.on, this.marks.off]);
    this.inner.add([this.track, this.knob]);
    this.add(this.inner);
    this.setOnPress(() => {
      this.setOn(!this.isOn, true);
      onChange?.(this.isOn);
    });
    this.setTouchArea(TRACK_W, TRACK_H);
    this.redraw();
    this.knob.setX(this.knobX());
  }

  setOn(on: boolean, animate = false): this {
    this.isOn = on;
    this.redraw();
    this.scene.tweens.killTweensOf(this.knob);
    if (animate) this.scene.tweens.add({ targets: this.knob, x: this.knobX(), duration: DURATION.fast, ease: EASE.pop });
    else this.knob.setX(this.knobX());
    return this;
  }

  private knobX(): number {
    return (this.isOn ? 1 : -1) * (TRACK_W / 2 - TRACK_H / 2);
  }

  protected redraw(): void {
    const { skin } = this;
    const g = this.track.clear();
    const radius = 10;
    g.fillStyle(hexNumber(this.isOn ? skin.fills.positive.face : skin.well), 1);
    roundRect(g, -TRACK_W / 2, -TRACK_H / 2, TRACK_W, TRACK_H, radius);
    g.lineStyle(1.5, hexNumber(this.isOn ? skin.fills.positive.lip : skin.chip.border), 0.9);
    strokeRoundRect(g, -TRACK_W / 2 + 0.75, -TRACK_H / 2 + 0.75, TRACK_W - 1.5, TRACK_H - 1.5, radius);
    const d = TRACK_H - 8;
    const k = this.knobFace.clear();
    k.fillStyle(0x000000, 0.25).fillCircle(0, 2, d / 2);
    k.fillStyle(0xffffff, 1);
    roundRect(k, -d / 2, -d / 2, d, d, 7);
    this.marks.on.setVisible(this.isOn);
    this.marks.off.setVisible(!this.isOn);
  }
}
