import * as Phaser from 'phaser';
import { DURATION, EASE, MIN_TOUCH, PRESS } from '../../ui/design/tokens';
import { RENDER_RATIO } from '../view';
import { kitFeedback } from './feedback';

/** Pointer travel (CSS px) after which a press is a drag, not a tap. */
const TAP_SLOP = 10;

/**
 * A control that reacts to presses: it sinks and shrinks a little while held, springs back with a small
 * overshoot when released, and fires on release inside it. Disabled, it fades, loses its depth and takes no
 * input, so its state never depends on colour alone. Its touch area is never smaller than MIN_TOUCH.
 */
export abstract class Pressable extends Phaser.GameObjects.Container {
  /** What moves when pressed (the shadow stays behind, under it). */
  protected readonly inner: Phaser.GameObjects.Container;
  protected pressed = false;
  protected disabled = false;
  private onPress: (() => void) | null;

  constructor(scene: Phaser.Scene, x: number, y: number, onPress: (() => void) | null) {
    super(scene, x, y);
    this.onPress = onPress;
    this.inner = scene.add.container(0, 0);
    scene.add.existing(this);
  }

  /** Sets the touch area around the centre: the visible size, grown to MIN_TOUCH where smaller. */
  protected setTouchArea(width: number, height: number): void {
    const w = Math.max(width, MIN_TOUCH);
    const h = Math.max(height, MIN_TOUCH);
    this.setSize(w, h);
    if (this.input) this.removeInteractive();
    this.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, w, h), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    this.input!.enabled = !this.disabled;
    this.off(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN).off(Phaser.Input.Events.GAMEOBJECT_POINTER_UP).off(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.setPressed(true));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setPressed(false, false));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const was = this.pressed;
      this.setPressed(false, was);
      // A press that travelled is a drag (e.g. scrolling a list), not a tap.
      if (was && !this.disabled && pointer.getDistance() <= TAP_SLOP * RENDER_RATIO) {
        kitFeedback().press();
        this.onPress?.();
      }
    });
  }

  setOnPress(onPress: (() => void) | null): this {
    this.onPress = onPress;
    return this;
  }

  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    this.pressed = false;
    if (this.input) this.input.enabled = !disabled;
    // Drawn in muted colours rather than see-through (overlapping shapes would show through each other).
    this.redraw();
    return this;
  }

  /** Shows the pressed look (the showcase draws it statically; normally presses set it). */
  setPressed(pressed: boolean, release = true): this {
    if (this.disabled || pressed === this.pressed) return this;
    this.pressed = pressed;
    this.redraw();
    this.scene.tweens.killTweensOf(this.inner);
    if (pressed) {
      this.scene.tweens.add({ targets: this.inner, scale: PRESS.scale, duration: DURATION.press, ease: EASE.enter });
    } else if (release) {
      this.scene.tweens.chain({
        targets: this.inner,
        tweens: [
          { scale: PRESS.release, duration: DURATION.press, ease: EASE.enter },
          { scale: 1, duration: DURATION.fast, ease: EASE.pop },
        ],
      });
    } else {
      this.scene.tweens.add({ targets: this.inner, scale: 1, duration: DURATION.fast, ease: EASE.enter });
    }
    return this;
  }

  protected abstract redraw(): void;
}
