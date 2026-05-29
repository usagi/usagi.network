const { chromium } = require('playwright');

const baseUrl = normalizeBase(process.argv[2] || process.env.SITE_URL || 'http://127.0.0.1:8080/');
const failures = [];

function normalizeBase(value)
{
 return String(value || '').replace(/\/?$/, '/');
}

function fail(message)
{
 failures.push(message);
}

async function main()
{
 const browser = await chromium.launch({ headless: true });
 const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
 const consoleIssues = [];
 const responseIssues = [];
 page.on('console', msg =>
 {
  if (msg.type() === 'error') consoleIssues.push(msg.text());
 });
 page.on('pageerror', err => consoleIssues.push(err.message));
 page.on('response', res =>
 {
  const status = res.status();
  if (status >= 400) responseIssues.push(`${status} ${res.url()}`);
 });

 await checkHome(page);
 await checkSoftware(page);
 await checkArtwork(page);

 await browser.close();

 const localOrigin = new URL(baseUrl).origin;
 const relevantResponses = responseIssues.filter(issue =>
 {
  const url = issue.replace(/^\d+\s+/, '');
  try { return new URL(url).origin === localOrigin; } catch { return true; }
 });
 const relevantIssues = consoleIssues.filter(issue =>
  !/Twitch|Autoplay|MasterPlaylist|429|WebGPU|No available adapters|Failed to load resource/i.test(issue));
 if (relevantResponses.length) fail(`failed local resources:\n${relevantResponses.join('\n')}`);
 if (relevantIssues.length) fail(`console errors:\n${relevantIssues.join('\n')}`);

 if (failures.length)
 {
  console.error(failures.join('\n\n'));
  process.exit(1);
 }
 console.log('site smoke ok');
}

async function gotoRoute(page, route)
{
 await page.goto(`${baseUrl}?smoke=${Date.now()}#/${route}`, { waitUntil: 'load' });
 await page.waitForTimeout(1800);
}

async function checkHome(page)
{
 await gotoRoute(page, 'home');
 await page.waitForFunction(() => document.querySelectorAll('#latest-grid .card').length > 0, null, { timeout: 6000 }).catch(() => { });
 const state = await page.evaluate(() => ({
  releaseCount: [...document.querySelectorAll('#latest-grid .card')]
   .filter(card => card.querySelector('.card__tag')?.textContent === 'Release').length,
  life: {
   width: document.getElementById('hero-life')?.width || 0,
   height: document.getElementById('hero-life')?.height || 0,
  },
  visibleHome: !document.querySelector('.hero[data-view="home"]')?.classList.contains('is-hidden'),
 }));
 if (!state.visibleHome) fail('home: hero is hidden');
 if (state.releaseCount < 3) fail(`home: expected at least 3 release cards, got ${state.releaseCount}`);
 if (state.life.width <= 0 || state.life.height <= 0) fail(`home: life canvas has invalid size ${state.life.width}x${state.life.height}`);
}

async function checkSoftware(page)
{
 await gotoRoute(page, 'software');
 const state = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('[data-view="software"] .software-feature').length,
  indexCount: document.querySelectorAll('[data-view="software"] .index-nav a').length,
  versions: [...document.querySelectorAll('[data-view="software"] .software-feature .sub')].map(el => el.textContent),
  visible: !document.querySelector('[data-view="software"]')?.classList.contains('is-hidden'),
 }));
 if (!state.visible) fail('software: view is hidden');
 if (state.indexCount < 1) fail('software: index is empty');
 if (state.cardCount < 3) fail(`software: expected at least 3 cards, got ${state.cardCount}`);
 if (state.versions.some(v => !/^v?\d/.test(v || ''))) fail(`software: invalid versions ${state.versions.join(', ')}`);
}

async function checkArtwork(page)
{
 await gotoRoute(page, 'artwork');
 const motionLink = page.locator('[data-view="artwork"] .index-nav a[href="#motion-refs"]');
 if (await motionLink.count() !== 1)
 {
  fail('artwork: Motion References index link missing');
  return;
 }
 await motionLink.click();
 await page.waitForTimeout(500);
 const state = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('[data-view="artwork"] [data-full]').length,
  hash: location.hash,
  motionTop: Math.round(document.querySelector('#motion-refs')?.getBoundingClientRect().top ?? -9999),
  imagesOk: [...document.querySelectorAll('[data-view="artwork"] img')]
   .filter(img => img.getAttribute('src'))
   .every(img => img.naturalWidth > 0),
  visible: !document.querySelector('[data-view="artwork"]')?.classList.contains('is-hidden'),
 }));
 if (!state.visible) fail('artwork: view is hidden');
 if (state.hash !== '#/artwork') fail(`artwork: index click changed route hash to ${state.hash}`);
 if (state.motionTop < 0 || state.motionTop > 520) fail(`artwork: motion section did not scroll into view, top=${state.motionTop}`);
 if (state.cardCount < 8) fail(`artwork: expected at least 8 artwork cards, got ${state.cardCount}`);
 if (!state.imagesOk) fail('artwork: one or more images failed to decode');
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});
