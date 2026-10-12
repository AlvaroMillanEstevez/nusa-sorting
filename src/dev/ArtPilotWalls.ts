import * as Phaser from 'phaser';
import { kitText, loadUiFonts } from '../scenes/kit';
import { fitCamera, RENDER_RATIO } from '../scenes/view';
import { SKIN } from '../ui/design/tokens';
import { ITEM_FILL } from '../ui/levelLayout';
import pilot from './artpilot/pilot.json';
import { PILOT_WALLS, pilotImage, pilotShelfImage } from './artPilot';

/** The objects that got lost on the dark back wall, and two light ones to check the lighter walls do not hurt them. */
const DEFAULT_OBJECTS = ['peci', 'wayang-kulit', 'pinisi', 'cengkeh', 'komodo', 'congklak', 'kerbau', 'cobek', 'kok', 'bakul'];
const SIZES = [36, 40] as const;
/** What each column tries: a back wall, and the drawings with or without a warm halo behind their outline. */
const COLUMNS: readonly { wall: (typeof PILOT_WALLS)[number]; halo: boolean; title: string }[] = [
  { wall: 'dark', halo: false, title: 'Now (dark)' },
  { wall: 'light', halo: false, title: 'Lighter wall' },
  { wall: 'glow', halo: false, title: 'Warm light' },
  { wall: 'both', halo: false, title: 'Both' },
  { wall: 'dark', halo: true, title: 'Dark + halo' },
];
/** In the drawing's 256 px square, where its foot is (tools/art/prepare_pilot.py: a 10 px bottom margin). */
const FOOT = 246 / 256;

/**
 * Development only (?artpilot=walls, &objects=… to pick them): each object standing in a real compartment of the
 * fitted shelf, with each back wall tried (dark as now, lighter, a warm light behind the item, both) and the dark
 * wall with a warm halo behind each drawing's outline, at the sizes items show at on phones. Real sizes: one
 * world unit is one CSS pixel.
 */
export class ArtPilotWalls extends Phaser.Scene {
  constructor() {
    super('ArtPilotWalls');
  }

  create(): void {
    fitCamera(this);
    this.cameras.main.setZoom(RENDER_RATIO).setScroll(0, 0);
    this.cameras.main.setBackgroundColor(SKIN.backdrop[1]);
    void this.draw();
  }

  private async draw(): Promise<void> {
    await loadUiFonts();
    const picked = new URLSearchParams(window.location.search).get('objects')?.split(',');
    const objects = (picked?.length ? picked : DEFAULT_OBJECTS).filter((o) => pilotImage(o));
    const g = pilot.shelf.geometry;
    const unit = pilot.shelfV2Fit.image[0]! / pilot.shelfV2Fit.units.width;
    const centre = (pilot.shelfV2Fit.units.firstCentre + 1) * unit;
    // The middle compartment, with a little of the dividers either side, from the top beam to the plank.
    const crop = { x: centre - 0.55 * unit, w: 1.1 * unit, h: pilot.shelfV2Fit.image[1]! };
    for (const wall of PILOT_WALLS) {
      const key = `walls:${wall}`;
      this.textures.addImage(key, pilotImage(pilotShelfImage(wall))!);
      this.textures.get(key).add('middle', 0, crop.x, 0, crop.w, crop.h);
    }
    for (const object of objects) {
      this.textures.addImage(`walls:${object}`, pilotImage(object)!);
      this.textures.addImage(`walls:${object}-halo`, pilotImage(`${object}-halo`)!);
    }

    const left = 120;
    const top = 16;
    const slot = SIZES.map((size) => size / ITEM_FILL);
    const cellW = slot.map((s) => 1.1 * s);
    const groupW = cellW.reduce((a, b) => a + b, 0) + 12 * SIZES.length;
    const rowH = Math.max(...slot) * (g.beam + g.slot + g.plank) + 10;
    COLUMNS.forEach(({ wall, halo, title }, wi) => {
      const gx = left + wi * (groupW + 18);
      this.add.existing(kitText(this, 'label', title.toUpperCase(), SKIN.text.accent).setOrigin(0, 0).setPosition(gx, top));
      let x = gx;
      SIZES.forEach((size, si) => {
        this.add.existing(kitText(this, 'caption', `${size} px`, SKIN.text.secondary).setOrigin(0.5, 0).setPosition(x + cellW[si]! / 2, top + 20));
        objects.forEach((object, oi) => {
          const y = top + 44 + oi * rowH;
          const s = slot[si]!;
          const cx = x + cellW[si]! / 2;
          this.add.image(x, y, `walls:${wall}`, 'middle').setOrigin(0).setDisplaySize(cellW[si]!, s * (g.beam + g.slot + g.plank));
          // Standing on the compartment's floor, as in a level.
          this.add.image(cx, y + s * (g.beam + g.slot), `walls:${object}${halo ? '-halo' : ''}`).setOrigin(0.5, FOOT).setDisplaySize(size, size);
          if (wi === 0 && si === 0) this.add.existing(kitText(this, 'caption', object, SKIN.text.primary).setOrigin(1, 0.5).setPosition(left - 10, y + rowH / 2));
        });
        x += cellW[si]! + 12;
      });
    });
  }
}
