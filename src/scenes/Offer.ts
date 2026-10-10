import type * as Phaser from 'phaser';
import { getLocale } from '../i18n';
import { SKIN, SPACE } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { formatScore } from '../ui/format';
import { KitButton, KitModal, KitPill, kitText, uiIcon } from './kit';
import { screenRect, viewSize } from './view';

const DEPTH_OFFER = 310;

export interface OfferOptions {
  readonly title: string;
  readonly body?: string;
  /** A big icon over the text (the clock...), or `image`: a texture instead (a booster's colour icon). */
  readonly icon?: UiIconName;
  readonly image?: string;
  /** The player's coins, shown under the title when the offer costs coins. */
  readonly coins?: number;
  readonly accept: OfferChoice | null;
  /** A second way to accept (continuing when stuck: remove a triple, or shuffle), under the first. */
  readonly alternative?: OfferChoice;
  readonly decline: { readonly label: string; readonly onPress: () => void };
}

export interface OfferChoice {
  readonly label: string;
  /** Coins it costs (shown on the button with a coin), or none. */
  readonly price?: number;
  readonly onPress: () => void;
}

/**
 * An offer: buy a booster, continue after a defeat. Accepting (one or two ways) and declining are one over the other
 * and the same size, so saying no is always as easy as saying yes. With no accept button (not enough coins), only
 * the decline one.
 */
export function showOffer(scene: Phaser.Scene, options: OfferOptions): KitModal {
  const screen = screenRect(scene);
  const safe = viewSize(scene);
  const w = Math.min(safe.width - SPACE.s * 2, 380);
  const inner = w - SPACE.l * 2;
  // The text first, to know how tall it is once wrapped.
  const body = options.body ? kitText(scene, 'body', options.body, SKIN.text.secondary).setWordWrapWidth(inner) : null;
  const bodyH = body ? Math.max(28, body.height + 8) : 0;
  const choices = [options.accept, options.alternative].filter((choice): choice is OfferChoice => Boolean(choice));
  const fixed = 200 + choices.length * 64 + bodyH + (options.coins !== undefined ? 46 : 0);
  // The icon only where it fits (not on a phone held sideways).
  const showIcon = (options.icon !== undefined || options.image !== undefined) && fixed + 64 <= safe.height - SPACE.s * 2;
  const h = fixed + (showIcon ? 64 : 0);
  const modal = new KitModal(scene, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: options.title });
  modal.setPosition(screen.x, screen.y).setDepth(DEPTH_OFFER);
  const panel = modal.panel;
  let y = panel.contentTop + 8;
  if (showIcon) {
    if (options.image) panel.add(scene.add.image(0, y + 28, options.image).setDisplaySize(64, 64));
    else if (options.icon) panel.add(uiIcon(scene, options.icon, SKIN.text.accent, 52).setY(y + 26));
    y += 64;
  }
  if (body) {
    panel.add(body.setY(y + bodyH / 2 - 4));
    y += bodyH;
  }
  if (options.coins !== undefined) {
    panel.add(new KitPill(scene, 0, y + 26, { skin: SKIN, icon: 'coin', value: formatScore(options.coins, getLocale()), tint: SKIN.text.accent, height: 36 }));
  }
  const by = h / 2 - SPACE.m - 30;
  const close = (action: () => void) => () => {
    modal.destroy();
    action();
  };
  // The ways to accept, top down, then declining at the bottom: all the same size.
  choices.forEach(({ label, price, onPress }, i) => {
    const text = price === undefined ? label : `${label} · ${formatScore(price, getLocale())}`;
    const y = by - (choices.length - i) * (56 + SPACE.xs);
    panel.add(new KitButton(scene, 0, y, { skin: SKIN, variant: 'primary', label: text, ...(price === undefined ? {} : { icon: 'coin' as const }), width: inner, height: 56, onPress: close(onPress) }));
  });
  panel.add(new KitButton(scene, 0, by, { skin: SKIN, variant: 'secondary', label: options.decline.label, width: inner, height: 56, onPress: close(options.decline.onPress) }));
  modal.popIn();
  return modal;
}
