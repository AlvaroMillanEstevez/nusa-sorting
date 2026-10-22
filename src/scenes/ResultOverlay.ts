import * as Phaser from 'phaser';
import type { Stars } from '../core';
import { getLocale, t } from '../i18n';
import type { SoundEffect } from '../services/SoundService';
import { DURATION, EASE, SKIN, SPACE, TYPE } from '../ui/design/tokens';
import { formatScore, formatTime } from '../ui/format';
import { KitButton, KitIconButton, KitModal, KitPill, KitStars, kitText, reducedMotion, STAR_STEP_MS, uiIcon } from './kit';
import { kepengTexture } from './MarketLooks';
import { screenRect, viewSize } from './view';

const DEPTH_OVERLAY = 300;
/** When the first star fills, after the panel has popped in. */
const FIRST_STAR_MS = 420;
/** The coins' parts come in one after another, this far apart, once the stars are in. */
const COIN_STEP_MS = 260;
/** The row of coins under the time and best score. */
const COIN_ROW = { tall: 46, wide: 40 };

/** A won level: its stars, score (time bonus included) and buttons. */
export interface WinContent {
  readonly kind: 'won';
  readonly title: string;
  readonly stars: Stars;
  readonly score: number;
  /** Points the time left added, or 0. */
  readonly timeBonus: number;
  readonly timeLeftMs: number | null;
  /** "New best!" or "Best: 1 250", or nothing. */
  readonly bestLine: string | null;
  readonly newBest: boolean;
  /** Coins the win earned, by where they came from (all 0 for none): completing it, its stars, the market day. */
  readonly coins: { readonly level: number; readonly stars: number; readonly market: number };
  /** Goes on: to the map, where the stars land and the next level waits. */
  readonly next: () => void;
  readonly replay: () => void;
}

/** A lost level: why, and buttons to retry or leave. */
export interface LoseContent {
  readonly kind: 'lost';
  readonly title: string;
  readonly hint: string;
  readonly retry: () => void;
  readonly home: () => void;
}

export type ResultContent = WinContent | LoseContent;

/**
 * The end-of-level panel over the dimmed board. A win fills its stars one by one, each with its chime, while the
 * score counts up; a loss says why. The main button works once per showing, so a double tap cannot skip a level.
 */
export class ResultOverlay {
  private modal: KitModal | null = null;
  private content: ResultContent | null = null;
  private pressed = false;
  /** The win panel's buttons, which the victory choreography brings in last. */
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly play: (effect: SoundEffect) => void,
  ) {}

  get visible(): boolean {
    return this.content !== null;
  }

  show(content: ResultContent): void {
    this.content = content;
    this.pressed = false;
    this.build(true);
  }

  hide(): void {
    this.content = null;
    this.modal?.destroy();
    this.modal = null;
  }

  /** Rebuilds for a new screen size (without replaying the entrance). */
  layout(): void {
    if (this.content) this.build(false);
  }

  /** Runs a button's action once per showing (the level list may come back to the panel, so it stays usable). */
  private once(action: () => void, final = true): () => void {
    return () => {
      if (this.pressed) return;
      if (final) this.pressed = true;
      action();
    };
  }

  private build(animate: boolean): void {
    this.modal?.destroy();
    const content = this.content!;
    const screen = screenRect(this.scene);
    const safe = viewSize(this.scene);
    const wide = safe.height < 540;
    const won = content.kind === 'won';
    const panelW = Math.min(safe.width - SPACE.s * 2, wide ? 560 : 360);
    const coinRow = won && coinsTotal(content) > 0 ? (wide ? COIN_ROW.wide : COIN_ROW.tall) : 0;
    const panelH = Math.min(safe.height - SPACE.s * 2, won ? (wide ? 330 : 390) + coinRow : wide ? 280 : 330);
    const modal = new KitModal(this.scene, screen.width, screen.height, { skin: SKIN, width: panelW, height: panelH, title: content.title });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_OVERLAY);
    this.modal = modal;
    if (won) this.buildWin(modal, content, panelW, panelH, wide, animate);
    else this.buildLose(modal, content, panelW, panelH, wide);
    if (animate) modal.popIn();
  }

  private buildWin(modal: KitModal, c: WinContent, w: number, h: number, wide: boolean, animate: boolean): void {
    const panel = modal.panel;
    const inner = w - SPACE.l * 2;
    const top = panel.contentTop;
    const starSize = wide ? 48 : 60;
    const stars = new KitStars(this.scene, 0, top + starSize / 2, SKIN, starSize);
    panel.add(stars);
    const scoreY = top + starSize + 44;
    panel.add(kitText(this.scene, 'label', t('hud.scoreLabel').toUpperCase(), SKIN.text.secondary).setY(scoreY - 26));
    const score = kitText(this.scene, 'hero', formatScore(c.score, getLocale()), SKIN.text.primary, wide ? 34 : TYPE.hero.size).setY(scoreY + 6);
    panel.add(score);

    // Time bonus and best score, side by side.
    const infoY = scoreY + (wide ? 50 : 62);
    const pills: KitPill[] = [];
    if (c.timeBonus > 0) pills.push(new KitPill(this.scene, 0, infoY, { skin: SKIN, icon: 'clock', label: t('result.timeBonus'), value: `+${formatScore(c.timeBonus, getLocale())}`, height: 36 }));
    else if (c.timeLeftMs !== null) pills.push(new KitPill(this.scene, 0, infoY, { skin: SKIN, icon: 'clock', value: formatTime(c.timeLeftMs), height: 36 }));
    if (c.bestLine) pills.push(new KitPill(this.scene, 0, infoY, { skin: SKIN, icon: 'trophy', value: c.bestLine, height: 36, ...(c.newBest ? { tint: SKIN.text.accent } : {}) }));
    const total = pills.reduce((sum, p) => sum + p.pillWidth, 0) + (pills.length - 1) * SPACE.xs;
    let x = -total / 2;
    for (const pill of pills) {
      // Too wide for the panel (long translations): shrink the row to fit.
      const k = total > inner ? inner / total : 1;
      pill.setScale(k).setX((x + pill.pillWidth / 2) * k);
      x += pill.pillWidth + SPACE.xs;
      panel.add(pill);
    }
    const coins = this.coinRow(c, infoY + (wide ? COIN_ROW.wide : COIN_ROW.tall), inner);
    panel.add(coins.parts);

    // One way on (to the map, for the stars to land and the next level), and a replay for more stars.
    const replay = this.once(c.replay);
    const next = this.once(c.next);
    const y = h / 2 - SPACE.m - 30;
    const replaySize = 52;
    const bw = inner - replaySize - SPACE.xs;
    const replayButton = new KitIconButton(this.scene, -inner / 2 + replaySize / 2, y, { skin: SKIN, icon: 'restart', look: 'secondary', size: replaySize, onPress: replay });
    const nextButton = new KitButton(this.scene, inner / 2 - bw / 2, y, { skin: SKIN, variant: 'primary', label: t('result.continue'), icon: 'next', width: bw, onPress: next });
    panel.add([replayButton, nextButton]);
    this.buttons = [replayButton, nextButton];
    void wide;

    if (!animate) {
      stars.setStars(c.stars);
      coins.show(null);
      return;
    }
    // Stars fill one by one with a rising chime; the score counts up meanwhile; the buttons come in last (they
    // work at once all the same, so nobody has to wait).
    stars.fill(c.stars, FIRST_STAR_MS, (n) => this.play(n === 1 ? 'star1' : n === 2 ? 'star2' : 'star3'));
    // Then the coins, part by part; the buttons last.
    const coinsAt = FIRST_STAR_MS + c.stars * STAR_STEP_MS + 120;
    const coinsTime = coins.show(coinsAt);
    for (const [i, button] of this.buttons.entries()) {
      const y = button.y;
      button.setAlpha(0).setY(y + 12);
      this.scene.tweens.add({ targets: button, alpha: 1, y, delay: coinsAt + coinsTime + i * 80, duration: DURATION.base, ease: EASE.enter });
    }
    const counter = { v: 0 };
    score.setText('0');
    this.scene.tweens.add({
      targets: counter,
      v: c.score,
      delay: FIRST_STAR_MS,
      duration: Math.max(DURATION.slow, c.stars * STAR_STEP_MS),
      ease: EASE.enter,
      onUpdate: () => score.setText(formatScore(Math.round(counter.v), getLocale())),
    });
  }

  /**
   * The win's coins: a chip per part (completing the level, its stars, the market day with its kepeng), then the
   * total. `show(at)` brings the parts in one by one from `at` ms, each adding to the total as it lands, and returns
   * how long that takes; `show(null)` shows them all at once (no entrance, or reduce motion). With a single part
   * only the total shows.
   */
  private coinRow(c: WinContent, y: number, inner: number): { parts: Phaser.GameObjects.GameObject[]; show(at: number | null): number } {
    const total = coinsTotal(c);
    if (total === 0) return { parts: [], show: () => 0 };
    const amount = (n: number) => `+${formatScore(n, getLocale())}`;
    const chips: { pill: KitPill; value: number }[] = [];
    const chip = (value: number, options: { icon?: 'check' | 'starFilled'; image?: string; tint?: string }) => {
      if (value > 0) chips.push({ pill: new KitPill(this.scene, 0, y, { skin: SKIN, value: amount(value), height: 32, ...options }), value });
    };
    chip(c.coins.level, { icon: 'check' });
    chip(c.coins.stars, { icon: 'starFilled', tint: SKIN.star.filled });
    chip(c.coins.market, { image: kepengTexture(this.scene.textures) });
    const breakdown = chips.length > 1 ? chips : [];
    const sum = new KitPill(this.scene, 0, y, { skin: SKIN, icon: 'coin', value: amount(total), tint: SKIN.text.accent, height: 36 });
    const arrow = breakdown.length > 0 ? uiIcon(this.scene, 'next', SKIN.text.secondary, 18).setY(y) : null;
    // Laid out in a row (shrunk to fit if a translation runs long): parts, an arrow, the total.
    const widths = [...breakdown.map((b) => b.pill.pillWidth), ...(arrow ? [18] : []), sum.pillWidth];
    const rowW = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * SPACE.xs;
    const k = rowW > inner ? inner / rowW : 1;
    const items: Phaser.GameObjects.Components.Transform[] = [...breakdown.map((b) => b.pill), ...(arrow ? [arrow] : []), sum];
    let x = -rowW / 2;
    items.forEach((item, i) => {
      item.setX((x + widths[i]! / 2) * k);
      if (item !== arrow) item.setScale(k);
      x += widths[i]! + SPACE.xs;
    });
    arrow?.setDisplaySize(18 * k, 18 * k);
    const parts = items as unknown as Phaser.GameObjects.GameObject[];
    return {
      parts,
      show: (at) => {
        if (at === null || reducedMotion() || breakdown.length === 0) {
          if (at !== null && breakdown.length === 0) {
            // A single part: the total pops in after the stars.
            sum.setScale(0.6 * k).setAlpha(0);
            this.scene.tweens.add({ targets: sum, scale: k, alpha: 1, delay: at, duration: DURATION.base, ease: EASE.pop, onStart: () => this.play('starCollect') });
            return DURATION.base;
          }
          return 0;
        }
        // The total starts at nothing and counts up as each part lands.
        let shown = 0;
        sum.setValue(amount(0)).setAlpha(0);
        arrow?.setAlpha(0);
        this.scene.tweens.add({ targets: [sum, arrow].filter(Boolean), alpha: 1, delay: at, duration: DURATION.base, ease: EASE.enter });
        breakdown.forEach(({ pill, value }, i) => {
          pill.setScale(0.6 * k).setAlpha(0);
          this.scene.tweens.add({
            targets: pill,
            scale: k,
            alpha: 1,
            delay: at + i * COIN_STEP_MS,
            duration: DURATION.base,
            ease: EASE.pop,
            onStart: () => this.play('starCollect'),
            onComplete: () => {
              const counter = { v: shown };
              shown += value;
              this.scene.tweens.add({ targets: counter, v: shown, duration: DURATION.fast, ease: EASE.enter, onUpdate: () => sum.setValue(amount(Math.round(counter.v))) });
              this.scene.tweens.add({ targets: sum, scale: k * 1.12, duration: DURATION.press, yoyo: true, ease: EASE.enter });
            },
          });
        });
        return breakdown.length * COIN_STEP_MS + DURATION.base;
      },
    };
  }

  private buildLose(modal: KitModal, c: LoseContent, w: number, h: number, wide: boolean): void {
    const panel = modal.panel;
    const inner = w - SPACE.l * 2;
    const hint = kitText(this.scene, 'body', c.hint, SKIN.text.secondary).setY(panel.contentTop + 18);
    hint.setWordWrapWidth(inner);
    panel.add(hint);
    const retry = this.once(c.retry);
    const home = this.once(c.home);
    if (wide) {
      const bw = (inner - SPACE.s) / 2;
      const y = h / 2 - SPACE.m - 28;
      panel.add(new KitButton(this.scene, -bw / 2 - SPACE.s / 2, y, { skin: SKIN, variant: 'secondary', label: t('pause.home'), icon: 'home', width: bw, height: 56, onPress: home }));
      panel.add(new KitButton(this.scene, bw / 2 + SPACE.s / 2, y, { skin: SKIN, variant: 'primary', label: t('result.retry'), icon: 'restart', width: bw, onPress: retry }));
    } else {
      const y = h / 2 - SPACE.m - 24;
      panel.add(new KitButton(this.scene, 0, y - 56 - SPACE.xs, { skin: SKIN, variant: 'primary', label: t('result.retry'), icon: 'restart', width: inner, onPress: retry }));
      panel.add(new KitButton(this.scene, 0, y, { skin: SKIN, variant: 'secondary', label: t('pause.home'), icon: 'home', width: inner, onPress: home }));
    }
  }
}

/** Every coin a win paid. */
const coinsTotal = (c: WinContent) => c.coins.level + c.coins.stars + c.coins.market;
