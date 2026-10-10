import type * as Phaser from 'phaser';
import { boosterPrice } from '../core/economy';
import { BOOSTER_IDS, ECONOMY, type BoosterId } from '../data/economy';
import { getLocale, t } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { SKIN, SPACE } from '../ui/design/tokens';
import { formatScore } from '../ui/format';
import { boosterTextureKey } from './boosterTextures';
import { KitBoosterButton, KitButton, KitIconButton, KitModal, KitPill, kitText } from './kit';
import { screenRect, viewSize } from './view';

const DEPTH_SHOP = 300;
const ROW = 72;
const TILE_SIZE = 48;

/**
 * The shop: boosters bought with coins, one at a time, and how many the player has of each. Boosters not
 * unlocked yet show the level that brings them. Coins are only earned by playing; nothing costs real money.
 * `onChange` runs after each purchase (for the home screen to refresh its counters); `onClose` when it closes.
 */
export function openShop(
  scene: Phaser.Scene,
  store: ProgressStore,
  sfx: SoundService,
  /** The number of the furthest level the player can play: boosters unlocked by then can be bought. */
  reachedLevel: number,
  onChange: () => void,
  onClose: () => void,
): KitModal {
  const screen = screenRect(scene);
  const safe = viewSize(scene);
  const w = Math.min(safe.width - SPACE.s * 2, 380);
  const h = Math.min(safe.height - SPACE.s * 2, 170 + BOOSTER_IDS.length * ROW);
  const modal = new KitModal(scene, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: t('shop.title') });
  modal.setPosition(screen.x, screen.y).setDepth(DEPTH_SHOP);
  const panel = modal.panel;
  const inner = w - SPACE.l * 2;
  const top = panel.contentTop;
  const coins = new KitPill(scene, 0, top + 20, { skin: SKIN, icon: 'coin', value: '', tint: SKIN.text.accent, height: 36, width: 120 });
  panel.add(coins);

  let rowParts: Phaser.GameObjects.GameObject[] = [];
  const drawRows = () => {
    for (const part of rowParts) part.destroy();
    rowParts = [];
    const wallet = store.wallet;
    coins.setValue(formatScore(wallet.coins, getLocale()));
    BOOSTER_IDS.forEach((id: BoosterId, i) => {
      const y = top + 48 + ROW / 2 + i * ROW;
      const unlocked = reachedLevel >= ECONOMY.boosters[id].unlockLevel;
      const have = wallet.boosters[id];
      // The same tile as in the game's bar, showing only: count, "+" or padlock.
      const icon = new KitBoosterButton(scene, -inner / 2 + TILE_SIZE / 2, y, {
        texture: boosterTextureKey(id),
        size: TILE_SIZE,
        state: !unlocked ? 'locked' : have > 0 ? 'ready' : 'empty',
        count: have,
      });
      const textX = -inner / 2 + TILE_SIZE + SPACE.s;
      const name = kitText(scene, 'body', t(`booster.${id}.name`), SKIN.text.primary).setOrigin(0, 0.5).setPosition(textX, y - 10);
      const note = kitText(scene, 'caption', unlocked ? t('shop.have', { n: wallet.boosters[id] }) : t('shop.unlocksAt', { n: ECONOMY.boosters[id].unlockLevel }), SKIN.text.secondary)
        .setOrigin(0, 0.5)
        .setPosition(textX, y + 12);
      const price = boosterPrice(id);
      const buy = new KitButton(scene, inner / 2 - 60, y, {
        skin: SKIN,
        variant: 'primary',
        label: formatScore(price, getLocale()),
        icon: 'coin',
        width: 120,
        height: 48,
        onPress: () => {
          if (!store.buyBooster(id)) return;
          sfx.play('unlock');
          // After the press finishes: redrawing destroys this button.
          scene.time.delayedCall(0, () => {
            drawRows();
            onChange();
          });
        },
      }).setDisabled(!unlocked || wallet.coins < price);
      // Long names shrink to fit beside the button.
      const room = inner - TILE_SIZE - SPACE.s - 120 - SPACE.s;
      if (name.width > room) name.setScale(Math.max(0.75, room / name.width));
      const parts = [icon, name, note, buy];
      panel.add(parts);
      rowParts.push(...parts);
    });
  };
  drawRows();

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
  modal.popIn();
  return modal;
}
