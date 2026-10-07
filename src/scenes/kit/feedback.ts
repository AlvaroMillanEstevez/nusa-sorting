/**
 * How the kit tells the player it heard them: a sound on every button press and when panels open and close (and
 * whatever the game adds later). The game wires it once at start (main.ts); until then it does nothing.
 */
export interface KitFeedback {
  press(): void;
  open(): void;
  close(): void;
}

const SILENT: KitFeedback = { press: () => {}, open: () => {}, close: () => {} };
let current: KitFeedback = SILENT;

export function setKitFeedback(feedback: KitFeedback): void {
  current = feedback;
}

export function kitFeedback(): KitFeedback {
  return current;
}
