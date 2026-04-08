#!/usr/bin/env node
/* eslint-disable no-console */
// Fetch SoundCloud tracks via public RSS feed and write JSON into assets/data.

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROFILE_URL = process.env.SOUNDCLOUD_PROFILE_URL || 'https://soundcloud.com/usagi-network';
const USER_ID_OVERRIDE = process.env.SOUNDCLOUD_USER_ID || '';
const LIMIT = Math.max(1, Number(process.env.SOUNDCLOUD_LIMIT || 50));

function fetchText(url)
{
 return new Promise((resolve, reject) =>
 {
  const req = https.get(url, {
   headers: {
    'user-agent': 'usagi.network soundcloud fetcher',
    'accept': 'application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
   },
  }, (res) =>
  {
   let data = '';
   res.setEncoding('utf8');
   res.on('data', (c) => data += c);
   res.on('end', () =>
   {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300)
    {
     resolve(data);
     return;
    }
    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
   });
  });
  req.on('error', reject);
 });
}

function decodeEntities(input)
{
 return String(input || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');
}

function stripCdata(text)
{
 const s = String(text || '').trim();
 const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
 return m ? m[1] : s;
}

function getTag(block, tagName)
{
 const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
 const m = String(block || '').match(re);
 if (!m) return '';
 return decodeEntities(stripCdata(m[1]).trim());
}

function getTagAttr(block, tagName, attrName)
{
 const re = new RegExp(`<${tagName}[^>]*\\b${attrName}="([^"]+)"[^>]*>`, 'i');
 const m = String(block || '').match(re);
 return m ? decodeEntities(m[1]) : '';
}

function parseDurationToMs(text)
{
 const raw = String(text || '').trim();
 if (!raw) return 0;
 const parts = raw.split(':').map((x) => Number(x));
 if (parts.some((n) => Number.isNaN(n))) return 0;
 let sec = 0;
 if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
 else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
 else if (parts.length === 1) sec = parts[0];
 return Math.max(0, Math.floor(sec * 1000));
}

function extractUserIdFromOEmbed(jsonText)
{
 let parsed;
 try { parsed = JSON.parse(jsonText); } catch { return ''; }
 const html = String(parsed?.html || '');
 const m = html.match(/api\.soundcloud\.com%2Fusers%2F(\d+)/i) || html.match(/api\.soundcloud\.com\/users\/(\d+)/i);
 return m ? m[1] : '';
}

function parseRssItems(xml)
{
 const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
 const items = [];
 let m;
 while ((m = itemRegex.exec(xml)) !== null)
 {
  const block = m[1];
  const link = getTag(block, 'link');
  const title = getTag(block, 'title') || 'Untitled';
  const description = getTag(block, 'description') || getTag(block, 'itunes:summary') || '';
  const created = getTag(block, 'pubDate');
  const duration = parseDurationToMs(getTag(block, 'itunes:duration'));
  const image = getTagAttr(block, 'itunes:image', 'href') || '';
  items.push({
   title,
   description,
   created_at: created ? new Date(created).toISOString() : '',
   duration,
   permalink_url: link,
   artwork_url: image,
   user: { username: 'USAGI.NETWORK' },
  });
 }
 return items.filter((x) => x.permalink_url);
}

async function resolveUserId()
{
 if (USER_ID_OVERRIDE) return USER_ID_OVERRIDE;
 const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(PROFILE_URL)}`;
 const oembed = await fetchText(oembedUrl);
 const userId = extractUserIdFromOEmbed(oembed);
 if (!userId) throw new Error('Failed to resolve SoundCloud user id from oEmbed');
 return userId;
}

async function main()
{
 const outPath = path.join(__dirname, '..', 'assets', 'data', 'soundcloud-tracks.json');
 fs.mkdirSync(path.dirname(outPath), { recursive: true });

 const userId = await resolveUserId();
 const feedUrl = `https://feeds.soundcloud.com/users/soundcloud:users:${userId}/sounds.rss`;
 const rss = await fetchText(feedUrl);
 let tracks = parseRssItems(rss);
 tracks = tracks
  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  .slice(0, LIMIT);

 const payload = {
  generated_at: new Date().toISOString(),
  source: {
   profile_url: PROFILE_URL,
   feed_url: feedUrl,
   user_id: userId,
  },
  tracks,
 };

 fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
 console.log(`Wrote ${tracks.length} tracks -> ${outPath}`);
}

main().catch((err) =>
{
 console.error('SoundCloud fetch failed:', err.message || err);
 process.exitCode = 1;
});
