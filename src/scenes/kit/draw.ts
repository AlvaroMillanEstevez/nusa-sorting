import type * as Phaser from 'phaser';
import { hexNumber, type Elevation } from '../../ui/design/tokens';

/** A rounded rectangle whose radius never exceeds half its shorter side (so 999 makes a pill). */
export function roundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
  g.fillRoundedRect(x, y, w, h, Math.max(0, Math.min(radius, w / 2, h / 2)));
}

export function strokeRoundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
  g.strokeRoundedRect(x, y, w, h, Math.max(0, Math.min(radius, w / 2, h / 2)));
}

/**
 * A soft drop shadow under a rounded rectangle, faked with stacked translucent shapes growing outwards (Graphics
 * has no blur): cheap, and it scales with the shape.
 */
export function softShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number, e: Elevation): void {
  const steps = 6;
  for (let i = steps; i >= 1; i--) {
    const grow = (e.blur * i) / steps;
    g.fillStyle(0x000000, (e.alpha / steps) * 1.4);
    roundRect(g, x - grow / 2, y + e.offsetY - grow / 2 + grow * 0.15, w + grow, h + grow, radius + grow / 2);
  }
}

/** Wood grain: gently wavy lines across a rectangle, kept clear of its rounded corners. */
export function woodGrain(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, inset: number, color: string, seed = 1): void {
  g.lineStyle(1.5, hexNumber(color), 0.55);
  const rows = Math.max(2, Math.floor(h / 14));
  for (let r = 0; r < rows; r++) {
    const ly = y + inset + ((h - inset * 2) * (r + 0.5)) / rows;
    const phase = Math.sin(seed * 12.9 + r * 4.1) * 3;
    const start = x + inset + Math.abs(Math.sin(seed + r * 1.7)) * w * 0.25;
    const end = x + w - inset - Math.abs(Math.cos(seed * 2 + r)) * w * 0.2;
    g.beginPath();
    for (let px = start, i = 0; px <= end; px += 6, i++) {
      const py = ly + Math.sin(phase + px / 23) * 1.4;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
}
