import displayUrl from '../../assets/fonts/nusa-display-600.woff2?url';
import text500Url from '../../assets/fonts/nusa-text-500.woff2?url';
import text700Url from '../../assets/fonts/nusa-text-700.woff2?url';

/**
 * Loads the interface fonts bundled with the game (src/assets/fonts, OFL), never from an outside service.
 * Phaser draws text on a canvas, which only uses a web font once it is loaded: call this before creating text.
 * Resolves even if a font fails (the system font then stands in).
 */
export async function loadUiFonts(): Promise<void> {
  const faces = [
    new FontFace('NusaDisplay', `url(${displayUrl})`, { weight: '600' }),
    new FontFace('NusaText', `url(${text500Url})`, { weight: '500' }),
    new FontFace('NusaText', `url(${text700Url})`, { weight: '700' }),
  ];
  await Promise.all(
    faces.map(async (face) => {
      try {
        document.fonts.add(await face.load());
      } catch {
        // Keep going with the fallback font.
      }
    }),
  );
}
