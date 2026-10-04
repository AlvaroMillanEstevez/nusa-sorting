import type * as Phaser from 'phaser';

/**
 * The game renders at the screen's real pixel density: the canvas has RENDER_RATIO device pixels per CSS
 * pixel, and each scene's camera zooms by RENDER_RATIO so that layout, sizes and input all stay in CSS pixels.
 * Capped at 3: denser screens gain nothing visible and cost fill rate.
 */
export const RENDER_RATIO = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

/** The visible area in CSS pixels: what layouts are computed for. */
export function viewSize(scene: Phaser.Scene): { width: number; height: number } {
  const { width, height } = scene.scale.gameSize;
  return { width: width / RENDER_RATIO, height: height / RENDER_RATIO };
}

/** Sizes the scene's camera to the canvas and zooms it so one world unit is one CSS pixel. */
export function fitCamera(scene: Phaser.Scene): void {
  const { width, height } = scene.scale.gameSize;
  scene.cameras.main.setSize(width, height).setOrigin(0, 0).setZoom(RENDER_RATIO);
}

/** Where a pointer is, in CSS pixels (the world coordinates of every scene). */
export function pointerAt(pointer: Phaser.Input.Pointer): { x: number; y: number } {
  return { x: pointer.x / RENDER_RATIO, y: pointer.y / RENDER_RATIO };
}
