import type * as Phaser from 'phaser';

/**
 * The game renders at the screen's real pixel density: the canvas has RENDER_RATIO device pixels per CSS
 * pixel, and each scene's camera zooms by RENDER_RATIO so that layout, sizes and input all stay in CSS pixels.
 * Capped at 3: denser screens gain nothing visible and cost fill rate.
 */
export const RENDER_RATIO = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

/** Space taken by a phone's notch, rounded corners or home bar on each side, in CSS px. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
let forced: Insets | null = null;
let probe: HTMLElement | null = null;

/** Development only (?safeArea): pretends the screen has these insets, to try a notch on a computer. */
export function forceSafeArea(insets: Insets | null): void {
  forced = insets;
}

/**
 * The screen's safe-area insets (CSS env(safe-area-inset-*); the page uses viewport-fit=cover, so the canvas
 * runs under the notch and the game keeps its content clear of it).
 */
export function safeInsets(): Insets {
  if (forced) return forced;
  if (typeof document === 'undefined' || !document.body) return NO_INSETS;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
}

/** The whole screen in CSS pixels, notch included. */
export function screenSize(scene: Phaser.Scene): { width: number; height: number } {
  const { width, height } = scene.scale.gameSize;
  return { width: width / RENDER_RATIO, height: height / RENDER_RATIO };
}

/** The safe area in CSS pixels: what layouts are computed for. World (0, 0) is its top-left corner. */
export function viewSize(scene: Phaser.Scene): { width: number; height: number } {
  const { width, height } = screenSize(scene);
  const inset = safeInsets();
  return { width: Math.max(1, width - inset.left - inset.right), height: Math.max(1, height - inset.top - inset.bottom) };
}

/** The whole screen in world coordinates (it starts left of and above the safe area): for backgrounds and dims. */
export function screenRect(scene: Phaser.Scene): { x: number; y: number; width: number; height: number } {
  const inset = safeInsets();
  return { x: -inset.left, y: -inset.top, ...screenSize(scene) };
}

/**
 * Sizes the scene's camera to the canvas and zooms it so one world unit is one CSS pixel, with world (0, 0) at
 * the top-left corner of the safe area.
 */
export function fitCamera(scene: Phaser.Scene): void {
  const { width, height } = scene.scale.gameSize;
  const inset = safeInsets();
  scene.cameras.main.setSize(width, height).setOrigin(0, 0).setZoom(RENDER_RATIO).setScroll(-inset.left, -inset.top);
}

/** Where a pointer is, in world coordinates (CSS pixels from the safe area's corner). */
export function pointerAt(pointer: Phaser.Input.Pointer): { x: number; y: number } {
  const inset = safeInsets();
  return { x: pointer.x / RENDER_RATIO - inset.left, y: pointer.y / RENDER_RATIO - inset.top };
}
