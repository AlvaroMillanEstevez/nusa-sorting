import * as Phaser from 'phaser';
import { FONTS, TYPE, type TypeRole } from '../../ui/design/tokens';
import { RENDER_RATIO } from '../view';

/** A text in one of the type roles, centred on (x, y) unless an origin is given. */
export function kitText(scene: Phaser.Scene, role: TypeRole, value: string, color: string, size: number = TYPE[role].size): Phaser.GameObjects.Text {
  const style = TYPE[role];
  return scene.add
    .text(0, 0, value, {
      fontFamily: FONTS[style.font],
      fontStyle: String(style.weight),
      fontSize: `${Math.round(size)}px`,
      color,
      align: 'center',
    })
    .setLetterSpacing(style.tracking)
    .setOrigin(0.5)
    .setResolution(RENDER_RATIO * 1.5);
}
