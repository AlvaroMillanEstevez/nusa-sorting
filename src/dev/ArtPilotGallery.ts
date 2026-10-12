import * as Phaser from 'phaser';
import { kitText, loadUiFonts } from '../scenes/kit';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, RENDER_RATIO } from '../scenes/view';
import { WOOD } from '../ui/art/wood';
import { SKIN } from '../ui/design/tokens';
import { renderItemSvg } from '../ui/icons/icons';
import { PILOT_SHEETS_ORDER, pilotImage, pilotKind } from './artPilot';

/** The sizes items show at: phones' smallest, a common one, a desktop window's. */
const SIZES = [36, 40, 52] as const;

/**
 * Development only (?artpilot=gallery): every illustrated object of the pilot, sheet by sheet (kinds drawn again
 * are marked "(2)", "(3)"), next to the game's current icon of the same kind, at the sizes items show at: in
 * colour, in greyscale and as players with deuteranopia and protanopia see them, each on the shelf's dark back
 * wall.
 */
export class ArtPilotGallery extends Phaser.Scene {
  constructor() {
    super('ArtPilotGallery');
  }

  create(): void {
    fitCamera(this);
    // Real sizes: one world unit is one CSS pixel here, whatever the window (no desktop interface scale).
    this.cameras.main.setZoom(RENDER_RATIO).setScroll(0, 0);
    this.cameras.main.setBackgroundColor(SKIN.backdrop[1]);
    void this.draw();
  }

  private async draw(): Promise<void> {
    const ratio = RENDER_RATIO;
    await loadUiFonts();
    const jobs: Promise<void>[] = [];
    for (const object of PILOT_SHEETS_ORDER) {
      for (const size of SIZES) jobs.push(addSvgTexture(this.textures, `now:${object}:${size}`, renderItemSvg(pilotKind(object)), size * ratio));
      for (const view of ['', '-grey', '-deut', '-prot']) this.textures.addImage(`pilot${view}:${object}`, pilotImage(`${object}${view}`)!);
    }
    await Promise.all(jobs);

    const width = this.scale.gameSize.width / RENDER_RATIO;
    const cell = 60;
    const groupW = SIZES.length * cell;
    const groups = [
      { title: 'Now', key: (k: string, s: number) => `now:${k}:${s}` },
      { title: 'Pilot', key: (k: string) => `pilot:${k}` },
      { title: 'Pilot, grey', key: (k: string) => `pilot-grey:${k}` },
      { title: 'Pilot, deuteranopia', key: (k: string) => `pilot-deut:${k}` },
      { title: 'Pilot, protanopia', key: (k: string) => `pilot-prot:${k}` },
    ];
    const left = 110;
    const gap = 16;
    const perRow = Math.max(1, Math.floor((width - left) / (groupW + gap)));
    const blockH = 40 + PILOT_SHEETS_ORDER.length * cell;
    groups.forEach((group, gi) => {
      const gx = left + (gi % perRow) * (groupW + gap);
      const gy = 16 + Math.floor(gi / perRow) * (blockH + 24);
      this.add.existing(kitText(this, 'label', group.title.toUpperCase(), SKIN.text.accent).setOrigin(0, 0).setPosition(gx, gy));
      SIZES.forEach((size, si) => {
        this.add.existing(kitText(this, 'caption', `${size} px`, SKIN.text.secondary).setOrigin(0.5, 0).setPosition(gx + si * cell + cell / 2, gy + 20));
      });
      PILOT_SHEETS_ORDER.forEach((kind, ki) => {
        const cy = gy + 40 + ki * cell + cell / 2;
        if (gi % perRow === 0) this.add.existing(kitText(this, 'caption', /-\d$/.test(kind) ? `${pilotKind(kind)} (${kind.slice(-1)})` : kind, SKIN.text.primary).setOrigin(1, 0.5).setPosition(gx - 8, cy));
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
