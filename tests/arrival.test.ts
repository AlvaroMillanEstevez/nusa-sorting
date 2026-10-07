import { describe, expect, it } from 'vitest';
import { ArrivalSequence, type ArrivalStage, type ArrivalStep } from '../src/scenes/map/arrival';

/** A step that records what happened to it and resolves when told to. */
function step(name: string, log: string[]): ArrivalStep & { release: () => void } {
  let release = () => {};
  return {
    name,
    play: () => {
      log.push(`play ${name}`);
      return new Promise<void>((resolve) => (release = () => resolve()));
    },
    finish: () => log.push(`finish ${name}`),
    release: () => release(),
  };
}

const stage = {} as ArrivalStage;

describe('arrival sequence', () => {
  it('plays its steps one after another', async () => {
    const log: string[] = [];
    const [a, b] = [step('a', log), step('b', log)];
    const sequence = new ArrivalSequence(stage, [a, b]);
    const done = sequence.run();
    expect(log).toEqual(['play a']);
    a.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(['play a', 'play b']);
    b.release();
    await done;
    expect(sequence.running).toBe(false);
  });

  it('skips to the end state of the current step and every one after it, once', async () => {
    const log: string[] = [];
    const [a, b, c] = [step('a', log), step('b', log), step('c', log)];
    const sequence = new ArrivalSequence(stage, [a, b, c]);
    void sequence.run();
    sequence.skip();
    sequence.skip();
    expect(log).toEqual(['play a', 'finish a', 'finish b', 'finish c']);
    expect(sequence.running).toBe(false);
    a.release();
    await Promise.resolve();
    expect(log).toHaveLength(4);
  });
});
