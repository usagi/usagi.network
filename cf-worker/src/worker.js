export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Normalize path and strip leading / and optional api/ prefix
    let path = url.pathname.replace(/^\/+/, '');
    if (path.toLowerCase().startsWith('api/')) path = path.slice(4);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (path === 'diag') {
        const present = {
          TWITCH_CLIENT_ID: !!env.TWITCH_CLIENT_ID,
          TWITCH_CLIENT_SECRET: !!env.TWITCH_CLIENT_SECRET,
          TWITCH_CHANNEL_LOGIN: !!env.TWITCH_CHANNEL_LOGIN,
          YOUTUBE_API_KEY: !!env.YOUTUBE_API_KEY,
          YOUTUBE_CHANNEL_ID: !!env.YOUTUBE_CHANNEL_ID,
        };
        return json(present, 0);
      }
      if (path === 'twitch/clips') {
        const data = await fetchTwitchClips(env);
        return json(data, 300);
      }
      if (path === 'twitch/vods') {
        const data = await fetchTwitchVods(env);
        return json(data, 300);
      }
      if (path === 'youtube/archives') {
        const data = await fetchYouTube(env);
        return json(data, 600);
      }
      return withCors(new Response('Not found', { status: 404 }));
    } catch (e) {
      return withCors(new Response('Proxy error', { status: 502 }));
    }
  },
};

function corsHeaders(){
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function withCors(res){
  const headers = new Headers(res.headers);
  const cors = corsHeaders();
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function json(obj, maxAge = 60){
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': `public, max-age=${maxAge}`,
    ...corsHeaders(),
  };
  return new Response(JSON.stringify(obj), { headers });
}

async function fetchJson(url, opts){
  const res = await fetch(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`bad upstream ${res.status}: ${t.slice(0,200)}`);
  }
  return res.json();
}

async function getTwitchAppToken(env){
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

async function getTwitchUser(login, token, env){
  const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
  const res = await fetchJson(url, { headers: {
    'Client-ID': env.TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${token}`,
  }});
  return res.data && res.data[0];
}

async function fetchTwitchClips(env){
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN) {
    console.warn('TWITCH secrets missing');
    return [];
  }
  const token = await getTwitchAppToken(env);
  const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
  if (!user) return [];
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=12`;
  const res = await fetchJson(url, { headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` } });
  return (res.data || []).map(c => ({ provider:'twitch', kind:'clip', id:c.id, title:c.title, date:c.created_at, thumbnail_url:c.thumbnail_url }));
}

async function fetchTwitchVods(env){
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN) {
    console.warn('TWITCH secrets missing');
    return [];
  }
  const token = await getTwitchAppToken(env);
  const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
  if (!user) return [];
  const url = `https://api.twitch.tv/helix/videos?user_id=${user.id}&first=12&type=archive`;
  const res = await fetchJson(url, { headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` } });
  const items = (res.data || []).map(v => ({ provider:'twitch', kind:'vod', id:v.id, title:v.title, date:v.published_at, thumbnail_url: v.thumbnail_url }));
  // Replace Twitch template tokens with concrete size for thumbnails
  items.forEach(it => {
    if (it.thumbnail_url){
      it.thumbnail_url = it.thumbnail_url.replace('%{width}x%{height}', '640x360').replace('{width}x{height}', '640x360');
    }
  });
  return items;
}

async function fetchYouTube(env){
  if (!env.YOUTUBE_API_KEY || !env.YOUTUBE_CHANNEL_ID) {
    console.warn('YOUTUBE secrets missing');
    return [];
  }
  const url = `https://www.googleapis.com/youtube/v3/search?key=${env.YOUTUBE_API_KEY}&channelId=${env.YOUTUBE_CHANNEL_ID}&maxResults=12&order=date&part=snippet&type=video`;
  const res = await fetchJson(url);
  return (res.items || []).map(it => ({ provider:'youtube', kind:'archive', id:it.id.videoId, title:it.snippet.title, date:it.snippet.publishedAt, thumbnail_url: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url }));
}
