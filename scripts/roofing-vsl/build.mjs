// ─── Roofing VSL — recording deck and frames ───────────────────────────────
//
//   node scripts/roofing-vsl/build.mjs            # deck + frames + storyboard
//   node scripts/roofing-vsl/build.mjs --deck     # deck.html only (no browser)
//
// Produces, in docs/roofing-vsl/:
//   deck.html          the deck to present and screen-record (one offline file)
//   frames/NN-*.png    1920×1080, one per build, main-cut order
//   thumbnail.png      plain click-to-play poster
//   storyboard.png     every frame as a numbered thumbnail
//
// The words live in deck.template.html. README.md is written by hand.
//
// Frames need Playwright. Either `npm i --no-save playwright`, or point
// PLAYWRIGHT_MODULE at an install (e.g. "$(npm root -g)/playwright").
// DOCS_CAPTURE_CHROMIUM picks a Chromium binary when Playwright's own build
// is not installed (e.g. /opt/pw-browsers/chromium).

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(ROOT, 'docs/roofing-vsl');
const FRAMES = join(OUT, 'frames');
const DECK = join(OUT, 'deck.html');

const FONTS = [
  ['Plus Jakarta Sans', 500, 'normal', join(HERE, 'fonts/plus-jakarta-sans-latin-500-normal.woff2')],
  ['Plus Jakarta Sans', 600, 'normal', join(HERE, 'fonts/plus-jakarta-sans-latin-600-normal.woff2')],
  ['Plus Jakarta Sans', 700, 'normal', join(HERE, 'fonts/plus-jakarta-sans-latin-700-normal.woff2')],
  ['Plus Jakarta Sans', 800, 'normal', join(HERE, 'fonts/plus-jakarta-sans-latin-800-normal.woff2')],
  ['Plus Jakarta Sans', 700, 'italic', join(HERE, 'fonts/plus-jakarta-sans-latin-700-italic.woff2')],
  ['Plus Jakarta Sans', 800, 'italic', join(HERE, 'fonts/plus-jakarta-sans-latin-800-italic.woff2')],
  ['Inter Display', 400, 'normal', join(ROOT, 'public/fonts/InterDisplay-Regular.woff2')],
  ['Inter Display', 700, 'normal', join(ROOT, 'public/fonts/InterDisplay-Bold.woff2')],
  ['Inter Display', 400, 'italic', join(ROOT, 'public/fonts/InterDisplay-Italic.woff2')],
];

function buildDeck() {
  const faces = FONTS.map(
    ([family, weight, style, file]) =>
      `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; font-display: block; ` +
      `src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2'); }`,
  ).join('\n');
  const mark = readFileSync(join(ROOT, 'public/mark.svg'), 'utf8').trim().replace('<svg ', '<svg aria-hidden="true" ');
  const html = readFileSync(join(HERE, 'deck.template.html'), 'utf8')
    .replace('/*FONTS*/', () => faces)
    .replace('<!--MARK-->', () => mark);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(DECK, html);
  console.log(`deck      ${DECK} (${Math.round(html.length / 1024)} KB)`);
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean);
  for (const id of tries) {
    try {
      return require(id);
    } catch {
      // try the next one
    }
  }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
}

function storyboardHtml(frames) {
  const cells = frames
    .map(
      (f) => `<figure><img src="${pathToFileURL(join(FRAMES, f.file)).href}"><figcaption><b>${f.n}</b> ${f.label}</figcaption></figure>`,
    )
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 56px; background: #07070b; color: #fff; font-family: 'Inter Display', Inter, sans-serif; width: 1920px; box-sizing: border-box; }
    h1 { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 46px; font-weight: 800; letter-spacing: -0.04em; }
    h1 span { color: #c3b6fe; font-style: italic; }
    p { margin: 10px 0 34px; color: #a3a3a3; font-size: 21px; }
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 26px 22px; }
    figure { margin: 0; }
    img { display: block; width: 100%; border: 1px solid rgba(154,136,252,0.35); border-radius: 10px; }
    figcaption { margin-top: 10px; color: #d4d4d8; font-size: 16px; line-height: 1.35; }
    figcaption b { color: #c3b6fe; margin-right: 6px; }
  </style>
  <h1>Roofing VSL <span>storyboard</span></h1>
  <p>${frames.length} frames, main cut, in order. The short cut uses frames 01 to 08, then ${frames.at(-1).n}.</p>
  <div class="grid">${cells}</div>`;
}

async function buildFrames() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(
    process.env.DOCS_CAPTURE_CHROMIUM ? { executablePath: process.env.DOCS_CAPTURE_CHROMIUM } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${pathToFileURL(DECK).href}?export`);
  await page.evaluate(() => document.fonts.ready);
  const list = await page.evaluate(() => window.__deck.frames('main'));

  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const frames = [];
  for (const [i, f] of list.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const file = `${n}-${f.name}.png`;
    await page.evaluate((name) => window.__deck.show(name, 'main'), f.name);
    await page.locator('#stage').screenshot({ path: join(FRAMES, file) });
    frames.push({ n, file, label: f.name.replace(/-/g, ' ') });
  }
  await page.evaluate(() => window.__deck.show('thumbnail'));
  await page.locator('#stage').screenshot({ path: join(OUT, 'thumbnail.png') });

  const sheet = join(OUT, '.storyboard.html');
  writeFileSync(sheet, storyboardHtml(frames));
  const sheetPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await sheetPage.goto(pathToFileURL(sheet).href);
  await sheetPage.addStyleTag({ content: readFileSync(DECK, 'utf8').match(/@font-face[^\n]*/g).join('\n') });
  await sheetPage.evaluate(() => document.fonts.ready);
  await sheetPage.screenshot({ path: join(OUT, 'storyboard.png'), fullPage: true });
  rmSync(sheet);

  await browser.close();
  console.log(`frames    ${readdirSync(FRAMES).length} in ${FRAMES}`);
  console.log(`thumbnail ${join(OUT, 'thumbnail.png')}`);
  console.log(`storyboard ${join(OUT, 'storyboard.png')}`);
  return list;
}

buildDeck();
if (!process.argv.includes('--deck')) {
  const list = await buildFrames();
  if (process.argv.includes('--list')) {
    for (const [i, f] of list.entries()) console.log(`${String(i + 1).padStart(2, '0')}\t${f.section}\t${f.name}\t${f.say}`);
  }
}
