import type * as Phaser from 'phaser';
import { DURATION, SKIN } from '../ui/design/tokens';

const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(SKIN.backdrop[1].slice(i, i + 2), 16)) as [number, number, number];

/** Fades a scene in from the backdrop colour (between home, map and level). */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(DURATION.screen / 2, r, g, b);
}

/**
 * Fades a scene out to the backdrop colour and starts another one in its place. Does nothing while a fade is
 * already running (a double tap cannot start a scene twice).
 */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object): void {
  const camera = scene.cameras.main;
  if (camera.fadeEffect.isRunning) return;
  scene.input.enabled = false;
  camera.fadeOut(DURATION.screen / 2, r, g, b);
  camera.once('camerafadeoutcomplete', () => {
    scene.input.enabled = true;
    scene.scene.start(key, data);
  });
}
