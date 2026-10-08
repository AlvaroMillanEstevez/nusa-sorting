/**
 * Reduce motion (a setting, on by default when the system asks for it): screen shakes and looping or bouncing
 * animations are left out; what moves to explain something (items, the tutorial's hand) still moves.
 */
let reduced = false;

export function setReducedMotion(on: boolean): void {
  reduced = on;
}

export function reducedMotion(): boolean {
  return reduced;
}
