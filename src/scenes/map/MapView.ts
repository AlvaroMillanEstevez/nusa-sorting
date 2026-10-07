import * as Phaser from 'phaser';
import { t } from '../../i18n';
import { MAP } from '../../ui/art/map';
import { WOOD } from '../../ui/art/wood';
import { DURATION, EASE, hexNumber, SKIN } from '../../ui/design/tokens';
import type { MapIsland, MapLayout, MapNode } from '../../ui/mapLayout';
import { themeLook } from '../../ui/themeLook';
import { KitStars, kitText, uiIcon } from '../kit';

/** What the map shows for one level. */
export interface MapLevelState {
  readonly number: number;
  readonly theme: string | undefined;
  readonly unlocked: boolean;
  /** Most stars earned in it; 0 when not completed. */
  readonly stars: number;
  /** Shown at all (the levels beyond stay unexplored). */
  readonly revealed: boolean;
}

/** A stable pseudo-random number in [0, 1) for a seed, so each island keeps its shape. */
function noise(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Points around an irregular blob: an ellipse whose radius wobbles. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wobble = 0.12, count = 28): Phaser.Math.Vector2[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2.3) * 0.4);
    return new Phaser.Math.Vector2(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  });
}

/**
 * The level map drawn in the warung style: a sea with waves, sandy islands with green hearts and palms, docks
 * and ropes between them, a few boats, signs on the themed islands, and a wooden plaque for each level. Levels
 * beyond the revealed ones are not drawn: clouds cover the sea above them. Everything lives in one container
 * that the home scene scrolls.
 */
export class MapView {
  readonly container: Phaser.GameObjects.Container;
  private readonly nodeViews = new Map<number, Phaser.GameObjects.Container>();
  private marker: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: MapLayout,
    private readonly levels: readonly MapLevelState[],
    /** Map x of the layout's left edge (the map is centred on wide screens). */
    left: number,
  ) {
    this.container = scene.add.container(left, 0);
    this.draw();
  }

  get height(): number {
    return this.layout.height;
  }

  /** Where a level's plaque is, in the container's coordinates. */
  nodeAt(level: number): { x: number; y: number } {
    const node = this.layout.nodes[level]!;
    return { x: node.x, y: node.y };
  }

  /** The level whose plaque is under a point (container coordinates), if revealed. */
  levelAt(x: number, y: number): number | null {
    const r = this.plaqueRadius() + 6;
    const hit = this.layout.nodes.find((n) => this.levels[n.level]!.revealed && (n.x - x) ** 2 + (n.y - y) ** 2 <= r * r);
    return hit ? hit.level : null;
  }

  plaqueRadius(): number {
    return Math.max(24, this.layout.unit * 0.6);
  }

  private revealedIslands(): MapIsland[] {
    return this.layout.islands.filter((island) => island.levels.some((level) => this.levels[level]!.revealed));
  }

  private draw(): void {
    const u = this.layout.unit;
    const islands = this.revealedIslands();
    const top = Math.min(...islands.map((i) => i.cy - i.ry));

    // Waves across the revealed sea.
    const waves = this.scene.add.graphics();
    waves.lineStyle(2, hexNumber(MAP.wave), 0.35);
    for (let y = top - u * 2; y < this.layout.height; y += u * 0.9) {
      for (let x = -u * 6; x < this.layout.width + u * 6; x += u * 2.2) {
        const ox = x + noise(y + x) * u;
        waves.beginPath();
        waves.arc(ox, y, u * 0.35, Math.PI * 1.15, Math.PI * 1.85);
        waves.strokePath();
      }
    }
    this.container.add(waves);

    const ground = this.scene.add.graphics();
    this.container.add(ground);
    for (const island of islands) this.drawIsland(ground, island);
    this.drawPath(ground);
    this.drawBoats(ground, islands);

    for (const island of islands) if (island.theme) this.drawSign(island);
    for (const node of this.layout.nodes) if (this.levels[node.level]!.revealed) this.drawNode(node);
    this.drawClouds(top);
  }

  private drawIsland(g: Phaser.GameObjects.Graphics, island: MapIsland): void {
    const { cx, cy, rx, ry, index } = island;
    const u = this.layout.unit;
    g.fillStyle(hexNumber(MAP.shallow), 0.55).fillPoints(blob(cx, cy, rx * 1.18, ry * 1.12, index, 0.1), true);
    g.fillStyle(hexNumber(MAP.foam), 0.35).fillPoints(blob(cx, cy, rx * 1.05, ry * 1.03, index + 0.3, 0.12), true);
    g.fillStyle(hexNumber(MAP.sandShade), 1).fillPoints(blob(cx, cy + u * 0.12, rx, ry, index, 0.12), true);
    g.fillStyle(hexNumber(MAP.sand), 1).fillPoints(blob(cx, cy, rx * 0.97, ry * 0.97, index, 0.12), true);
    g.fillStyle(hexNumber(MAP.grassShade), 1).fillPoints(blob(cx, cy + u * 0.08, rx * 0.74, ry * 0.72, index + 1.7, 0.16), true);
    g.fillStyle(hexNumber(MAP.grass), 1).fillPoints(blob(cx, cy, rx * 0.7, ry * 0.68, index + 1.7, 0.16), true);
    // A few palms along the shore, away from the path.
    for (let p = 0; p < 3; p++) {
      const a = Math.PI * (0.15 + p * 0.55) + index;
      const side = Math.cos(a) >= 0 ? 1 : -1;
      this.drawPalm(g, cx + side * rx * 0.82, cy + Math.sin(a) * ry * 0.55, u * 0.9, side);
    }
    // A dock where the path leaves the island for the next one.
    const next = this.layout.islands[index + 1];
    if (next) this.drawDock(g, island, next);
  }

  private drawPalm(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, side: number): void {
    const top = { x: x + side * size * 0.25, y: y - size };
    g.lineStyle(size * 0.12, hexNumber(MAP.palmTrunk), 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + side * size * 0.12, y - size * 0.5);
    g.lineTo(top.x, top.y);
    g.strokePath();
    for (let l = 0; l < 5; l++) {
      const a = -Math.PI / 2 + (l - 2) * 0.62;
      g.fillStyle(hexNumber(l % 2 ? MAP.palmLeafLight : MAP.palmLeaf), 1);
      g.fillEllipse(top.x + Math.cos(a) * size * 0.32, top.y + Math.sin(a) * size * 0.18 + size * 0.08, size * 0.62, size * 0.2);
    }
  }

  /** A wooden jetty from an island towards the next one. */
  private drawDock(g: Phaser.GameObjects.Graphics, from: MapIsland, to: MapIsland): void {
    const u = this.layout.unit;
    const dir = to.cx > from.cx ? 1 : -1;
    const x0 = from.cx + dir * from.rx * 0.55;
    const y0 = from.cy - from.ry * 0.78;
    const w = u * 0.7;
    const h = u * 1.5;
    g.fillStyle(hexNumber(WOOD.frameDark), 1).fillRect(x0 - w / 2 + 2, y0 - h + 3, w, h);
    g.fillStyle(hexNumber(WOOD.plank), 1).fillRect(x0 - w / 2, y0 - h, w, h);
    g.lineStyle(1.5, hexNumber(WOOD.plankDark), 1);
    for (let py = y0 - h + u * 0.25; py < y0; py += u * 0.25) g.lineBetween(x0 - w / 2, py, x0 + w / 2, py);
    g.fillStyle(hexNumber(WOOD.frameDark), 1);
    for (const px of [x0 - w / 2 - 2, x0 + w / 2 - 2]) g.fillRect(px, y0 - h - 4, 4, u * 0.35);
  }

  /** The path: sandy dots on the islands, a rope across the water between them. */
  private drawPath(g: Phaser.GameObjects.Graphics): void {
    const nodes = this.layout.nodes.filter((n) => this.levels[n.level]!.revealed);
    for (let i = 1; i < nodes.length; i++) {
      const [a, b] = [nodes[i - 1]!, nodes[i]!];
      if (a.island === b.island) {
        g.fillStyle(hexNumber(MAP.sandShade), 1);
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12);
        for (let s = 1; s < steps; s++) g.fillCircle(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps, 3);
      } else {
        // A rope sagging between the two shores, with a buoy halfway.
        const mid = { x: (a.x + b.x) / 2 + (b.x > a.x ? -1 : 1) * this.layout.unit * 0.6, y: (a.y + b.y) / 2 };
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(b.x, b.y));
        const points = curve.getPoints(24);
        g.lineStyle(5, hexNumber(MAP.rope), 1).strokePoints(points);
        g.lineStyle(2, hexNumber(MAP.ropeLight), 1).strokePoints(points);
        const buoy = curve.getPoint(0.5);
        g.fillStyle(hexNumber('#d2452f'), 1).fillCircle(buoy.x, buoy.y, 6);
        g.fillStyle(0xffffff, 1).fillRect(buoy.x - 6, buoy.y - 1.5, 12, 3);
      }
    }
  }

  /** A couple of small sailing boats on the open water. */
  private drawBoats(g: Phaser.GameObjects.Graphics, islands: readonly MapIsland[]): void {
    const u = this.layout.unit;
    islands.forEach((island, i) => {
      if (i % 2 === 1) return;
      const x = island.cx > this.layout.width / 2 ? island.cx - island.rx - u * 1.2 : island.cx + island.rx + u * 1.2;
      const y = island.cy + island.ry * 0.3;
      const s = u * 0.55;
      g.fillStyle(hexNumber(WOOD.frame), 1).fillTriangle(x - s, y, x + s, y, x + s * 0.6, y + s * 0.4).fillTriangle(x - s, y, x - s * 0.6, y + s * 0.4, x + s * 0.6, y + s * 0.4);
      g.fillStyle(hexNumber(MAP.sail), 1).fillTriangle(x, y - s * 1.4, x, y - s * 0.1, x + s * 0.8, y - s * 0.1);
      g.fillStyle(hexNumber(i % 4 === 0 ? '#d2452f' : SKIN.fills.primary.face), 1).fillTriangle(x, y - s * 1.2, x, y - s * 0.1, x - s * 0.6, y - s * 0.1);
      g.lineStyle(2, hexNumber(MAP.foam), 0.6).lineBetween(x - s * 1.4, y + s * 0.55, x + s * 1.2, y + s * 0.55);
    });
  }

  /** A themed island's wooden sign with its name, under a string of flags in its colours. */
  private drawSign(island: MapIsland): void {
    const u = this.layout.unit;
    const look = themeLook(island.theme!);
    // Beside the path, on the side away from the next island (the rope leaves the other way).
    const next = this.layout.islands[island.index + 1];
    const side = next && next.cx > island.cx ? -1 : 1;
    const y = island.cy - island.ry * 0.55;
    const sx = island.cx + side * island.rx * 0.38;
    const label = kitText(this.scene, 'label', t(`theme.${island.theme}` as Parameters<typeof t>[0]), SKIN.text.primary);
    const w = Math.min(label.width + 24, island.rx * 2.1);
    if (label.width > w - 16) label.setScale((w - 16) / label.width);
    const g = this.scene.add.graphics();
    g.fillStyle(hexNumber(WOOD.frameDark), 1).fillRect(sx - 3, y, 6, u * 0.9);
    g.fillStyle(hexNumber(SKIN.surface.border), 1).fillRoundedRect(sx - w / 2, y - 16 + 3, w, 30, 6);
    g.fillStyle(hexNumber(SKIN.surface.fill), 1).fillRoundedRect(sx - w / 2, y - 16, w, 30, 6);
    const colours = look ? [look.accent, ...look.motifColors] : [SKIN.text.accent];
    const fy = y - 26;
    g.lineStyle(1.5, hexNumber(MAP.rope), 1).lineBetween(sx - w / 2, fy, sx + w / 2, fy);
    const flags = Math.max(4, Math.floor(w / 16));
    for (let f = 0; f < flags; f++) {
      const fx = sx - w / 2 + ((f + 0.5) * w) / flags;
      g.fillStyle(hexNumber(colours[f % colours.length]!), 1).fillTriangle(fx - 5, fy, fx + 5, fy, fx, fy + 9);
    }
    this.container.add([g, label.setPosition(sx, y - 1)]);
  }

  private drawNode(node: MapNode): void {
    const level = this.levels[node.level]!;
    const r = this.plaqueRadius();
    const parts: Phaser.GameObjects.GameObject[] = [];
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillEllipse(0, r * 0.75, r * 2, r * 0.7);
    g.fillStyle(hexNumber(SKIN.surface.border), 1).fillCircle(0, 3, r);
    g.fillStyle(hexNumber(level.unlocked ? SKIN.surface.fill : SKIN.well), 1).fillCircle(0, 0, r);
    if (level.unlocked) g.fillStyle(hexNumber(SKIN.surface.highlight), 0.5).fillEllipse(0, -r * 0.55, r * 1.1, r * 0.35);
    if (level.theme) g.lineStyle(3, hexNumber(themeLook(level.theme)?.accent ?? SKIN.text.accent), 1).strokeCircle(0, 0, r - 2);
    parts.push(g);
    if (level.unlocked) {
      parts.push(kitText(this.scene, 'title', String(level.number), SKIN.text.primary, Math.round(r * 0.85)).setY(-1));
      if (level.stars > 0) parts.push(new KitStars(this.scene, 0, r + 9, SKIN, 15, false).setStars(level.stars));
    } else {
      parts.push(uiIcon(this.scene, 'lock', SKIN.text.secondary, r * 0.8));
    }
    const view = this.scene.add.container(node.x, node.y, parts);
    if (!level.unlocked) view.setAlpha(0.9);
    this.nodeViews.set(node.level, view);
    this.container.add(view);
  }

  /** Clouds over the sea above the revealed islands: what lies beyond is not shown. */
  private drawClouds(top: number): void {
    const u = this.layout.unit;
    const g = this.scene.add.graphics();
    const y = top - u * 1.6;
    for (let x = -u * 8; x < this.layout.width + u * 8; x += u * 1.6) {
      const k = noise(x * 0.37);
      g.fillStyle(hexNumber(MAP.cloud), 0.85).fillEllipse(x, y - k * u * 0.6, u * (2.4 + k), u * (1.3 + k * 0.5));
      g.fillStyle(hexNumber(MAP.cloud), 0.55).fillEllipse(x + u * 0.8, y - u * 1.1 - k * u, u * 2.6, u * 1.2);
    }
    g.fillStyle(hexNumber(MAP.cloud), 0.9).fillRect(-u * 8, -this.layout.height, this.layout.width + u * 16, y - u * 1.4 + this.layout.height);
    this.container.add(g);
  }

  /** The current level: a larger plaque in a light ring, bobbing gently. */
  highlight(level: number): void {
    const view = this.nodeViews.get(level);
    if (!view) return;
    const ring = this.scene.add.graphics();
    const r = this.plaqueRadius();
    ring.lineStyle(4, hexNumber(SKIN.status.combo), 1).strokeCircle(0, 0, r + 6);
    view.addAt(ring, 0);
    view.setScale(1.15);
    this.scene.tweens.add({ targets: view, scale: 1.22, duration: 900, yoyo: true, repeat: -1, ease: EASE.loop });
  }

  /** The player's pin, over a level's plaque. */
  placeMarker(level: number): Phaser.GameObjects.Container {
    this.marker?.destroy();
    const r = this.plaqueRadius();
    const g = this.scene.add.graphics();
    g.fillStyle(hexNumber(SKIN.surface.border), 1).fillCircle(0, 2, 15).fillTriangle(-10, 8, 10, 8, 0, 24);
    g.fillStyle(hexNumber(SKIN.fills.danger.face), 1).fillCircle(0, 0, 14).fillTriangle(-9, 6, 9, 6, 0, 21);
    const star = uiIcon(this.scene, 'starFilled', SKIN.text.primary, 16);
    const pin = this.scene.add.container(0, 0, [g, star]);
    const at = this.nodeAt(level);
    pin.setPosition(at.x, at.y - r - 26);
    this.scene.tweens.add({ targets: g, y: -4, duration: 700, yoyo: true, repeat: -1, ease: EASE.loop });
    this.marker = pin;
    this.container.add(pin);
    return pin;
  }

  /** Moves the pin along the path from one level to the next. Resolves when it arrives. */
  moveMarker(from: number, to: number, onStep: () => void): Promise<void> {
    const pin = this.marker ?? this.placeMarker(from);
    const r = this.plaqueRadius();
    const a = this.nodeAt(from);
    const b = this.nodeAt(to);
    const progress = { k: 0 };
    let lastStep = 0;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: progress,
        k: 1,
        duration: DURATION.slow * 2,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const k = progress.k;
          pin.setPosition(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - r - 26 - Math.sin(Math.PI * k) * r);
          if (k - lastStep > 0.25) {
            lastStep = k;
            onStep();
          }
        },
        onComplete: () => resolve(),
      });
    });
  }

  /** Puts the pin at a level at once (skipping its move). */
  jumpMarker(level: number): void {
    const pin = this.marker ?? this.placeMarker(level);
    this.scene.tweens.killTweensOf(pin);
    const at = this.nodeAt(level);
    pin.setPosition(at.x, at.y - this.plaqueRadius() - 26);
  }

  /** Gives a plaque a small shake (a locked level was tapped). */
  shake(level: number): void {
    const view = this.nodeViews.get(level);
    if (!view) return;
    const x = view.x;
    this.scene.tweens.add({ targets: view, x: x + 6, duration: 50, yoyo: true, repeat: 2, onComplete: () => view.setX(x) });
  }
}
