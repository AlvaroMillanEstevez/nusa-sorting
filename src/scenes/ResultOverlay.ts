import * as Phaser from 'phaser';
import type { Stars } from '../core';
import { getLocale, t } from '../i18n';
import type { SoundEffect } from '../services/SoundService';
import { DURATION, EASE, SKIN, SPACE, TYPE } from '../ui/design/tokens';
import { formatScore, formatTime } from '../ui/format';
import { KitButton, KitIconButton, KitModal, KitPill, KitStars, kitText, STAR_STEP_MS } from './kit';
import { screenRect, viewSize } from './view';

const DEPTH_OVERLAY = 300;
/** When the first star fills, after the panel has popped in. */
const FIRST_STAR_MS = 420;

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
  /** Goes on: to the map, where the stars land and the next level waits. */
  readonly next: () => void;
  readonly replay: () => void;
  /** Development only: lines breaking the score down, and the level's thresholds. */
  readonly breakdown?: readonly string[];
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
    const extra = won ? (content.breakdown?.length ?? 0) * 18 : 0;
    const panelH = Math.min(safe.height - SPACE.s * 2, (won ? (wide ? 330 : 430) : wide ? 280 : 330) + extra);
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

    // Development only: how the score is made, to report real figures.
    (c.breakdown ?? []).forEach((line, i) => {
      const text = kitText(this.scene, 'caption', line, SKIN.text.secondary).setY(infoY + 30 + i * 18);
      if (text.width > inner) text.setScale(inner / text.width);
      panel.add(text);
    });

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
      return;
    }
    // Stars fill one by one with a rising chime; the score counts up meanwhile; the buttons come in last (they
    // work at once all the same, so nobody has to wait).
    stars.fill(c.stars, FIRST_STAR_MS, (n) => this.play(n === 1 ? 'star1' : n === 2 ? 'star2' : 'star3'));
    for (const [i, button] of this.buttons.entries()) {
      const y = button.y;
      button.setAlpha(0).setY(y + 12);
      this.scene.tweens.add({ targets: button, alpha: 1, y, delay: FIRST_STAR_MS + c.stars * STAR_STEP_MS + i * 80, duration: DURATION.base, ease: EASE.enter });
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
