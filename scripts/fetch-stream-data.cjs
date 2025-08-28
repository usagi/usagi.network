#!/usr/bin/env node
/* eslint-disable no-console */
// Fetch Twitch clips and VODs + YouTube latest videos, write JSON into assets/data/stream
// Requires env: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_LOGIN, YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID

const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchJson(url, opts = {}){
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function getTwitchAppToken(){
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  }).toString();
  const res = await fetchJson(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  return res.access_token;
}

async function getTwitchUser(login, token){
  const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
  const res = await fetchJson(url, {
    headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` },
  });
  return res.data && res.data[0];
}

async function getTwitchClips(broadcaster_id, token, limit = 12){
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcaster_id}&first=${limit}`;
  const res = await fetchJson(url, {
    headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` },
  });
  return (res.data || []).map(c => ({
    provider: 'twitch', kind: 'clip', id: c.id, title: c.title, date: c.created_at, thumbnail_url: c.thumbnail_url,
  }));
}

async function getTwitchVods(user_id, token, limit = 12){
  const url = `https://api.twitch.tv/helix/videos?user_id=${user_id}&first=${limit}&type=archive`;
  const res = await fetchJson(url, {
    headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` },
  });
  return (res.data || []).map(v => ({
    provider: 'twitch', kind: 'vod', id: v.id, title: v.title, date: v.published_at, thumbnail_url: v.thumbnail_url,
  }));
}

async function getYouTubeVideos(channelId, apiKey, limit = 12){
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&maxResults=${limit}&order=date&part=snippet&type=video`;
  const res = await fetchJson(searchUrl);
  return (res.items || []).map(it => ({
    provider: 'youtube', kind: 'archive', id: it.id.videoId, title: it.snippet.title, date: it.snippet.publishedAt,
    thumbnail_url: it.snippet.thumbnails && (it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || it.snippet.thumbnails.default?.url),
  }));
}

(async () => {
  const outDir = path.join(__dirname, '..', 'assets', 'data', 'stream');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // Twitch
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET && process.env.TWITCH_CHANNEL_LOGIN){
      const token = await getTwitchAppToken();
      const user = await getTwitchUser(process.env.TWITCH_CHANNEL_LOGIN, token);
      if (user){
        const [clips, vods] = await Promise.all([
          getTwitchClips(user.id, token, 12),
          getTwitchVods(user.id, token, 12),
        ]);
        fs.writeFileSync(path.join(outDir, 'twitch-clips.json'), JSON.stringify(clips, null, 2));
        fs.writeFileSync(path.join(outDir, 'twitch-vods.json'), JSON.stringify(vods, null, 2));
        console.log('Wrote twitch JSON');
      } else {
        console.warn('Twitch user not found');
      }
    } else {
      console.warn('Skipping Twitch: missing env');
    }

    // YouTube
    if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID){
      const yt = await getYouTubeVideos(process.env.YOUTUBE_CHANNEL_ID, process.env.YOUTUBE_API_KEY, 12);
      fs.writeFileSync(path.join(outDir, 'youtube-archives.json'), JSON.stringify(yt, null, 2));
      console.log('Wrote youtube JSON');
    } else {
      console.warn('Skipping YouTube: missing env');
    }
  } catch (e){
    console.error('Fetcher failed', e);
    process.exitCode = 1;
  }
})();
