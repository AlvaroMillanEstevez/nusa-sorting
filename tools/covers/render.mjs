#!/usr/bin/env node
// Renders the store covers to PNG at their exact sizes (1920×1080, 800×1200, 800×800), both compositions, from
// the dev server's ?cover page in a headless Chrome at 2 device pixels per CSS pixel. It waits until the page says
// the cover is drawn (window.__coverReady): the pictures are decoded in real time, which a fixed virtual time
// budget does not wait for.
//
//   npm run dev                                       (in another terminal)
//   python3 tools/art/build_game_art.py --hires art-source/hires-items   (once: the 512 px objects, outside git)
//   node tools/covers/render.mjs [a|b|both]           → docs/launch/covers/cover-<shape>-<a|b>.png, and
//                                                       cover-portrait-<a|b>-1080.png (the portrait video's opening)
//
// Environment: URL (default http://localhost:5180), CHROME (default: the Playwright headless shell), OUT (default
// docs/launch/covers).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.URL ?? 'http://localhost:5180';
const OUT = process.env.OUT ?? 'docs/launch/covers';
const SHAPES = { landscape: [960, 540], portrait: [400, 600], square: [400, 400] };
const PORT = 9334;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1);
  const inner = readdirSync(join(base, dir)).find((name) => name.startsWith('chrome-headless-shell'));
  return join(base, dir, inner, 'chrome-headless-shell');
}

async function render(shape, variant, scale = 2, suffix = '') {
  const [width, height] = SHAPES[shape];
  const libs = join(homedir(), '.cache/nusa-libs/root/usr/lib/x86_64-linux-gnu');
  const env = existsSync(libs) ? { ...process.env, LD_LIBRARY_PATH: `${libs}:${libs}/nss:${process.env.LD_LIBRARY_PATH ?? ''}` } : process.env;
  const chrome = spawn(
    findChrome(),
    ['--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${PORT}`, `--window-size=${width},${height}`, 'about:blank'],
    { env, stdio: 'ignore' },
  );
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
      } catch {
        // Not up yet.
      }
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id) pending.get(d.id)?.(d.result);
    };
    const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    await send('Page.navigate', { url: `${URL}/?cover=${shape}&v=${variant}` });
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      await sleep(200);
      ready = (await send('Runtime.evaluate', { expression: 'window.__coverReady === true', returnByValue: true })).result?.value === true;
    }
    if (!ready) throw new Error(`${shape} ${variant}: the cover never finished drawing (are the 512 px objects there?)`);
    // A few frames for the GPU to show what was just drawn.
    await sleep(500);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(OUT, { recursive: true });
    const file = join(OUT, `cover-${shape}-${variant}${suffix}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`${file} (${Math.round(width * scale)}x${Math.round(height * scale)})`);
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

const which = process.argv[2] ?? 'both';
for (const variant of which === 'both' ? ['a', 'b'] : [which]) {
  for (const shape of Object.keys(SHAPES)) await render(shape, variant);
  // The portrait preview video is 1080×1620: its opening frame, the same cover drawn at that size.
  await render('portrait', variant, 1080 / 400, '-1080');
}
