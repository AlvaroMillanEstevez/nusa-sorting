#!/usr/bin/env node
// Records the store preview videos from the dev server's ?preview mode: a headless Chrome on virtual time, one
// screenshot per frame at 30 fps, then ffmpeg into a silent 1080p H.264 MP4. Nothing is sped up: every frame is
// 1/30 s of game time.
//
//   npm run dev                                   (in another terminal)
//   node tools/preview/record.mjs [landscape|portrait|both]
//     → docs/launch/videos/preview-landscape.mp4 (1920×1080) and preview-portrait.mp4 (1080×1620)
//
// Environment: URL (default http://localhost:5180), CHROME (default: the Playwright headless shell),
// SECONDS (default 19), OUT (default docs/launch/videos), VARIANT (the cover it opens on: a or b, default a).
// Needs ffmpeg on the PATH; the covers need the 512 px objects (python3 tools/art/build_game_art.py --hires
// art-source/hires-items).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.URL ?? 'http://localhost:5180';
const OUT = process.env.OUT ?? 'docs/launch/videos';
const SECONDS = Number(process.env.SECONDS ?? 19);
/**
 * How virtual time treats downloads. 'advance' (the default) lets it run while one is pending: a download cannot
 * finish while time stands still, so pausing for it can wait for ever; each frame takes long enough to capture for
 * downloads to land within one. 'pauseIfNetworkFetchesPending' is the stricter old way.
 */
const POLICY = process.env.POLICY ?? 'advance';
/** The cover the video opens on: composition a or b (see src/dev/CoverScene.ts). */
const VARIANT = process.env.VARIANT === 'b' ? 'b' : 'a';
const FPS = 30;
/** How long the video holds its opening cover before the game (a cut, as the game's own video mode does). */
const COVER_SECONDS = 2.2;
const SHAPES = {
  // CSS size and pixel ratio: 1080p in 16:9 (1920×1080) and in 2:3 (1080×1620), with the game drawn a little
  // larger than on a desktop window so the board fills the frame.
  landscape: { width: 720, height: 405, scale: 1920 / 720 },
  portrait: { width: 432, height: 648, scale: 1080 / 432 },
};
const PORT = 9333;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1);
  const inner = readdirSync(join(base, dir)).find((name) => name.startsWith('chrome-headless-shell'));
  return join(base, dir, inner, 'chrome-headless-shell');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    } else if (data.method) {
      for (const listener of listeners.get(data.method) ?? []) listener(data.params);
    }
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    on: (method, listener) => listeners.set(method, [...(listeners.get(method) ?? []), listener]),
    once: (method) =>
      new Promise((resolve) => {
        const list = listeners.get(method) ?? [];
        const listener = (params) => {
          listeners.set(method, (listeners.get(method) ?? []).filter((l) => l !== listener));
          resolve(params);
        };
        listeners.set(method, [...list, listener]);
      }),
    close: () => ws.close(),
  };
}

async function record(shape) {
  const { width, height, scale } = SHAPES[shape];
  const frames = mkdtempSync(join(tmpdir(), `nusa-preview-${shape}-`));
  const libs = join(homedir(), '.cache/nusa-libs/root/usr/lib/x86_64-linux-gnu');
  const env = existsSync(libs) ? { ...process.env, LD_LIBRARY_PATH: `${libs}:${libs}/nss:${process.env.LD_LIBRARY_PATH ?? ''}` } : process.env;
  const chrome = spawn(
    findChrome(),
    [
      '--no-sandbox',
      '--hide-scrollbars',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--mute-audio',
      `--remote-debugging-port=${PORT}`,
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${scale}`,
      'about:blank',
    ],
    { env, stdio: 'ignore' },
  );
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
      } catch {
        // Not up yet.
      }
    }
    if (!target) throw new Error('Chrome did not start');
    const cdp = await cdpSession(target.webSocketDebuggerUrl);
    const errors = [];
    cdp.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
    cdp.on('Runtime.consoleAPICalled', (p) => p.type === 'error' && errors.push(p.args.map((a) => a.value ?? a.description).join(' ')));
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    // The level wears Budaya Jawa's illustrated stall; Kliwon (fruit day) marks the rambutan with its kepeng.
    const query = process.env.QUERY ?? `preview=${shape}&level=33&show=autoplay&progress=32&boosters=1&resetSave&headless&lang=en&theme=budaya-jawa&pasaran=kliwon&nocover`;
    // The page loads in real time; then time stands still and only moves when advanced, one frame at a time.
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${URL}/?${query}` });
    await loaded;
    // The game starts in real time; time stands still once its first scene runs.
    for (let i = 0; i < 150; i++) {
      const ready = await cdp.send('Runtime.evaluate', { expression: '(window.__nusa?.scenes().length ?? 0) > 0', returnByValue: true });
      if (ready.result?.value === true) break;
      await sleep(200);
    }
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
    const advance = async (ms) => {
      const expired = cdp.once('Emulation.virtualTimeBudgetExpired');
      // The game's timer loop keeps tasks coming: without a starvation limit virtual time can stall between them.
      await cdp.send('Emulation.setVirtualTimePolicy', { policy: POLICY, budget: ms, maxVirtualTimeTaskStarvationCount: 100 });
      await expired;
    };
    await advance(100);
    // The cover is its rendered PNG (tools/covers/render.mjs), held first; the game is recorded after it.
    const total = Math.round((SECONDS - COVER_SECONDS) * FPS);
    for (let frame = 0; frame < total; frame++) {
      await advance(1000 / FPS);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(frames, `f${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
      if (frame % 60 === 0) console.log(`  ${shape}: ${frame / FPS} s`);
    }
    cdp.close();
    if (errors.length) console.log(`  ${shape}: console errors:\n    ${errors.join('\n    ')}`);
    mkdirSync(OUT, { recursive: true });
    const out = join(OUT, `preview-${shape}.mp4`);
    const cover = join('docs/launch/covers', shape === 'portrait' ? `cover-portrait-${VARIANT}-1080.png` : `cover-landscape-${VARIANT}.png`);
    if (!existsSync(cover)) throw new Error(`${cover} is missing: run node tools/covers/render.mjs first`);
    const size = `${Math.round(width * scale)}:${Math.round(height * scale)}`;
    execFileSync(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error',
        '-loop', '1', '-framerate', String(FPS), '-t', String(COVER_SECONDS), '-i', cover,
        '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'),
        '-filter_complex', `[0:v]scale=${size},setsar=1[c];[1:v]scale=${size},setsar=1[g];[c][g]concat=n=2:v=1[v]`,
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out,
      ],
      { stdio: 'inherit' },
    );
    console.log(`${out} (${Math.round(width * scale)}x${Math.round(height * scale)}, ${SECONDS} s)`);
  } finally {
    chrome.kill('SIGKILL');
    rmSync(frames, { recursive: true, force: true });
  }
}

const which = process.argv[2] ?? 'both';
for (const shape of which === 'both' ? ['landscape', 'portrait'] : [which]) await record(shape);
