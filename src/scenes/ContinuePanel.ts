import type * as Phaser from 'phaser';
import type { BoosterId } from '../data/economy';
import { getLocale, t } from '../i18n';
import { SKIN, SPACE } from '../ui/design/tokens';
import { formatScore } from '../ui/format';
import { boosterTextureKey } from './boosterTextures';
import { KitBoosterButton, KitButton, KitModal, KitPill, kitText, uiIconKey } from './kit';
import { screenRect, viewSize } from './view';

const DEPTH_CONTINUE = 310;
const ROW = 76;
const TILE = 56;
const ACTION_W = 132;

/**
 * A way to continue the level: a booster (used from the player's own, or bought at its shop price and used at
 * once), or more time bought with coins.
 */
export type ContinueChoice =
  | {
      readonly kind: 'booster';
      readonly booster: BoosterId;
      /** How many the player has: using one spends it. */
      readonly have: number;
      /** Its shop price, paid to buy one and use it at once when the player has none. */
      readonly price: number;
      readonly onUse: () => void;
    }
  | {
      readonly kind: 'time';
      readonly seconds: number;
      /** What these seconds cost now (dearer with each continue in the attempt). */
      readonly price: number;
      readonly onUse: () => void;
    };

export interface ContinueOptions {
  /** Why the level was lost: "Time's up!", "No space left!", "No moves left!". */
  readonly title: string;
  readonly body: string;
  readonly coins: number;
  readonly choices: readonly ContinueChoice[];
  readonly onGiveUp: () => void;
}

/**
 * Continuing after a defeat. Out of space or stuck: the boosters that fit, as the same tiles as the game's bar
 * (with the count, or a "+" when none is left), each with its button: use one, or buy one at its shop price and use
 * it at once. Out of time: the clock on the same tile, and more seconds for coins. Without the coins for it a
 * button is off and says so. Giving up is a button as big as any other, at the bottom.
 */
export function showContinue(scene: Phaser.Scene, options: ContinueOptions): KitModal {
  const screen = screenRect(scene);
  const safe = viewSize(scene);
  const w = Math.min(safe.width - SPACE.s * 2, 380);
  const inner = w - SPACE.l * 2;
  const body = kitText(scene, 'body', options.body, SKIN.text.secondary).setWordWrapWidth(inner);
  const bodyH = body.height + 12;
  const coinsH = 46;
  const core = 136 + options.choices.length * ROW + 56 + SPACE.xs;
  const room = safe.height - SPACE.s * 2;
  // On a phone held sideways the line of text, then the coins, give way to the boosters.
  const showBody = core + bodyH <= room;
  const showCoins = core + (showBody ? bodyH : 0) + coinsH <= room;
  const h = Math.min(room, core + (showBody ? bodyH : 0) + (showCoins ? coinsH : 0));
  if (!showBody) body.destroy();

  const modal = new KitModal(scene, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: options.title });
  modal.setPosition(screen.x, screen.y).setDepth(DEPTH_CONTINUE);
  const panel = modal.panel;
  let y = panel.contentTop + 4;
  if (showBody) {
    panel.add(body.setY(y + bodyH / 2 - 4));
    y += bodyH;
  }
  if (showCoins) {
    panel.add(new KitPill(scene, 0, y + 20, { skin: SKIN, icon: 'coin', value: formatScore(options.coins, getLocale()), tint: SKIN.text.accent, height: 36 }));
    y += coinsH;
  }
  const close = (action: () => void) => () => {
    modal.destroy();
    action();
  };

  options.choices.forEach((choice, i) => {
    const rowY = y + ROW / 2 + i * ROW;
    const owned = choice.kind === 'booster' && choice.have > 0;
    const affordable = owned || options.coins >= choice.price;
    panel.add(
      choice.kind === 'booster'
        ? new KitBoosterButton(scene, -inner / 2 + TILE / 2, rowY, {
            texture: boosterTextureKey(choice.booster),
            size: TILE,
            state: owned ? 'ready' : 'empty',
            count: choice.have,
          })
        : new KitBoosterButton(scene, -inner / 2 + TILE / 2, rowY, {
            texture: uiIconKey('clock', SKIN.text.accent),
            size: TILE,
            state: 'ready',
            count: 0,
            badge: false,
          }),
    );
    const textX = -inner / 2 + TILE + SPACE.s;
    const label = choice.kind === 'booster' ? t(`booster.${choice.booster}.name`) : t('continue.time.name', { s: choice.seconds });
    const name = kitText(scene, 'body', label, SKIN.text.primary).setOrigin(0, 0.5).setPosition(textX, rowY - 10);
    const note = !affordable
      ? t('booster.notEnough')
      : choice.kind === 'time'
        ? t('continue.time.note')
        : owned
          ? t('shop.have', { n: choice.have })
          : t('continue.buyAndUse');
    const caption = kitText(scene, 'caption', note, affordable ? SKIN.text.secondary : SKIN.status.criticalTime).setOrigin(0, 0.5).setPosition(textX, rowY + 12);
    const textRoom = inner - TILE - SPACE.s - ACTION_W - SPACE.s;
    if (name.width > textRoom) name.setScale(Math.max(0.7, textRoom / name.width));
    if (caption.width > textRoom) caption.setScale(Math.max(0.7, textRoom / caption.width));
    const action = new KitButton(scene, inner / 2 - ACTION_W / 2, rowY, {
      skin: SKIN,
      variant: 'primary',
      label: owned ? t('continue.use') : formatScore(choice.price, getLocale()),
      ...(owned ? {} : { icon: 'coin' as const }),
      width: ACTION_W,
      height: 52,
      onPress: close(choice.onUse),
    }).setDisabled(!affordable);
    panel.add([name, caption, action]);
  });

  panel.add(
    new KitButton(scene, 0, h / 2 - SPACE.m - 28, {
      skin: SKIN,
      variant: 'secondary',
      label: t('offer.giveUp'),
      width: inner,
      height: 56,
      onPress: close(options.onGiveUp),
    }),
  );
  modal.popIn();
  return modal;
}
