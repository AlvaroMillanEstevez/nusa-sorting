#!/usr/bin/env node
// Plays the way between the map and the levels in a headless Chrome and fails on any exception or on a screen
// left flat (one colour: a transition that never finished). Run it after every change to scenes or loading.
//
//   npm run dev                          (in another terminal)
//   node tools/check/flow.mjs            → the dev server: level 1 won by the simulated expert, the map, level 2
//                                          from Play, restart, back to the map and level 2 again
//   npm run build && npm run preview     (in another terminal)
//   node tools/check/flow.mjs --prod     → the production build: the map, a level from Play, back to the map
//                                          and the level again, restart (no development parameters there)
//
// Environment: URL (default http://localhost:5180, or http://localhost:4173 with --prod), CHROME (default: the
// Playwright headless shell). Exits 0 when every step passes.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const PROD = process.argv.includes('--prod');
const URL = process.env.URL ?? (PROD ? 'http://localhost:4173' : 'http://localhost:5180');
const PORT = 9335;
// A phone in portrait: the buttons below are where the layout puts them at this size.
const W = 390;
const H = 844;
const PLAY = [195, 783];
const PAUSE = [37, 31];
const MENU_RESTART = [195, 339];
const MENU_HOME = [195, 400];

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1);
  const inner = readdirSync(join(base, dir)).find((name) => name.startsWith('chrome-headless-shell'));
  return join(base, dir, inner, 'chrome-headless-shell');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const libs = join(homedir(), '.cache/nusa-libs/root/usr/lib/x86_64-linux-gnu');
const chrome = spawn(
  findChrome(),
  ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'nusa-flow-'))}`, `--window-size=${W},${H}`, 'about:blank'],
  { env: { ...process.env, LD_LIBRARY_PATH: `${libs}:${libs}/nss:${process.env.LD_LIBRARY_PATH ?? ''}` }, stdio: 'ignore' },
);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.id) {
    pending.get(data.id)?.(data.result);
    pending.delete(data.id);
  } else if (data.method === 'Runtime.exceptionThrown') {
    const details = data.params.exceptionDetails;
    errors.push(details.exception?.description ?? details.text);
  } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    errors.push(data.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
const click = async ([x, y]) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

/** How varied the screen is (standard deviation of a sample of its pixels): near 0 is one flat colour. */
async function variety() {
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
  return evaluate(`(async () => {
    const image = new Image();
    image.src = 'data:image/jpeg;base64,${data}';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const c = canvas.getContext('2d');
    c.drawImage(image, 0, 0, 64, 64);
    const px = c.getImageData(0, 0, 64, 64).data;
    let sum = 0, sq = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += v; sq += v * v; n++; }
    const mean = sum / n;
    return Math.sqrt(sq / n - mean * mean);
  })()`);
}

let failed = false;
async function step(name, check) {
  const ok = await check();
  const shown = await variety();
  const flat = shown < 6;
  const pass = ok && !flat && errors.length === 0;
  console.log(`${pass ? '✓' : '✗'} ${name}${flat ? ' (flat screen)' : ''}${ok ? '' : ' (did not get there)'}`);
  if (errors.length) console.log(errors.splice(0).map((e) => `    ${e.split('\n').slice(0, 4).join('\n    ')}`).join('\n'));
  if (!pass) failed = true;
  return pass;
}

/** Waits until `condition` (an expression) is true, up to `ms`. */
async function until(condition, ms) {
  for (let t = 0; t < ms; t += 250) {
    if (await evaluate(condition)) return true;
    await sleep(250);
  }
  return false;
}

const scenes = `(window.__nusa?.scenes() ?? [])`;
const inGame = (level) => `${scenes}.includes('Game') && window.__nusa.level() === ${level}`;
const onMap = `${scenes}.includes('Home') && !${scenes}.includes('Game')`;

await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
await send('Runtime.enable');
await send('Page.enable');

if (!PROD) {
  await send('Page.navigate', { url: `${URL}/?level=1&resetSave&show=autoplay` });
  await step('level 1 opens', () => until(inGame(1), 20000));
  await step('the simulated expert wins it and the map opens', () => until(onMap, 120000));
  // The first press may only skip the arrival sequence.
  const toLevel2 = async () => {
    for (let i = 0; i < 6; i++) {
      await click(PLAY);
      if (await until(inGame(2), 3000)) return true;
    }
    return false;
  };
  if (await step('Play opens level 2', toLevel2)) {
    await sleep(1500);
    await click(PAUSE);
    await sleep(800);
    await click(MENU_RESTART);
    await step('restart keeps level 2 playable', async () => (await sleep(2500), evaluate(inGame(2))));
    await click(PAUSE);
    await sleep(800);
    await click(MENU_HOME);
    await step('Home goes back to the map', () => until(onMap, 8000));
    await step('Play opens level 2 again', toLevel2);
  }
} else {
  // Production: a returning player (two levels done), so the game opens on the map.
  const save = JSON.stringify({ version: 3, progress: { completed: ['nusa-001', 'nusa-002'], bestStars: { 'nusa-001': 3, 'nusa-002': 2 }, bestScores: {} }, settings: {}, themesSeen: [], lastArrangements: {}, tutorialsDone: ['first-triple'], wallet: {}, snapshot: null });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!sessionStorage.getItem('seeded')) { localStorage.setItem('nusa-sorting.save', ${JSON.stringify(save)}); sessionStorage.setItem('seeded', '1'); }` });
  await send('Page.navigate', { url: `${URL}/` });
  await sleep(4000);
  await step('the map opens', async () => true);
  for (const round of [1, 2]) {
    await click(PLAY);
    await sleep(4000);
    await step(`Play opens a level (${round})`, async () => true);
    await click(PAUSE);
    await sleep(800);
    await click(MENU_HOME);
    await sleep(3000);
    await step(`Home goes back to the map (${round})`, async () => true);
  }
  await click(PLAY);
  await sleep(4000);
  await click(PAUSE);
  await sleep(800);
  await click(MENU_RESTART);
  await sleep(3000);
  await step('restart keeps the level playable', async () => true);
}

chrome.kill('SIGKILL');
console.log(failed ? '✗ the flow failed' : '✓ the flow works');
process.exit(failed ? 1 : 0);
