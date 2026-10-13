import * as Phaser from 'phaser';
import { kitText, loadUiFonts } from '../scenes/kit';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, RENDER_RATIO } from '../scenes/view';
import { WOOD } from '../ui/art/wood';
import { SKIN } from '../ui/design/tokens';
import { renderItemSvg } from '../ui/icons/icons';
import { PILOT_SHEETS_ORDER, pilotImage, pilotKind, pilotTheme } from './artPilot';
import { parseItemType } from '../data/itemCatalog';
import { t, type MessageKey } from '../i18n';

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
    // &set=food,budaya-jawa,… shows only those sections (food, or themes by id); all of them by default.
    const set = new URLSearchParams(window.location.search).get('set')?.split(',') ?? null;
    const section = (object: string) => pilotTheme(object) ?? 'food';
    // Food first, then each theme, in the order sections first appear (fixed drawings come on later sheets).
    const sections = [...new Set(['food', ...PILOT_SHEETS_ORDER.map(section)])];
    const shown = PILOT_SHEETS_ORDER.filter((object) => !set || set.includes(section(object))).sort((a, b) => sections.indexOf(section(a)) - sections.indexOf(section(b)));
    const jobs: Promise<void>[] = [];
    // Drawings of kinds the catalogue does not have (the 17 Agustus bunting) get no current icon.
    const known = (object: string) => parseItemType(pilotKind(object)) !== null;
    for (const object of shown) {
      if (known(object)) for (const size of SIZES) jobs.push(addSvgTexture(this.textures, `now:${object}:${size}`, renderItemSvg(pilotKind(object)), size * ratio));
      for (const view of ['', '-grey', '-deut', '-prot']) this.textures.addImage(`pilot${view}:${object}`, pilotImage(`${object}${view}`)!);
    }
    await Promise.all(jobs);

    const cell = 60;
    const groupW = SIZES.length * cell;
    const groups = [
      { title: 'Now', key: (k: string, s: number) => `now:${k}:${s}` },
      { title: 'Pilot', key: (k: string) => `pilot:${k}` },
      { title: 'Pilot, grey', key: (k: string) => `pilot-grey:${k}` },
      { title: 'Pilot, deuteranopia', key: (k: string) => `pilot-deut:${k}` },
      { title: 'Pilot, protanopia', key: (k: string) => `pilot-prot:${k}` },
    ];
    const left = 130;
    const gap = 16;
    const top = 16;
    groups.forEach((group, gi) => {
      const gx = left + gi * (groupW + gap);
      this.add.existing(kitText(this, 'label', group.title.toUpperCase(), SKIN.text.accent).setOrigin(0, 0).setPosition(gx, top));
      SIZES.forEach((size, si) => {
        this.add.existing(kitText(this, 'caption', `${size} px`, SKIN.text.secondary).setOrigin(0.5, 0).setPosition(gx + si * cell + cell / 2, top + 20));
      });
    });
    // Rows, with a heading where a new section (food, or a theme) starts.
    let y = top + 44;
    let current: string | null = null;
    for (const object of shown) {
      if (section(object) !== current) {
        current = section(object);
        this.add.existing(kitText(this, 'label', current === 'food' ? 'FOOD' : t(`theme.${current}` as MessageKey).toUpperCase(), SKIN.text.primary).setOrigin(0, 0).setPosition(8, y + 4));
        y += 28;
      }
      const cy = y + cell / 2;
      const name = /-\d$/.test(object) ? `${pilotKind(object)} (${object.slice(-1)})` : object;
      this.add.existing(kitText(this, 'caption', name, SKIN.text.primary).setOrigin(1, 0.5).setPosition(left - 8, cy));
      groups.forEach((group, gi) => {
        const gx = left + gi * (groupW + gap);
        SIZES.forEach((size, si) => {
          const cx = gx + si * cell + cell / 2;
          // The shelf's back wall behind each item, as in a level.
          this.add.rectangle(cx, cy, cell - 4, cell - 4, Phaser.Display.Color.HexStringToColor(WOOD.wall).color);
          if (gi === 0 && !known(object)) return;
          this.add.image(cx, cy, group.key(object, size)).setDisplaySize(size, size);
        });
      });
      y += cell;
    }
  }
}
