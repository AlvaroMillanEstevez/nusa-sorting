import { describe, expect, it } from "vitest";
import {
  createGame,
  dropHeld,
  freshOf,
  isBlocked,
  canProgress,
  LevelError,
  moveItem,
  pickFromTrack,
  removeTriple,
  restoreSnapshot,
  takeSnapshot,
  type GameEvent,
  type GameState,
  type LevelDefinition,
  type MoveResult,
} from "../src/core";
import { front } from "./helpers";
import { demoLevels } from "./fixtures/demo-levels";
import { parseItemType } from "../src/data/itemCatalog";
import {
  buildCandidate,
  freshInView,
  rearrange,
  TYPICAL_MOVES_PER_ITEM,
  withFresh,
} from "../tools/levelgen/generate";
import { itemCount } from "../tools/levelgen/report";
import type { LevelRecipe } from "../tools/levelgen/recipe";
import { recipeFor } from "../tools/levelgen/recipes";
import { rng } from "../tools/simulator";

const ok = (
  result: MoveResult,
): { state: GameState; events: readonly GameEvent[] } => {
  if (!result.ok) throw new Error(`unexpected invalid move: ${result.reason}`);
  return result;
};

/** S0 [A A .]  S1 [A B .]  S2 [B B .]  S3 [. C .] with [C C .] behind: A is fresh with `moves` moves, B is not. */
const level = (
  moves: number,
  extra: Partial<LevelDefinition> = {},
): LevelDefinition => ({
  id: "fresh",
  shelves: [
    [["A", "A", null]],
    [["A", "B", null]],
    [["B", "B", null]],
    [
      [null, "C", null],
      ["C", "C", null],
    ],
  ],
  mechanics: [{ kind: "fresh", foods: [{ type: "A", moves }] }],
  ...extra,
});

describe('fresh foods ("basi")', () => {
  it("counts down one per player move and spoils every item of the type at 0", () => {
    let state = createGame(level(3));
    expect(freshOf(state, "A")).toEqual({
      type: "A",
      movesLeft: 3,
      spoiled: false,
    });
    expect(freshOf(state, "B")).toBeUndefined();
    state = ok(moveItem(state, front(2, 0), front(3, 0))).state;
    state = ok(moveItem(state, front(3, 0), front(2, 0))).state;
    expect(freshOf(state, "A")!.movesLeft).toBe(1);
    const spoiled = ok(moveItem(state, front(2, 0), front(3, 0)));
    expect(freshOf(spoiled.state, "A")).toEqual({
      type: "A",
      movesLeft: 0,
      spoiled: true,
    });
    expect(spoiled.events).toContainEqual({ kind: "spoiled", itemType: "A" });
  });

  it("scores a fresh triple with a bonus of half a triple, even on its very last move", () => {
    const state = createGame(level(3));
    const won = ok(moveItem(state, front(1, 0), front(0, 2)));
    const triple = won.events.find((e) => e.kind === "tripleCleared");
    expect(triple).toMatchObject({ itemType: "A", freshness: "fresh" });
    expect(won.state.combo.score).toBe(150);
    // With one move left, the move that makes the triple still finds it fresh.
    let last = createGame(level(3));
    last = ok(moveItem(last, front(2, 0), front(3, 0))).state;
    last = ok(moveItem(last, front(3, 0), front(2, 0))).state;
    const onTime = ok(moveItem(last, front(1, 0), front(0, 2)));
    expect(onTime.events.find((e) => e.kind === "tripleCleared")).toMatchObject(
      { freshness: "fresh" },
    );
    expect(onTime.events.some((e) => e.kind === "spoiled")).toBe(false);
  });

  it("still clears a spoiled triple, for no points, and breaks the combo", () => {
    let state = createGame(level(3));
    // B first: a combo of 1 and 100 points.
    state = ok(moveItem(state, front(1, 1), front(2, 2))).state;
    expect(state.combo.score).toBe(100);
    expect(state.combo.combo).toBe(1);
    state = ok(moveItem(state, front(3, 1), front(2, 0))).state;
    state = ok(moveItem(state, front(2, 0), front(2, 1))).state;
    expect(freshOf(state, "A")!.spoiled).toBe(true);
    const thrown = ok(moveItem(state, front(1, 0), front(0, 2)));
    expect(thrown.events.find((e) => e.kind === "tripleCleared")).toMatchObject(
      { itemType: "A", freshness: "spoiled" },
    );
    expect(thrown.state.combo.score).toBe(100);
    expect(thrown.state.combo.combo).toBe(0);
    expect(thrown.events).toContainEqual({
      kind: "comboChanged",
      combo: 0,
      windowMs: 0,
    });
    // It still counts for locks and the blocker.
    expect(thrown.state.triplesCleared).toBe(2);
  });

  it("stops counting once the type is gone, and does not count boosters as moves", () => {
    let state = createGame(level(4));
    state = ok(moveItem(state, front(1, 0), front(0, 2))).state;
    const left = freshOf(state, "A")!.movesLeft;
    state = ok(moveItem(state, front(2, 0), front(1, 0))).state;
    expect(freshOf(state, "A")!.movesLeft).toBe(left);
    const boosted = ok(removeTriple(createGame(level(4)), front(2, 0)));
    expect(freshOf(boosted.state, "A")!.movesLeft).toBe(4);
  });

  it("removes a fresh or a spoiled triple with the booster, scoring nothing either way", () => {
    const fresh = ok(removeTriple(createGame(level(3)), front(0, 0)));
    expect(fresh.events.find((e) => e.kind === "tripleCleared")).toMatchObject({
      byBooster: true,
      freshness: "fresh",
    });
    expect(fresh.state.combo.score).toBe(0);
    let state = createGame(level(3));
    for (const [from, to] of [
      [front(2, 0), front(3, 0)],
      [front(3, 0), front(2, 0)],
      [front(2, 0), front(3, 0)],
    ] as const)
      state = ok(moveItem(state, from, to)).state;
    const spoiled = ok(removeTriple(state, front(0, 0)));
    expect(
      spoiled.events.find((e) => e.kind === "tripleCleared"),
    ).toMatchObject({ byBooster: true, freshness: "spoiled" });
    expect(spoiled.state.combo.score).toBe(0);
  });

  it("spoils items wherever they are, in back layers and track stacks, and counts a track move as one move", () => {
    const withTrack = createGame({
      id: "fresh-track",
      shelves: [
        [["B", "B", null]],
        [
          ["C", null, null],
          ["A", "C", "C"],
        ],
        [[null, null, "A"]],
      ],
      mechanics: [
        { kind: "fresh", foods: [{ type: "A", moves: 3 }] },
        {
          kind: "tracks",
          tracks: [
            { orientation: "horizontal", speed: 1, carriers: [["B"], ["A"]] },
          ],
        },
      ],
    });
    const picked = ok(pickFromTrack(withTrack, { track: 0, carrier: 0 }));
    expect(freshOf(picked.state, "A")!.movesLeft).toBe(3);
    const dropped = ok(dropHeld(picked.state, front(0, 2)));
    expect(freshOf(dropped.state, "A")!.movesLeft).toBe(2);
    // Nothing blocks or gets stuck because of it.
    expect(isBlocked(dropped.state)).toBe(false);
    expect(canProgress(dropped.state)).toBe(true);
  });

  it("is part of the snapshot: countdowns and spoiled types come back, and a forged countdown is refused", () => {
    const def = level(5);
    let state = createGame(def);
    state = ok(moveItem(state, front(2, 0), front(3, 0))).state;
    state = ok(moveItem(state, front(3, 0), front(2, 0))).state;
    const attempt = {
      continuesUsed: 0,
      boostersUsed: { freeze: 0, removeTriple: 0, shuffle: 0 },
    };
    const snapshot = JSON.parse(
      JSON.stringify(takeSnapshot(def, 0, state, attempt)),
    );
    expect(restoreSnapshot(snapshot, def)?.state.fresh).toEqual([
      { type: "A", movesLeft: 3, spoiled: false },
    ]);
    expect(
      restoreSnapshot(
        {
          ...snapshot,
          state: {
            ...snapshot.state,
            fresh: [{ type: "A", movesLeft: 9, spoiled: false }],
          },
        },
        def,
      ),
    ).toBeNull();
    expect(
      restoreSnapshot(
        { ...snapshot, state: { ...snapshot.state, fresh: [] } },
        def,
      ),
    ).toBeNull();
  });

  it("checks its foods: in the level, once each, with a sensible countdown", () => {
    expect(() => createGame(level(2))).toThrow(LevelError);
    expect(() =>
      createGame({
        ...level(5),
        mechanics: [{ kind: "fresh", foods: [{ type: "Z", moves: 5 }] }],
      }),
    ).toThrow(/not in the level/);
    expect(() =>
      createGame({
        ...level(5),
        mechanics: [
          {
            kind: "fresh",
            foods: [
              { type: "A", moves: 5 },
              { type: "A", moves: 6 },
            ],
          },
        ],
      }),
    ).toThrow(/twice/);
  });
});

describe("fresh foods in level data", () => {
  it("are always food in the demos, never cultural objects", () => {
    for (const level of demoLevels) {
      for (const mechanic of level.mechanics ?? []) {
        if (mechanic.kind !== "fresh") continue;
        for (const { type } of mechanic.foods)
          expect(
            parseItemType(type)?.kind.category,
            `${level.id} ${type}`,
          ).not.toBe("cultural");
      }
    }
  });

  it("come from recipes: foods only, countdowns as shares of a typical game, on the board as it was", () => {
    // A themed level's recipe (it has cultural objects) with back layers; fresh foods go on a board found without them.
    const random = rng(4);
    const valid = (b: LevelDefinition) => {
      try {
        createGame(b);
        return true;
      } catch {
        return false;
      }
    };
    const fits = (b: LevelDefinition | null) =>
      b !== null &&
      valid(b) &&
      withFresh(
        b,
        { ...recipeFor(10), fresh: { shares: [0.5, 1], inFront: 2 } },
        7,
        0,
      ) !== null;
    let board: LevelDefinition | null = null;
    for (let i = 0; i < 500 && !fits(board); i++)
      board = buildCandidate(recipeFor(10), random);
    const generate = (fresh: NonNullable<LevelRecipe["fresh"]>, pick = 0) => {
      const recipe = { ...recipeFor(10), fresh };
      const level = withFresh(board!, recipe, 7, pick);
      const mechanic = level?.mechanics!.find((m) => m.kind === "fresh");
      return {
        level,
        recipe,
        foods: mechanic?.kind === "fresh" ? mechanic.foods : [],
      };
    };
    const { level, recipe, foods } = generate({ shares: [0.5, 1], inFront: 2 });
    const items = itemCount(level!);
    expect(foods.map((f) => f.moves)).toEqual([
      Math.round(0.5 * items * TYPICAL_MOVES_PER_ITEM),
      Math.round(items * TYPICAL_MOVES_PER_ITEM),
    ]);
    // Later picks stretch the countdowns.
    expect(
      generate({ shares: [0.5, 1], inFront: 2 }, 6).foods.map((f) => f.moves),
    ).toEqual([Math.round(0.65 * items), Math.round(1.3 * items)]);
    for (const { type } of foods)
      expect(parseItemType(type)?.kind.category).not.toBe("cultural");
    // The board is untouched, and each fresh food has at least two copies in a front.
    expect(level!.shelves).toEqual(board!.shelves);
    const state = createGame(level!);
    const inFront = (s: GameState, type: string) =>
      s.shelves
        .flatMap((shelf) => shelf.layers[0]!)
        .filter((item) => item?.type === type).length;
    for (const { type } of foods)
      expect(inFront(state, type)).toBeGreaterThanOrEqual(2);
    // Reshuffles keep them where they are.
    const fresh = new Set(foods.map((f) => f.type));
    const places = (l: LevelDefinition) =>
      JSON.stringify(
        l.shelves.map((layers) =>
          layers.map((slots) =>
            slots.map((t) => (t !== null && fresh.has(t) ? t : "")),
          ),
        ),
      );
    expect(places(rearrange(level!, rng(3), freshInView(level!, recipe)))).toBe(
      places(level!),
    );
    // All three in front: only foods that have them, or none.
    const allIn = generate({ shares: [0.5], inFront: 3 });
    if (allIn.level)
      expect(inFront(createGame(allIn.level), allIn.foods[0]!.type)).toBe(3);
    // Free to start anywhere, any foods.
    expect(() =>
      createGame(generate({ shares: [0.5, 1] }).level!),
    ).not.toThrow();
  });
});
