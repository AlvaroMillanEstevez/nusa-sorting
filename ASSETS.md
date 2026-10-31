# Assets and credits

The code is under the [MIT License](LICENSE). Third-party assets keep their own licences, listed below. More detail on the audio is in [docs/audio-licenses.md](docs/audio-licenses.md) (in Spanish).

## Third-party assets

| What | Where | Author | Source | Licence |
|---|---|---|---|---|
| Fredoka (display font, subset) | `src/assets/fonts/nusa-display-600.woff2` | The Fredoka Project Authors | [Google Fonts](https://fonts.google.com/specimen/Fredoka) | SIL Open Font License 1.1 ([text](src/assets/fonts/OFL-Fredoka.txt)) |
| Plus Jakarta Sans (text font, subset) | `src/assets/fonts/nusa-text-*.woff2` | The Plus Jakarta Sans Project Authors | [Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | SIL Open Font License 1.1 ([text](src/assets/fonts/OFL-PlusJakartaSans.txt)) |
| Music: *Java Jurami* | `src/assets/audio/music/java-jurami.mp3` | SieuAmThanh | [Freesound 423647](https://freesound.org/people/SieuAmThanh/sounds/423647/) | CC0 1.0 |
| Gamelan notes (win jingle) | `src/assets/audio/win.mp3` | bassimat | [Freesound 855565](https://freesound.org/people/bassimat/sounds/855565/) | CC0 1.0 |
| Sound effects | `src/assets/audio/*.mp3` | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Impact Sounds](https://kenney.nl/assets/impact-sounds), [Casino Audio](https://kenney.nl/assets/casino-audio), [RPG Audio](https://kenney.nl/assets/rpg-audio), [Music Jingles](https://kenney.nl/assets/music-jingles) | CC0 1.0 |

The fonts were subset and converted to WOFF2 with `tools/fonts/build_fonts.py`; the sounds were trimmed, mixed and levelled with `tools/audio/`. CC0 needs no attribution, but the authors are credited anyway.

## Libraries

| Library | Use | Licence |
|---|---|---|
| [Phaser](https://github.com/phaserjs/phaser) | Game engine, bundled in the build | MIT |
| [Vite](https://github.com/vitejs/vite), [TypeScript](https://github.com/microsoft/TypeScript), [Vitest](https://github.com/vitest-dev/vitest) | Build and tests only | MIT / Apache 2.0 / MIT |
| Poki SDK | Loaded from Poki's CDN, only in the Poki build (`npm run build:poki`) | Poki's developer terms |

## AI-generated assets

- **Illustrated art:** the 81 items, the shelves and wooden pieces, the backgrounds, the theme backgrounds, the island map art and the loading screen were generated with ChatGPT (October 2026) from the author's prompts. The originals are in `art-source/pilot` (see its README for each sheet); `tools/art/build_game_art.py` cuts, cleans and resizes them into `src/assets/art`.
- **Derived images:** the store covers, thumbnails, screenshots and preview videos in `docs/launch` are composed by code from that art.
- **Text:** the *Buku Nenek* notes, the in-game texts and the Indonesian translation were drafted with AI and reviewed by people.

These assets are distributed with the repository under the same MIT terms, to the extent the author holds rights in them. Depending on the jurisdiction, purely AI-generated images may not be protected by copyright.

## Made for this game

- UI and booster icons: SVG drawn in code (`src/ui/design`, `src/scenes/boosterTextures.ts`).
- Triple and combo sounds: synthesized at runtime with the Web Audio API (`src/services/WebAudioSoundService.ts`).
- Levels: produced by the procedural generator in `tools/levelgen` and reviewed.
