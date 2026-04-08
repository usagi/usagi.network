export default {
 async fetch(request, env)
 {
  const url = new URL(request.url);
  // Normalize path and strip leading / and optional api/ prefix
  let path = url.pathname.replace(/^\/+/, '');
  if (path.toLowerCase().startsWith('api/')) path = path.slice(4);

  // Handle CORS preflight
  if (request.method === 'OPTIONS')
  {
   return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try
  {
   if (path === 'diag')
   {
    const present = {
     TWITCH_CLIENT_ID: !!env.TWITCH_CLIENT_ID,
     TWITCH_CLIENT_SECRET: !!env.TWITCH_CLIENT_SECRET,
     TWITCH_CHANNEL_LOGIN: !!env.TWITCH_CHANNEL_LOGIN,
     YOUTUBE_API_KEY: !!env.YOUTUBE_API_KEY,
     YOUTUBE_CHANNEL_ID: !!env.YOUTUBE_CHANNEL_ID,
     SOUNDCLOUD_PROFILE_URL: !!env.SOUNDCLOUD_PROFILE_URL,
     SOUNDCLOUD_USER_ID: !!env.SOUNDCLOUD_USER_ID,
    };
    return json(present, 0);
   }
   if (path === 'twitch/clips')
   {
    const data = await fetchTwitchClips(env);
    return json(data, 300);
   }
   if (path === 'twitch/vods')
   {
    const data = await fetchTwitchVods(env);
    return json(data, 300);
   }
   if (path === 'youtube/archives')
   {
    const data = await fetchYouTube(env);
    return json(data, 600);
   }
   if (path === 'soundcloud/tracks')
   {
    const data = await fetchSoundCloudTracks(env);
    return json(data, 900);
   }
   return withCors(new Response('Not found', { status: 404 }));
  } catch (e)
  {
   return withCors(new Response('Proxy error', { status: 502 }));
  }
 },
};

function corsHeaders()
{
 return {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
  'vary': 'Origin',
 };
}

function withCors(res)
{
 const headers = new Headers(res.headers);
 const cors = corsHeaders();
 Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
 return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function json(obj, maxAge = 60)
{
 const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': `public, max-age=${maxAge}`,
  ...corsHeaders(),
 };
 return new Response(JSON.stringify(obj), { headers });
}

async function fetchJson(url, opts)
{
 const res = await fetch(url, opts);
 if (!res.ok)
 {
  const t = await res.text().catch(() => '');
  throw new Error(`bad upstream ${res.status}: ${t.slice(0, 200)}`);
 }
 return res.json();
}

async function getTwitchAppToken(env)
{
 const params = new URLSearchParams({
  client_id: env.TWITCH_CLIENT_ID,
  client_secret: env.TWITCH_CLIENT_SECRET,
  grant_type: 'client_credentials',
 });
 const res = await fetchJson('https://id.twitch.tv/oauth2/token', {
  method: 'POST',
  body: params,
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
 });
 return res.access_token;
}

async function getTwitchUser(login, token, env)
{
 const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
 const res = await fetchJson(url, {
  headers: {
   'Client-ID': env.TWITCH_CLIENT_ID,
   'Authorization': `Bearer ${token}`,
  }
 });
 return res.data && res.data[0];
}

async function fetchTwitchClips(env)
{
 if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN)
 {
  console.warn('TWITCH secrets missing');
  return [];
 }
 const token = await getTwitchAppToken(env);
 const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
 if (!user) return [];
 const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=12`;
 const res = await fetchJson(url, { headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` } });
 return (res.data || []).map(c => ({ provider: 'twitch', kind: 'clip', id: c.id, title: c.title, date: c.created_at, thumbnail_url: c.thumbnail_url }));
}

async function fetchTwitchVods(env)
{
 if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN)
 {
  console.warn('TWITCH secrets missing');
  return [];
 }
 const token = await getTwitchAppToken(env);
 const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
 if (!user) return [];
 const url = `https://api.twitch.tv/helix/videos?user_id=${user.id}&first=12&type=archive`;
 const res = await fetchJson(url, { headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` } });
 const items = (res.data || []).map(v => ({ provider: 'twitch', kind: 'vod', id: v.id, title: v.title, date: v.published_at, thumbnail_url: v.thumbnail_url }));
 // Replace Twitch template tokens with concrete size for thumbnails
 items.forEach(it =>
 {
  if (it.thumbnail_url)
  {
   it.thumbnail_url = it.thumbnail_url.replace('%{width}x%{height}', '640x360').replace('{width}x{height}', '640x360');
  }
 });
 return items;
}

async function fetchYouTube(env)
{
 if (!env.YOUTUBE_API_KEY || !env.YOUTUBE_CHANNEL_ID)
 {
  console.warn('YOUTUBE secrets missing');
  return [];
 }
 const url = `https://www.googleapis.com/youtube/v3/search?key=${env.YOUTUBE_API_KEY}&channelId=${env.YOUTUBE_CHANNEL_ID}&maxResults=12&order=date&part=snippet&type=video`;
 const res = await fetchJson(url);
 return (res.items || []).map(it => ({ provider: 'youtube', kind: 'archive', id: it.id.videoId, title: it.snippet.title, date: it.snippet.publishedAt, thumbnail_url: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url }));
}

async function fetchText(url, opts)
{
 const res = await fetch(url, opts);
 if (!res.ok)
 {
  const t = await res.text().catch(() => '');
  throw new Error(`bad upstream ${res.status}: ${t.slice(0, 200)}`);
 }
 return res.text();
}

function decodeEntities(input)
{
 return String(input || '')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&amp;', '&');
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
 let parsed = null;
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
  const title = getTag(block, 'title') || 'Untitled';
  const description = getTag(block, 'description') || getTag(block, 'itunes:summary') || '';
  const date = getTag(block, 'pubDate');
  const duration = parseDurationToMs(getTag(block, 'itunes:duration'));
  const permalink = getTag(block, 'link');
  const artwork = getTagAttr(block, 'itunes:image', 'href') || '';
  if (!permalink) continue;
  items.push({
   title,
   description,
   created_at: date ? new Date(date).toISOString() : '',
   duration,
   permalink_url: permalink,
   artwork_url: artwork,
   user: { username: 'USAGI.NETWORK' },
  });
 }
 return items;
}

async function resolveSoundCloudUserId(env, profileUrl)
{
 if (env.SOUNDCLOUD_USER_ID) return String(env.SOUNDCLOUD_USER_ID);
 const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(profileUrl)}`;
 const oembed = await fetchText(oembedUrl);
 return extractUserIdFromOEmbed(oembed);
}

async function fetchSoundCloudTracks(env)
{
 const profileUrl = String(env.SOUNDCLOUD_PROFILE_URL || 'https://soundcloud.com/usagi-network');
 const userId = await resolveSoundCloudUserId(env, profileUrl);
 if (!userId)
 {
  console.warn('SOUNDCLOUD user id could not be resolved');
  return { generated_at: new Date().toISOString(), source: { profile_url: profileUrl, user_id: null }, tracks: [] };
 }
 const limit = Math.max(1, Number(env.SOUNDCLOUD_LIMIT || 50));
 const feedUrl = `https://feeds.soundcloud.com/users/soundcloud:users:${userId}/sounds.rss`;
 const rss = await fetchText(feedUrl, {
  headers: {
   'accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
   'user-agent': 'usagi-network-stream-proxy',
  },
 });
 const tracks = parseRssItems(rss)
  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  .slice(0, limit);
 return {
  generated_at: new Date().toISOString(),
  source: { profile_url: profileUrl, feed_url: feedUrl, user_id: userId },
  tracks,
 };
}
