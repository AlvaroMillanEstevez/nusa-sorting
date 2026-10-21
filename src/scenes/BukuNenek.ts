import * as Phaser from 'phaser';
import { ALBUM_PAGES, ALBUM_SIZE, pageOfKind, pageProgress, pageReward, pagesToClaim, type AlbumPage } from '../core/album';
import { BUKU_NENEK } from '../data/bukuNenek';
import type { Reward } from '../data/economy';
import { ITEM_KINDS } from '../data/itemCatalog';
import type { MarketCategory } from '../data/pasaran';
import type { ThemeId } from '../data/themes';
import { getLocale, t } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { DURATION, EASE, hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import { formatScore } from '../ui/format';
import { boosterTextureKey } from './boosterTextures';
import { itemBackTextureKey, itemTextureKey, prepareTypes } from './itemTextures';
import { KitButton, KitIconButton, KitModal, KitPill, kitText, reducedMotion, uiIcon } from './kit';
import { roundRect } from './kit/draw';
import { screenRect, viewSize } from './view';

const DEPTH_BOOK = 300;
const NAV_H = 44;
const FOOTER_H = 56;
const TOTAL_H = 28;

/** A page's title: its food category or its theme. */
const pageTitle = (page: AlbumPage) => (page.kind === 'food' ? t(`album.page.${page.id as MarketCategory}`) : t(`theme.${page.id as ThemeId}`));

/** A kind's name in the player's language, and in the other one. */
function names(kind: string): { mine: string; other: string } {
  const entry = ITEM_KINDS.find((k) => k.id === kind)!;
  const locale = getLocale();
  return { mine: entry.name[locale], other: entry.name[locale === 'id' ? 'en' : 'id'] };
}

/** The page to open on: one waiting for its reward, else the page of the entry found last, else the first. */
function startPage(store: ProgressStore): number {
  const waiting = pagesToClaim(store.album)[0];
  const last = store.album.found.at(-1);
  const page = waiting ?? (last ? pageOfKind(last) : undefined);
  return Math.max(0, page ? ALBUM_PAGES.indexOf(page) : 0);
}

/**
 * Buku Nenek, Grandma's book: a modal with one page at a time (a food category or a theme), turned with the arrows
 * beside its title. Its entries sit in a grid: found ones show their picture and name, the others their dark
 * silhouette. Tapping one found opens its page: the picture, its name in both languages, where it comes from and a
 * short fact. At the foot, what completing the page gives, and the button to collect it once complete. The total
 * found is in the corner (23/81). `onChange` runs after a reward is collected; `onClose` when the book closes.
 */
export function openBukuNenek(scene: Phaser.Scene, store: ProgressStore, sfx: SoundService, onChange: () => void, onClose: () => void): KitModal {
  const screen = screenRect(scene);
  const safe = viewSize(scene);
  // Wide screens put the page's title, arrows and reward in a column beside the entries.
  const wide = safe.width > safe.height * 1.3;
  const w = Math.min(safe.width - SPACE.s * 2, wide ? 700 : 460);
  const h = Math.min(safe.height - SPACE.s * 2, wide ? 520 : 680);
  const modal = new KitModal(scene, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: t('album.title') });
  modal.setPosition(screen.x, screen.y).setDepth(DEPTH_BOOK);
  const panel = modal.panel;
  const inner = w - SPACE.m * 2;
  // The column of the page's title, arrows and reward: the whole width, or beside the entries on a wide screen.
  const side = wide ? Math.min(240, inner * 0.36) : inner;
  const sideX = wide ? -inner / 2 + side / 2 : 0;
  // Under the book's title, everything found of all.
  const totalY = panel.contentTop + TOTAL_H / 2 - SPACE.xs;
  panel.add(new KitPill(scene, sideX, totalY, { skin: SKIN, icon: 'book', value: `${store.album.found.length}/${ALBUM_SIZE}`, height: TOTAL_H }));

  // The page's title (between its arrows, or over them on a wide screen), and the area for the entries (or one
  // entry's page): below, or beside.
  const navY = totalY + TOTAL_H / 2 + SPACE.xs + NAV_H / 2;
  const arrowsY = wide ? navY + NAV_H / 2 + SPACE.s + 22 : navY;
  const arrowsDx = wide ? 22 + SPACE.xs : side / 2 - 22;
  const footerY = h / 2 - SPACE.m - FOOTER_H / 2;
  const area = wide
    ? { x: -inner / 2 + side + SPACE.m, y: panel.contentTop - SPACE.xs, width: inner - side - SPACE.m, height: h / 2 - SPACE.m - (panel.contentTop - SPACE.xs) }
    : { x: -inner / 2, y: navY + NAV_H / 2 + SPACE.xs, width: inner, height: h / 2 - SPACE.m - FOOTER_H - SPACE.xs - (navY + NAV_H / 2 + SPACE.xs) };

  let pageIndex = startPage(store);
  let content: Phaser.GameObjects.GameObject[] = [];
  let drawn = 0;
  const clear = () => {
    for (const part of content) part.destroy();
    content = [];
  };
  const put = <T extends Phaser.GameObjects.GameObject>(part: T): T => {
    panel.add(part);
    content.push(part);
    return part;
  };

  const title = kitText(scene, 'button', '', SKIN.text.primary, 20);
  const count = kitText(scene, 'caption', '', SKIN.text.secondary);
  const prev = new KitIconButton(scene, sideX - arrowsDx, arrowsY, { skin: SKIN, icon: 'back', onPress: () => turn(-1) });
  const next = new KitIconButton(scene, sideX + arrowsDx, arrowsY, { skin: SKIN, icon: 'forward', onPress: () => turn(1) });
  panel.add([title, count, prev, next]);

  function turn(step: number): void {
    pageIndex = (pageIndex + step + ALBUM_PAGES.length) % ALBUM_PAGES.length;
    showPage();
  }

  /** The current page: its title, its entries once their pictures are ready, and its reward. */
  function showPage(): void {
    clear();
    const page = ALBUM_PAGES[pageIndex]!;
    const progress = pageProgress(store.album, page);
    title.setText(pageTitle(page)).setScale(1).setPosition(sideX, navY - 8);
    const room = wide ? side : inner - 2 * (44 + SPACE.xs);
    if (title.width > room) title.setScale(room / title.width);
    count.setText(`${progress.found}/${progress.total}`).setPosition(sideX, navY + 13);
    const loading = put(kitText(scene, 'body', t('album.loading'), SKIN.text.secondary).setPosition(area.x + area.width / 2, area.y + area.height / 2));
    const shown = ++drawn;
    void prepareTypes(scene, page.kinds).then(() => {
      if (!modal.scene || shown !== drawn) return;
      loading.destroy();
      showEntries(page);
    });
    showFooter(page);
  }

  /** The entries in a grid as big as the area allows: three to five across, square cells with the name under. */
  function showEntries(page: AlbumPage): void {
    const n = page.kinds.length;
    let best = { cols: 3, cell: 0 };
    for (let cols = 3; cols <= 5; cols++) {
      const rows = Math.ceil(n / cols);
      const cell = Math.min(area.width / cols, area.height / rows, 120);
      if (cell > best.cell) best = { cols, cell };
    }
    const { cols, cell } = best;
    const rows = Math.ceil(n / cols);
    const top = area.y + (area.height - rows * cell) / 2;
    page.kinds.forEach((kind, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const x = area.x + area.width / 2 + (i % cols) * cell - (inRow * cell) / 2 + cell / 2;
      const y = top + row * cell + cell / 2;
      const found = store.album.found.includes(kind);
      const slot = put(scene.add.graphics());
      slot.fillStyle(hexNumber(SKIN.well), 0.55);
      roundRect(slot, x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, SKIN.chipRadius);
      const picture = cell * (found ? 0.52 : 0.62);
      const image = put(scene.add.image(x, y - (found ? cell * 0.14 : 0), found ? itemTextureKey(kind, false) : itemBackTextureKey(kind)).setDisplaySize(picture, picture));
      if (!found) image.setAlpha(0.75);
      if (found) {
        // The name under the picture, on two lines if it needs them (never shrunk below the 12 px minimum).
        put(kitText(scene, 'caption', names(kind).mine, SKIN.text.primary).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cell - 12).setPosition(x, y + cell * 0.14));
      }
      // The whole cell answers a tap (at least 44 px, as cells are).
      const hit = put(scene.add.zone(x, y, cell - 6, cell - 6).setInteractive({ useHandCursor: found }));
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => (found ? showEntry(kind) : notice(t('album.locked'))));
    });
  }

  /** One entry's page: picture, both names, region and fact, with a button back to the grid. */
  function showEntry(kind: string): void {
    clear();
    sfx.play('pick');
    const entry = BUKU_NENEK[kind]!;
    const locale = getLocale();
    const { mine, other } = names(kind);
    const sideBySide = area.width > area.height * 1.4;
    const picture = Math.min(sideBySide ? area.height * 0.85 : area.height * 0.36, sideBySide ? area.width * 0.36 : 160);
    const textW = sideBySide ? area.width - picture - SPACE.m : area.width;
    const textX = sideBySide ? area.x + picture + SPACE.m + textW / 2 : area.x + area.width / 2;
    const image = put(scene.add.image(sideBySide ? area.x + picture / 2 : area.x + area.width / 2, sideBySide ? area.y + area.height / 2 : area.y + picture / 2, itemTextureKey(kind, false)).setDisplaySize(picture, picture));
    const parts: Phaser.GameObjects.Text[] = [];
    const add = (text: Phaser.GameObjects.Text) => {
      text.setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(textW);
      parts.push(put(text));
    };
    add(kitText(scene, 'title', mine, SKIN.text.primary, 24));
    add(kitText(scene, 'body', other, SKIN.text.secondary, 15));
    if (entry.region) add(kitText(scene, 'label', entry.region[locale].toUpperCase(), SKIN.text.accent));
    add(kitText(scene, 'body', entry.fact[locale], SKIN.text.primary, 15));
    // Stacked from the top of the text column, a little air before the fact; shrunk if it would not fit.
    const gaps = [0, 2, SPACE.xs, SPACE.s];
    const height = parts.reduce((sum, part, i) => sum + part.height + (gaps[i] ?? SPACE.s), 0);
    const room = sideBySide ? area.height : area.height - picture - SPACE.s;
    const k = Math.min(1, room / height);
    let y = sideBySide ? area.y + Math.max(0, (area.height - height * k) / 2) : area.y + picture + SPACE.s;
    parts.forEach((part, i) => {
      y += (gaps[i] ?? SPACE.s) * k;
      part.setScale(k).setPosition(textX, y);
      y += part.height * k;
    });
    if (!reducedMotion()) {
      image.setScale(image.scaleX * 0.9, image.scaleY * 0.9);
      scene.tweens.add({ targets: image, scaleX: image.scaleX / 0.9, scaleY: image.scaleY / 0.9, duration: DURATION.base, ease: EASE.pop });
    }
    put(new KitButton(scene, sideX, footerY, { skin: SKIN, variant: 'secondary', icon: 'back', label: t('album.back'), width: Math.min(side, 240), height: 48, onPress: () => showPage() }));
  }

  /** What completing the page gives, and the button to collect it once complete (or that it was collected). */
  function showFooter(page: AlbumPage): void {
    const progress = pageProgress(store.album, page);
    const reward = pageReward(page);
    if (progress.complete && !progress.claimed) {
      const chip = rewardChip(reward);
      put(
        new KitButton(scene, sideX, footerY, {
          skin: SKIN,
          variant: 'primary',
          label: `${t('album.collect')} ${chip}`,
          icon: reward.kind === 'coins' ? 'coin' : 'bolt',
          width: Math.min(side, 280),
          height: 52,
          onPress: () => {
            if (!store.claimPage(page.id)) return;
            sfx.play('star3');
            // After the press finishes: redrawing destroys this button.
            scene.time.delayedCall(0, () => {
              showPage();
              onChange();
            });
          },
        }),
      );
      return;
    }
    const label = progress.claimed ? t('album.collected') : t('album.reward');
    const text = put(kitText(scene, 'body', label, progress.claimed ? SKIN.text.secondary : SKIN.text.primary, 15).setOrigin(0, 0.5));
    const icon = put(
      progress.claimed
        ? uiIcon(scene, 'check', SKIN.text.secondary, 24)
        : reward.kind === 'coins'
          ? uiIcon(scene, 'coin', SKIN.text.accent, 26)
          : scene.add.image(0, 0, boosterTextureKey(reward.booster)).setDisplaySize(34, 34),
    );
    const amount = progress.claimed ? null : put(kitText(scene, 'number', rewardChip(reward), SKIN.text.accent, 20).setOrigin(0, 0.5));
    const width = text.width + SPACE.xs + (icon.displayWidth ?? 26) + (amount ? 4 + amount.width : 0);
    // On two lines in a narrow column: the label over the reward.
    if (width > side) {
      text.setOrigin(0.5, 0.5).setPosition(sideX, footerY - 14);
      const rowW = icon.displayWidth + (amount ? 4 + amount.width : 0);
      icon.setPosition(sideX - rowW / 2 + icon.displayWidth / 2, footerY + 12);
      amount?.setPosition(sideX - rowW / 2 + icon.displayWidth + 4, footerY + 12);
      return;
    }
    let x = sideX - width / 2;
    text.setPosition(x, footerY);
    x += text.width + SPACE.xs;
    icon.setPosition(x + icon.displayWidth / 2, footerY);
    x += icon.displayWidth + 4;
    amount?.setPosition(x, footerY);
  }

  /** "+40", or "+1 Shuffle" for a booster. */
  function rewardChip(reward: Reward): string {
    const amount = `+${formatScore(reward.amount, getLocale())}`;
    return reward.kind === 'coins' ? amount : `${amount} ${t(`booster.${reward.booster}.name`)}`;
  }

  /** A short notice over the footer, gone after a moment. */
  let label: KitPill | null = null;
  function notice(text: string): void {
    label?.destroy();
    sfx.play('invalid');
    const pill = new KitPill(scene, sideX, footerY - FOOTER_H, { skin: SKIN, value: text, height: 36 });
    if (pill.pillWidth > side) pill.setScale(side / pill.pillWidth);
    panel.add(pill);
    label = pill;
    scene.tweens.add({ targets: pill, alpha: 0, delay: 1400, duration: DURATION.base, ease: EASE.exit, onComplete: () => pill.destroy() });
  }

  panel.add(
    new KitIconButton(scene, w / 2 - 30, -h / 2 + 30, {
      skin: SKIN,
      icon: 'close',
      onPress: () => {
        modal.dismiss();
        onClose();
      },
    }),
  );
  showPage();
  modal.popIn();
  return modal;
}
