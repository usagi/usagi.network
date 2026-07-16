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
 await checkBeatSaber(page);
 await checkSoftware(page);
 await checkArtwork(page);
 await checkEssay(page);
 await checkMusic(page);
 await checkStream(page);
 await checkMetadata(page);

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
 const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
 }));
 if (overflow.scrollWidth > overflow.clientWidth + 2) {
  fail(`${pathname}: horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`);
 }
 await checkPageBasics(page, pathname);
}

async function checkPageBasics(page, pathname)
{
 const state = await page.evaluate(() => ({
  h1Count: document.querySelectorAll('h1').length,
  imagesMissingAlt: [...document.querySelectorAll('img')]
   .filter(img => !img.hasAttribute('alt'))
   .map(img => img.currentSrc || img.getAttribute('src') || '<inline>'),
  unnamedButtons: [...document.querySelectorAll('button')]
   .filter(button =>
    !button.textContent?.trim()
    && !button.getAttribute('aria-label')?.trim()
    && !button.getAttribute('title')?.trim())
   .map(button => button.outerHTML.slice(0, 120)),
  unsafeBlankLinks: [...document.querySelectorAll('a[target="_blank"]')]
   .filter(link => !/\bnoopener\b/.test(link.getAttribute('rel') || ''))
   .map(link => link.getAttribute('href') || ''),
 }));
 if (state.h1Count !== 1) fail(`${pathname}: expected exactly one h1, got ${state.h1Count}`);
 if (state.imagesMissingAlt.length) fail(`${pathname}: images missing alt\n${state.imagesMissingAlt.join('\n')}`);
 if (state.unnamedButtons.length) fail(`${pathname}: buttons missing accessible names\n${state.unnamedButtons.join('\n')}`);
 if (state.unsafeBlankLinks.length) fail(`${pathname}: target=_blank links missing noopener\n${state.unsafeBlankLinks.join('\n')}`);
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
  screenshotSources: [...document.querySelectorAll('.software-media__shot')].map(img => img.getAttribute('src') || ''),
  officialLink: [...document.querySelectorAll('.software-feature a')]
   .some(a => a.textContent.trim() === 'U.N. Avatar Official Web' && a.href === 'https://usagi.github.io/un-avatar/'),
  canonical: document.querySelector('link[rel="canonical"]')?.href || '',
 }));
 if (state.indexCount < 1) fail('software: index is empty');
 if (state.cardCount < 4) fail(`software: expected at least 4 cards, got ${state.cardCount}`);
 if (!state.screenshotSources.every(src => src.endsWith('.webp'))) {
  fail(`software: screenshots should use WebP\n${state.screenshotSources.join('\n')}`);
 }
 if (!state.officialLink) fail('software: U.N. Avatar official link missing');
 if (!state.canonical.endsWith('/software/')) fail(`software: bad canonical ${state.canonical}`);
 await gotoPath(page, '/software/un-avatar/');
 const detail = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
 if (!/U\.N\. Avatar/.test(detail)) fail('software detail: U.N. Avatar page missing');
 await gotoPath(page, '/software/un-vrc-perfectsync/');
 const perfectSync = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent || '',
  imageWidth: document.querySelector('.software-media__shot')?.naturalWidth || 0,
  officialLink: [...document.querySelectorAll('.software-actions a')]
   .some(a => a.href === 'https://usagi.github.io/un-vrc-perfectsync/'),
 }));
 if (!/U\.N\. VRC PerfectSync/.test(perfectSync.h1)) fail('software detail: U.N. VRC PerfectSync page missing');
 if (perfectSync.imageWidth !== 1920) fail(`software detail: bad PerfectSync image width ${perfectSync.imageWidth}`);
 if (!perfectSync.officialLink) fail('software detail: PerfectSync official link missing');
}

async function checkBeatSaber(page)
{
 await gotoPath(page, '/beatsaber/');
 await page.waitForTimeout(1200);
 const state = await page.evaluate(() => ({
  featureCount: document.querySelectorAll('.feature').length,
  galleryImages: [...document.querySelectorAll('.gallery__img')].map(img => ({
   src: img.currentSrc || img.getAttribute('src') || '',
   naturalWidth: img.naturalWidth,
  })),
 }));
 if (state.featureCount < 5) fail(`beatsaber: expected feature sections, got ${state.featureCount}`);
 if (state.galleryImages.length < 4) fail(`beatsaber: expected public gallery thumbnails, got ${state.galleryImages.length}`);
 const failedImages = state.galleryImages
  .filter(img => img.src.includes('/assets/beatsaber/') && img.naturalWidth <= 0)
  .map(img => img.src);
 if (failedImages.length) fail(`beatsaber: gallery images failed to decode\n${failedImages.join('\n')}`);

 const requiredPublicImages = [
  '/assets/beatsaber/custom_saber/vulpisfoglia/image/0.jpg',
  '/assets/beatsaber/custom_saber/vulpisfoglia/image/1.jpg',
  '/assets/beatsaber/custom_note/usa-notes-00/image/0.jpg',
  '/assets/beatsaber/custom_note/usa-notes-00/image/1.jpg',
 ];
 for (const imagePath of requiredPublicImages)
 {
  const res = await page.request.get(new URL(imagePath, baseUrl).toString());
  if (res.status() !== 200) fail(`beatsaber: required public thumbnail ${imagePath} returned ${res.status()}`);
 }
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
 if (listCount < 2) fail(`essay: expected at least 2 essays, got ${listCount}`);
 const listState = await page.evaluate(() => {
  const card = document.querySelector('.essay-card__link[href="/essay/taste-geopolitics-fractality/"]')?.closest('.essay-card');
  return {
   labels: [...card?.querySelectorAll('.essay-card__details dt') || []].map(el => el.textContent?.trim() || ''),
   keywords: card?.querySelector('.essay-card__keywords p')?.textContent || '',
   readtime: card?.querySelector('.essay-readtime')?.textContent?.trim() || '',
  };
 });
 if (!listState.labels.includes('Author')) fail('essay index: author attribute missing');
 if (!listState.labels.includes('Published')) fail('essay index: published attribute missing');
 if (!listState.keywords.includes('food-culture')) fail(`essay index: bad keywords ${listState.keywords}`);
 if (!/^\d+ min read$/.test(listState.readtime)) fail(`essay index: bad readtime ${listState.readtime}`);
 await gotoPath(page, '/essay/taste-geopolitics-fractality/');
 const state = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent || '',
  bodyText: document.querySelector('.essay-body')?.textContent || '',
  author: document.querySelector('.essay-author__name')?.textContent?.trim() || '',
  published: document.querySelector('.essay-paper-meta time')?.textContent?.trim() || '',
  keywords: document.querySelector('.essay-keywords p')?.textContent || '',
  readtime: document.querySelector('.essay-actions .essay-readtime')?.textContent?.trim() || '',
  ogType: document.querySelector('meta[property="og:type"]')?.content || '',
  articleAuthor: document.querySelector('meta[property="article:author"]')?.content || '',
  articlePublished: document.querySelector('meta[property="article:published_time"]')?.content || '',
  articleTags: [...document.querySelectorAll('meta[property="article:tag"]')].map(el => el.content),
  jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
   .flatMap(script =>
   {
    try {
     const parsed = JSON.parse(script.textContent || '[]');
     return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
     return [];
    }
   }),
  printButton: !!document.querySelector('.essay-actions button'),
 }));
 if (!state.h1.includes('味覚地政学のフラクタル性')) fail(`essay detail: bad h1 ${state.h1}`);
 if (!state.bodyText.includes('味覚地政学')) fail('essay detail: body text missing');
 if (state.bodyText.includes('min read')) fail('essay detail: reading time leaked into body text');
 if (state.author !== 'USAGI.NETWORK') fail(`essay detail: bad author ${state.author}`);
 if (state.published !== '2026-07-01') fail(`essay detail: bad published date ${state.published}`);
 if (!state.keywords.includes('food-culture')) fail(`essay detail: bad keywords ${state.keywords}`);
 if (!/^\d+ min read$/.test(state.readtime)) fail(`essay detail: bad readtime ${state.readtime}`);
 if (state.ogType !== 'article') fail(`essay detail: bad og:type ${state.ogType}`);
 if (state.articleAuthor !== 'USAGI.NETWORK') fail(`essay detail: bad article author ${state.articleAuthor}`);
 if (!state.articlePublished.startsWith('2026-07-01')) fail(`essay detail: bad article published ${state.articlePublished}`);
 if (!state.articleTags.includes('food-culture')) fail(`essay detail: missing article tag ${state.articleTags.join(', ')}`);
 const articleJsonLd = state.jsonLd.find(item => item['@type'] === 'Article');
 if (!articleJsonLd) fail('essay detail: Article JSON-LD missing');
 else {
  if (articleJsonLd.headline !== '味覚地政学のフラクタル性') fail(`essay detail: bad JSON-LD headline ${articleJsonLd.headline}`);
  if (articleJsonLd.author?.name !== 'USAGI.NETWORK') fail(`essay detail: bad JSON-LD author ${articleJsonLd.author?.name}`);
  if (!String(articleJsonLd.keywords || '').includes('food-culture')) {
   fail(`essay detail: bad JSON-LD keywords ${articleJsonLd.keywords}`);
  }
 }
 if (!state.printButton) fail('essay detail: print button missing');

 await gotoPath(page, '/essay/observer-is-not-outside-the-universe/');
 const observer = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent || '',
  firstHeading: document.querySelector('.essay-body h2')?.textContent?.trim() || '',
  bodyText: document.querySelector('.essay-body')?.textContent || '',
  author: document.querySelector('.essay-author__name')?.textContent?.trim() || '',
  published: document.querySelector('.essay-paper-meta time')?.textContent?.trim() || '',
  keywords: document.querySelector('.essay-keywords p')?.textContent || '',
  duplicatedCoverMeta: [...document.querySelectorAll('.essay-body > p')]
   .some(el => ['Author', 'Published', 'Keywords'].includes(el.textContent?.trim() || '')),
 }));
 if (!observer.h1.includes('観測者は宇宙の外にいない')) fail(`observer essay: bad h1 ${observer.h1}`);
 if (observer.firstHeading !== 'Abstract') fail(`observer essay: bad first heading ${observer.firstHeading}`);
 if (!observer.bodyText.includes('観測者は宇宙の外にいない')) fail('observer essay: body text missing');
 if (observer.author !== 'USAGI.NETWORK') fail(`observer essay: bad author ${observer.author}`);
 if (observer.published !== '2026-07-17') fail(`observer essay: bad published date ${observer.published}`);
 if (!observer.keywords.includes('cosmology')) fail(`observer essay: bad keywords ${observer.keywords}`);
 if (observer.duplicatedCoverMeta) fail('observer essay: source cover metadata leaked into rendered body');
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

async function checkMetadata(page)
{
 await gotoPath(page, '/');
 const state = await page.evaluate(() => ({
  ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
  ogImageWidth: document.querySelector('meta[property="og:image:width"]')?.content || '',
  ogImageHeight: document.querySelector('meta[property="og:image:height"]')?.content || '',
  ogImageAlt: document.querySelector('meta[property="og:image:alt"]')?.content || '',
  ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
  twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || '',
  twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || '',
  twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || '',
  twitterImage: document.querySelector('meta[name="twitter:image"]')?.content || '',
  jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
   .flatMap(script =>
   {
    try {
     const parsed = JSON.parse(script.textContent || '[]');
     return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
     return [];
    }
   }),
 }));
 const expectedImage = new URL('/ogp/usagi-network.png', 'https://usagi.network').toString();
 if (state.ogImage !== expectedImage) fail(`metadata: bad og:image ${state.ogImage}`);
 if (state.twitterImage !== expectedImage) fail(`metadata: bad twitter:image ${state.twitterImage}`);
 if (state.ogImageWidth !== '1200' || state.ogImageHeight !== '630') {
  fail(`metadata: bad og:image size ${state.ogImageWidth}x${state.ogImageHeight}`);
 }
 if (state.ogImageAlt !== 'USAGI.NETWORK logo') fail(`metadata: bad og:image:alt ${state.ogImageAlt}`);
 if (state.ogLocale !== 'ja_JP') fail(`metadata: bad og:locale ${state.ogLocale}`);
 if (state.twitterCard !== 'summary_large_image') fail(`metadata: bad twitter:card ${state.twitterCard}`);
 if (!state.twitterTitle.includes('USAGI.NETWORK')) fail(`metadata: bad twitter:title ${state.twitterTitle}`);
 if (!state.twitterDescription.includes('USAGI.NETWORK')) {
  fail(`metadata: bad twitter:description ${state.twitterDescription}`);
 }
 const websiteJsonLd = state.jsonLd.find(item => item['@type'] === 'WebSite');
 if (!websiteJsonLd || websiteJsonLd.url !== 'https://usagi.network') {
  fail(`metadata: bad WebSite JSON-LD ${JSON.stringify(websiteJsonLd)}`);
 }

 const publicOgp = await page.request.get(new URL('/ogp/usagi-network.png', baseUrl).toString());
 if (publicOgp.status() !== 200) fail(`metadata: OGP image returned ${publicOgp.status()}`);

 const privateBrand = await page.request.get(new URL('/brand/un-logo-2026c.png', baseUrl).toString());
 if (privateBrand.status() !== 404) fail(`metadata: brand source should not be public, got ${privateBrand.status()}`);

 const privateBrandAsset = await page.request.get(new URL('/assets/brand/un-logo-2026c.png', baseUrl).toString());
 if (privateBrandAsset.status() !== 404) {
  fail(`metadata: brand source asset should not be public, got ${privateBrandAsset.status()}`);
 }

 const duplicateImage = await page.request.get(new URL('/assets/image/usagi-portrait.webp', baseUrl).toString());
 if (duplicateImage.status() !== 404) fail(`metadata: duplicate assets/image should not be public, got ${duplicateImage.status()}`);

 const publicImage = await page.request.get(new URL('/image/usagi-portrait.webp', baseUrl).toString());
 if (publicImage.status() !== 200) fail(`metadata: public image returned ${publicImage.status()}`);

 const unusedPortrait = await page.request.get(new URL('/image/usagi-portrait.png', baseUrl).toString());
 if (unusedPortrait.status() !== 404) fail(`metadata: unused portrait PNG should not be public, got ${unusedPortrait.status()}`);

 const duplicateIcon = await page.request.get(new URL('/assets/icons/twitch.svg', baseUrl).toString());
 if (duplicateIcon.status() !== 404) fail(`metadata: duplicate assets/icons should not be public, got ${duplicateIcon.status()}`);

 const publicIcon = await page.request.get(new URL('/icons/twitch.svg', baseUrl).toString());
 if (publicIcon.status() !== 200) fail(`metadata: public icon returned ${publicIcon.status()}`);

 const unusedSoftwarePng = await page.request.get(new URL('/assets/software/un-avatar/screenshot-0.png', baseUrl).toString());
 if (unusedSoftwarePng.status() !== 404) {
  fail(`metadata: unused software PNG screenshot should not be public, got ${unusedSoftwarePng.status()}`);
 }

 const publicSoftwareWebp = await page.request.get(new URL('/assets/software/un-avatar/screenshot-0.webp', baseUrl).toString());
 if (publicSoftwareWebp.status() !== 200) fail(`metadata: software WebP screenshot returned ${publicSoftwareWebp.status()}`);

 const legacyView = await page.request.get(new URL('/assets/views/home.html', baseUrl).toString());
 if (legacyView.status() !== 404) fail(`metadata: legacy SPA view should not be public, got ${legacyView.status()}`);

 const legacyRouter = await page.request.get(new URL('/assets/js/router.js', baseUrl).toString());
 if (legacyRouter.status() !== 404) fail(`metadata: legacy SPA router should not be public, got ${legacyRouter.status()}`);

 const robots = await page.request.get(new URL('/robots.txt', baseUrl).toString());
 const robotsText = await robots.text();
 if (robots.status() !== 200 || !robotsText.includes('Sitemap: https://usagi.network/sitemap-index.xml')) {
  fail(`metadata: bad robots.txt ${robots.status()}`);
 }

 const sitemap = await page.request.get(new URL('/sitemap-index.xml', baseUrl).toString());
 const sitemapText = await sitemap.text();
 if (sitemap.status() !== 200 || !sitemapText.includes('sitemap-0.xml')) {
  fail(`metadata: bad sitemap index ${sitemap.status()}`);
 }
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});
