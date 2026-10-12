import * as Phaser from 'phaser';
import { kitText, loadUiFonts } from '../scenes/kit';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, pixelRatio, viewSize } from '../scenes/view';
import { WOOD } from '../ui/art/wood';
import { SKIN } from '../ui/design/tokens';
import { simulateSvg } from '../ui/icons/color';
import { renderItemSvg } from '../ui/icons/icons';
import { PILOT_OBJECTS, pilotImage } from './artPilot';

/** The sizes items show at: phones' smallest, a common one, a desktop window's. */
const SIZES = [36, 40, 52] as const;

/**
 * Development only (?artpilot=gallery): the pilot's illustrated objects next to the game's current icons of the
 * same kinds, at the sizes items show at, in colour and in greyscale, each on the shelf's dark back wall.
 */
export class ArtPilotGallery extends Phaser.Scene {
  constructor() {
    super('ArtPilotGallery');
  }

  create(): void {
    fitCamera(this);
    this.cameras.main.setBackgroundColor(SKIN.backdrop[1]);
    void this.draw();
  }

  private async draw(): Promise<void> {
    const ratio = pixelRatio();
    await loadUiFonts();
    const jobs: Promise<void>[] = [];
    for (const kind of PILOT_OBJECTS) {
      for (const size of SIZES) {
        const svg = renderItemSvg(kind);
        jobs.push(addSvgTexture(this.textures, `now:${kind}:${size}`, svg, size * ratio));
        jobs.push(addSvgTexture(this.textures, `nowgrey:${kind}:${size}`, simulateSvg(svg, 'grayscale'), size * ratio));
      }
      this.textures.addImage(`pilot:${kind}`, pilotImage(kind)!);
      this.textures.addImage(`pilotgrey:${kind}`, pilotImage(`${kind}-grey`)!);
    }
    await Promise.all(jobs);

    const { width } = viewSize(this);
    const cell = 60;
    const groupW = SIZES.length * cell;
    const groups = [
      { title: 'Now', key: (k: string, s: number) => `now:${k}:${s}` },
      { title: 'Pilot', key: (k: string) => `pilot:${k}` },
      { title: 'Now, grey', key: (k: string, s: number) => `nowgrey:${k}:${s}` },
      { title: 'Pilot, grey', key: (k: string) => `pilotgrey:${k}` },
    ];
    const left = 110;
    const gap = 16;
    const perRow = Math.max(1, Math.floor((width - left) / (groupW + gap)));
    const blockH = 40 + PILOT_OBJECTS.length * cell;
    groups.forEach((group, gi) => {
      const gx = left + (gi % perRow) * (groupW + gap);
      const gy = 16 + Math.floor(gi / perRow) * (blockH + 24);
      this.add.existing(kitText(this, 'label', group.title.toUpperCase(), SKIN.text.accent).setOrigin(0, 0).setPosition(gx, gy));
      SIZES.forEach((size, si) => {
        this.add.existing(kitText(this, 'caption', `${size} px`, SKIN.text.secondary).setOrigin(0.5, 0).setPosition(gx + si * cell + cell / 2, gy + 20));
      });
      PILOT_OBJECTS.forEach((kind, ki) => {
        const cy = gy + 40 + ki * cell + cell / 2;
        if (gi % perRow === 0) this.add.existing(kitText(this, 'caption', kind, SKIN.text.primary).setOrigin(1, 0.5).setPosition(gx - 8, cy));
        SIZES.forEach((size, si) => {
          const cx = gx + si * cell + cell / 2;
          // The shelf's back wall behind each item, as in a level.
          this.add.rectangle(cx, cy, cell - 4, cell - 4, Phaser.Display.Color.HexStringToColor(WOOD.wall).color);
          this.add.image(cx, cy, group.key(kind, size)).setDisplaySize(size, size);
        });
      });
    });
  }
}
