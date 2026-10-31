# Roadmap

Planned work, grouped by area, with rough estimates in hours. The game is complete and playable; these are the next steps.

## Features (29 h)

| Task | Estimate |
|---|---|
| Finish the Poki submission: run the build through the Poki Inspector, check that the Poki pill does not cover the HUD on mobile, prepare the animated thumbnail ([checklist](docs/launch/poki-checklist.md)) | 4 h |
| Ten more levels (51–60) with a new theme: recipes, generation, simulated-player checks, playtest | 10 h |
| In-game credits screen in Settings, listing the fonts, sounds and licences from [ASSETS.md](ASSETS.md) | 3 h |
| Android app with Capacitor, without ads: build target, back button, pause in the background, icon ([plan](docs/launch/android-plan.md)) | 12 h |

## Bugs and QA (5 h)

| Task | Estimate |
|---|---|
| Test pass on a low-end Android phone and on iOS Safari: performance, audio unlock, notch and safe areas | 4 h |
| Fix whatever the Poki Inspector reports (pill placement, event order) | 1 h |

## Refactoring (13 h)

| Task | Estimate |
|---|---|
| Split `src/scenes/GameScene.ts` (about 1,900 lines) into smaller controllers: input, HUD updates, end-of-level flow | 8 h |
| Split `src/scenes/HomeScene.ts` (about 1,060 lines): map, panels, chest and arrival sequence | 5 h |

## Tests and CI (9 h)

| Task | Estimate |
|---|---|
| GitHub Actions workflow: typecheck, unit tests and both builds on every push | 2 h |
| Run the headless browser flow check (`npm run check:flow`) in CI | 4 h |
| Unit tests for the layout helpers in `src/ui` | 3 h |

## Documentation (10 h)

| Task | Estimate |
|---|---|
| Translate the internal docs (`CLAUDE.md`, `docs/*.md`, the art README) from Spanish to English | 6 h |
| Architecture overview: core, scenes, services, level generator and simulated players | 3 h |
| Contributing guide: setup, commands, conventions | 1 h |

## Localisation (6 h)

| Task | Estimate |
|---|---|
| A third language (Spanish): catalogue, language detection, text fitting on small screens | 6 h |

## Total

**72 hours** (29 + 5 + 13 + 9 + 10 + 6).
