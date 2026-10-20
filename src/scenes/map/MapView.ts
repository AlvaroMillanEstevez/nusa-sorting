import * as Phaser from 'phaser';
import { t } from '../../i18n';
import { MAP } from '../../ui/art/map';
import { WOOD } from '../../ui/art/wood';
import { DURATION, EASE, hexNumber, SKIN } from '../../ui/design/tokens';
import type { MapIsland, MapLayout, MapNode } from '../../ui/mapLayout';
import { islandInfo, islandKey, islandName, loadIsland } from '../art/islandArt';
import { themeLook } from '../../ui/themeLook';
import { KitStars, kitText, reducedMotion, uiIcon } from '../kit';

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

/** Where an island's picture goes, flipped or not, and where its jetty ends (container coordinates). */
interface IslandPicture {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly flip: boolean;
  readonly dock: { readonly x: number; readonly y: number };
}

/**
 * The level map: a sea with waves, the illustrated islands (each downloaded when the map scrolls near it; islands
 * without a picture are drawn: sand, grass, palms and a jetty), ropes from each jetty to the next island, signs on
 * the themed islands, and a wooden plaque for each level. Levels beyond the revealed ones are not drawn: clouds
 * cover the sea above them. Everything lives in one container that the home scene scrolls.
 */
export class MapView {
  readonly container: Phaser.GameObjects.Container;
  private readonly nodeViews = new Map<number, Phaser.GameObjects.Container>();
  /** The current level, and the plaques under the pointer and under a press, with their lights. */
  private current: number | null = null;
  private hovered: number | null = null;
  private pressed: number | null = null;
  private readonly glows = new Map<number, Phaser.GameObjects.Graphics>();
  /** The islands' pictures, by island index, and their images once loaded. */
  private readonly pictures = new Map<number, IslandPicture>();
  private readonly shown = new Map<number, Phaser.GameObjects.Image>();
  /** Above the sea and halos, under the path, signs and plaques. */
  private islandLayer!: Phaser.GameObjects.Container;
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
    for (const island of islands) {
      const picture = this.pictureOf(island);
      if (picture) {
        this.pictures.set(island.index, picture);
        this.drawShallows(ground, island);
      } else {
        this.drawIsland(ground, island);
      }
    }
    this.islandLayer = this.scene.add.container(0, 0);
    this.container.add(this.islandLayer);
    const path = this.scene.add.graphics();
    this.container.add(path);
    this.drawPath(path);

    for (const island of islands) if (island.theme) this.drawSign(island);
    for (const node of this.layout.nodes) if (this.levels[node.level]!.revealed) this.drawNode(node);
    this.drawClouds(top);
    // Once the last island is in view, a sign in the clouds says more are on the way.
    if (this.levels.at(-1)?.revealed) this.drawComingSoon(top);
  }

  /** The end of the map for now: a wooden sign over the clouds above the last island, "More islands coming soon". */
  private drawComingSoon(top: number): void {
    const u = this.layout.unit;
    const label = kitText(this.scene, 'label', t('map.comingSoon'), SKIN.text.primary);
    const w = Math.min(label.width + 40, this.layout.width - u);
    if (label.width > w - 24) label.setScale((w - 24) / label.width);
    const cx = this.layout.width / 2;
    const y = top - u * 1.5;
    const g = this.scene.add.graphics();
    // Two posts into the clouds, a plank across them, and a dotted course leading on beyond it.
    g.fillStyle(hexNumber(WOOD.frameDark), 1).fillRect(cx - w / 2 + 10, y, 6, u * 0.8).fillRect(cx + w / 2 - 16, y, 6, u * 0.8);
    g.fillStyle(hexNumber(SKIN.surface.border), 1).fillRoundedRect(cx - w / 2, y - 18 + 3, w, 34, 7);
    g.fillStyle(hexNumber(SKIN.surface.fill), 1).fillRoundedRect(cx - w / 2, y - 18, w, 34, 7);
    g.fillStyle(hexNumber(SKIN.surface.highlight), 0.6).fillRect(cx - w / 2 + 8, y - 15, w - 16, 3);
    g.fillStyle(hexNumber(MAP.rope), 0.9);
    for (let k = 1; k <= 4; k++) g.fillCircle(cx, y - 18 - k * u * 0.38, 2.4);
    this.container.add([g, label.setPosition(cx, y - 1)]);
  }

  /**
   * Where an island's picture goes: centred on the island, a themed (square) one a little larger than its shape's
   * height, a plain (upright) one as tall as its shape. Flipped when the next island lies to the left, so its jetty
   * (drawn top right) always faces the way on.
   */
  private pictureOf(island: MapIsland): IslandPicture | null {
    const name = islandName(island.theme, island.levels.map((level) => this.levels[level]!.number));
    const info = islandInfo(name);
    if (!info) return null;
    const [w, h] = info.size;
    const height = island.ry * 2 * (island.theme ? 1.35 : 1.04);
    const width = (height * w) / h;
    const x = island.cx - width / 2;
    const y = island.cy - height / 2;
    const next = this.layout.islands[island.index + 1];
    const flip = next !== undefined && next.cx < island.cx;
    const dx = flip ? 1 - info.dock[0] : info.dock[0];
    return { name, x, y, width, height, flip, dock: { x: x + dx * width, y: y + info.dock[1] * height } };
  }

  /** The lighter water and foam around an island, under its picture. */
  private drawShallows(g: Phaser.GameObjects.Graphics, island: MapIsland): void {
    const { cx, cy, rx, ry, index } = island;
    g.fillStyle(hexNumber(MAP.shallow), 0.5).fillPoints(blob(cx, cy, rx * 1.12, ry * 1.12, index, 0.08), true);
    g.fillStyle(hexNumber(MAP.foam), 0.18).fillPoints(blob(cx, cy, rx * 1.02, ry * 1.04, index + 0.3, 0.08), true);
  }

  /**
   * Shows the island pictures between map y `top` and `bottom` (with a screen's margin either side), downloading
   * those not loaded yet. The home scene calls it whenever the map scrolls; it allocates nothing when all is shown.
   */
  reveal(top: number, bottom: number): void {
    const margin = bottom - top;
    const middle = (top + bottom) / 2;
    const wanted: [number, IslandPicture][] = [];
    for (const entry of this.pictures) {
      const [index, picture] = entry;
      if (!this.shown.has(index) && picture.y <= bottom + margin && picture.y + picture.height >= top - margin) wanted.push(entry);
    }
    // The island in the middle of the screen first, then outwards.
    wanted.sort(([, a], [, b]) => Math.abs(a.y + a.height / 2 - middle) - Math.abs(b.y + b.height / 2 - middle));
    for (const [index, picture] of wanted) {
      const key = islandKey(picture.name);
      if (this.scene.textures.exists(key)) {
        this.showIsland(index, picture, false);
        continue;
      }
      void loadIsland(this.scene.textures, picture.name).then(() => {
        if (this.container.active && !this.shown.has(index) && this.scene.textures.exists(key)) this.showIsland(index, picture, true);
      });
    }
  }

  private showIsland(index: number, picture: IslandPicture, fade: boolean): void {
    const image = this.scene.add.image(picture.x, picture.y, islandKey(picture.name)).setOrigin(0).setDisplaySize(picture.width, picture.height).setFlipX(picture.flip);
    this.islandLayer.add(image);
    this.shown.set(index, image);
    if (fade && !reducedMotion()) this.scene.tweens.add({ targets: image, alpha: { from: 0, to: 1 }, duration: DURATION.base, ease: EASE.enter });
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

  /**
   * The path: footsteps on the islands, and a rope across the water between them, from the jetty of an illustrated
   * island (its footsteps lead there) to the shore of the next one.
   */
  private drawPath(g: Phaser.GameObjects.Graphics): void {
    const nodes = this.layout.nodes.filter((n) => this.levels[n.level]!.revealed);
    const steps = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 12);
      for (let s = 1; s < count; s++) {
        const x = from.x + ((to.x - from.x) * s) / count;
        const y = from.y + ((to.y - from.y) * s) / count;
        g.fillStyle(hexNumber(MAP.step), 0.35).fillCircle(x + 1, y + 1.5, 3.4);
        g.fillStyle(hexNumber(MAP.sand), 0.95).fillCircle(x, y, 3);
      }
    };
    for (let i = 1; i < nodes.length; i++) {
      let [a, b]: { x: number; y: number }[] = [nodes[i - 1]!, nodes[i]!];
      if (nodes[i - 1]!.island === nodes[i]!.island) {
        steps(a!, b!);
      } else {
        const from = this.pictures.get(nodes[i - 1]!.island);
        const to = this.pictures.get(nodes[i]!.island);
        if (from) {
          steps(a!, from.dock);
          a = from.dock;
        }
        if (to) {
          // Ashore at the bottom of the next island, on the side the rope comes from, then on foot.
          const side = a!.x < to.x + to.width / 2 ? -1 : 1;
          const shore = { x: to.x + to.width * (0.5 + side * 0.18), y: to.y + to.height * 0.93 };
          steps(shore, b!);
          b = shore;
        }
        // A rope sagging between the two shores, with a buoy halfway.
        const mid = { x: (a!.x + b!.x) / 2 + (b!.x > a!.x ? -1 : 1) * this.layout.unit * 0.6, y: (a!.y + b!.y) / 2 };
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a!.x, a!.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(b!.x, b!.y));
        const points = curve.getPoints(24);
        g.lineStyle(5, hexNumber(MAP.rope), 1).strokePoints(points);
        g.lineStyle(2, hexNumber(MAP.ropeLight), 1).strokePoints(points);
        const buoy = curve.getPoint(0.5);
        g.fillStyle(hexNumber('#d2452f'), 1).fillCircle(buoy.x, buoy.y, 6);
        g.fillStyle(0xffffff, 1).fillRect(buoy.x - 6, buoy.y - 1.5, 12, 3);
      }
    }
  }

  /** A themed island's wooden sign with its name, under a string of flags in its colours. */
  private drawSign(island: MapIsland): void {
    const u = this.layout.unit;
    const look = themeLook(island.theme!);
    // Drawn islands: beside the path, on the side away from the next island (the rope leaves the other way).
    // Illustrated ones: in the clearing below the level, clear of the buildings that make the island.
    const next = this.layout.islands[island.index + 1];
    const side = next && next.cx > island.cx ? -1 : 1;
    const picture = this.pictures.get(island.index);
    const y = picture ? picture.y + picture.height * 0.86 : island.cy - island.ry * 0.55;
    const sx = picture ? island.cx : island.cx + side * island.rx * 0.38;
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

  /**
   * The current level: a larger plaque in a light ring with a warm light behind it that breathes, bobbing gently
   * (both still with reduced motion), so it asks to be tapped.
   */
  highlight(level: number): void {
    const view = this.nodeViews.get(level);
    if (!view) return;
    this.current = level;
    const r = this.plaqueRadius();
    const light = this.scene.add.graphics();
    for (let k = 4; k >= 1; k--) light.fillStyle(hexNumber(SKIN.status.combo), 0.09).fillCircle(0, 0, r + 6 + k * 6);
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, hexNumber(SKIN.status.combo), 1).strokeCircle(0, 0, r + 6);
    view.addAt(ring, 0);
    view.addAt(light, 0);
    view.setScale(1.15);
    if (!reducedMotion()) {
      this.scene.tweens.add({ targets: view, scale: 1.22, duration: 900, yoyo: true, repeat: -1, ease: EASE.loop });
      this.scene.tweens.add({ targets: light, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: EASE.loop });
    }
  }

  /** With a mouse: the plaque under the pointer lifts a little and glows (null: none). */
  hover(level: number | null): void {
    if (level === this.hovered) return;
    const was = this.hovered;
    this.hovered = level;
    this.restyle(was);
    this.restyle(level);
  }

  /** The plaque under a finger or a held mouse button sinks a little (null: none). */
  press(level: number | null): void {
    if (level === this.pressed) return;
    const was = this.pressed;
    this.pressed = level;
    this.restyle(was);
    this.restyle(level);
  }

  /**
   * A plaque's look for its hover and press: lifted (×1.1) with a soft light behind when hovered, sunk (×0.92)
   * when pressed; with reduced motion it changes at once instead of easing. The current level keeps its own bob,
   * so it only takes the light.
   */
  private restyle(level: number | null): void {
    if (level === null) return;
    const view = this.nodeViews.get(level);
    if (!view) return;
    const lit = level === this.hovered || level === this.pressed;
    let glow = this.glows.get(level);
    if (lit && !glow) {
      glow = this.scene.add.graphics();
      const r = this.plaqueRadius();
      for (let k = 3; k >= 1; k--) glow.fillStyle(hexNumber(SKIN.surface.highlight), 0.14).fillCircle(0, 0, r + k * 5);
      view.addAt(glow, 0);
      this.glows.set(level, glow);
    } else if (!lit && glow) {
      glow.destroy();
      this.glows.delete(level);
    }
    if (level === this.current) return;
    const scale = level === this.pressed ? 0.92 : level === this.hovered ? 1.1 : 1;
    this.scene.tweens.killTweensOf(view);
    if (reducedMotion()) view.setScale(scale);
    else this.scene.tweens.add({ targets: view, scale, duration: DURATION.press, ease: EASE.enter });
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
    if (!reducedMotion()) this.scene.tweens.add({ targets: g, y: -4, duration: 700, yoyo: true, repeat: -1, ease: EASE.loop });
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
