const { chromium } = require('playwright');

const baseUrl = normalizeBase(process.argv[2] || process.env.SITE_URL || 'http://127.0.0.1:4173/');
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
 await checkEssay(page);
 await checkMusic(page);
 await checkStream(page);

 await browser.close();

 const localOrigin = new URL(baseUrl).origin;
 const relevantResponses = responseIssues.filter(issue =>
 {
  const url = issue.replace(/^\d+\s+/, '');
  try { return new URL(url).origin === localOrigin; } catch { return true; }
 });
 const relevantIssues = consoleIssues.filter(issue =>
  !/Twitch|Autoplay|MasterPlaylist|429|WebGPU|No available adapters|SoundCloud|Failed to load resource/i.test(issue));
 if (relevantResponses.length) fail(`failed local resources:\n${relevantResponses.join('\n')}`);
 if (relevantIssues.length) fail(`console errors:\n${relevantIssues.join('\n')}`);

 if (failures.length)
 {
  console.error(failures.join('\n\n'));
  process.exit(1);
 }
 console.log('site smoke ok');
}

async function gotoPath(page, pathname)
{
 await page.goto(new URL(pathname, baseUrl).toString(), { waitUntil: 'load' });
 await page.waitForTimeout(500);
}

async function checkHome(page)
{
 await gotoPath(page, '/');
 const state = await page.evaluate(() => ({
  title: document.title,
  navEssay: !!document.querySelector('.nav__link[href="/essay/"]'),
  latestCount: document.querySelectorAll('#latest-grid .card').length,
  releaseCount: [...document.querySelectorAll('#latest-grid .card')]
   .filter(card => card.querySelector('.card__tag')?.textContent === 'Release').length,
 }));
 if (!/USAGI\.NETWORK/.test(state.title)) fail(`home: invalid title ${state.title}`);
 if (!state.navEssay) fail('home: Essay nav missing');
 if (state.latestCount < 6) fail(`home: expected latest cards, got ${state.latestCount}`);
 if (state.releaseCount < 1) fail(`home: expected release card, got ${state.releaseCount}`);
}

async function checkSoftware(page)
{
 await gotoPath(page, '/software/');
 const state = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('.software-feature').length,
  indexCount: document.querySelectorAll('.index-nav a').length,
  officialLink: [...document.querySelectorAll('.software-feature a')]
   .some(a => a.textContent.trim() === 'U.N. Avatar Official Web' && a.href === 'https://usagi.github.io/un-avatar/'),
  canonical: document.querySelector('link[rel="canonical"]')?.href || '',
 }));
 if (state.indexCount < 1) fail('software: index is empty');
 if (state.cardCount < 3) fail(`software: expected at least 3 cards, got ${state.cardCount}`);
 if (!state.officialLink) fail('software: U.N. Avatar official link missing');
 if (!state.canonical.endsWith('/software/')) fail(`software: bad canonical ${state.canonical}`);
 await gotoPath(page, '/software/un-avatar/');
 const detail = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
 if (!/U\.N\. Avatar/.test(detail)) fail('software detail: U.N. Avatar page missing');
}

async function checkArtwork(page)
{
 await gotoPath(page, '/artwork/');
 const state = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('.artwork-hero, .artwork-card').length,
  imagesOk: [...document.querySelectorAll('img')]
   .filter(img => img.getAttribute('src'))
   .every(img => img.naturalWidth > 0),
 }));
 if (state.cardCount < 8) fail(`artwork: expected at least 8 artwork cards, got ${state.cardCount}`);
 if (!state.imagesOk) fail('artwork: one or more images failed to decode');
}

async function checkEssay(page)
{
 await gotoPath(page, '/essay/');
 const listCount = await page.locator('.essay-card').count();
 if (listCount < 1) fail(`essay: expected at least 1 essay, got ${listCount}`);
 await gotoPath(page, '/essay/taste-geopolitics-fractality/');
 const state = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent || '',
  bodyText: document.querySelector('.essay-body')?.textContent || '',
  printButton: !!document.querySelector('.essay-actions button'),
 }));
 if (!state.h1.includes('味覚地政学のフラクタル性')) fail(`essay detail: bad h1 ${state.h1}`);
 if (!state.bodyText.includes('味覚地政学のフラクタル性')) fail('essay detail: body text missing');
 if (!state.printButton) fail('essay detail: print button missing');
}

async function checkMusic(page)
{
 await gotoPath(page, '/music/');
 const state = await page.evaluate(() => ({
  tracks: document.querySelectorAll('.features .feature').length,
  iframe: !!document.querySelector('iframe[src*="soundcloud.com"]'),
 }));
 if (state.tracks < 3) fail(`music: expected tracks, got ${state.tracks}`);
 if (!state.iframe) fail('music: SoundCloud iframe missing');
}

async function checkStream(page)
{
 await gotoPath(page, '/stream/');
 const state = await page.evaluate(() => ({
  cards: document.querySelectorAll('.card').length,
  sections: [...document.querySelectorAll('.strip__title')].map(el => el.textContent),
 }));
 if (state.cards < 6) fail(`stream: expected stream cards, got ${state.cards}`);
 if (!state.sections.some(text => text.includes('Twitch'))) fail('stream: Twitch section missing');
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});

