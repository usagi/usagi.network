// Aggregate items from our data JSON and shape them for Home "Latest Activity".
import { SOURCES } from '#api/config.js';

export async function fetchLatestActivity() {
  const remoteBase = String(SOURCES.data?.streamBaseUrl || '').replace(/\/$/, '');
  const remoteSources = remoteBase ? [
    `${remoteBase}/twitch-clips.json`,
    `${remoteBase}/twitch-vods.json`,
    `${remoteBase}/youtube-archives.json`,
  ] : [];
  const sources = [
    ...remoteSources,
    '/assets/data/stream/twitch-clips.json',
    '/assets/data/stream/twitch-vods.json',
    '/assets/data/stream/youtube-archives.json',
  ];
  // Prefer remote version-1 data first; fallback to local assets if unavailable.
  const [clips, vods, yt] = await Promise.all([
    firstAvailableArray([sources[0], sources[3]].filter(Boolean)),
    firstAvailableArray([sources[1], sources[4]].filter(Boolean)),
    firstAvailableArray([sources[2], sources[5]].filter(Boolean)),
  ]);
  const mapItem = (it) => ({
    id: it.id || it.video_id || it.clip_id || it.yt_id || cryptoRandomId(),
    provider: it.provider || guessProvider(it),
    kind: it.kind || guessKind(it),
    title: it.title || 'Untitled',
    date: it.date || it.published_at || it.created_at || '',
    thumbnail: it.thumbnail || it.thumbnail_url || it.preview_image_url || '',
  });
  const all = [...clips, ...vods, ...yt].map(mapItem)
    .filter(x => x.id && x.date)
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  return all.slice(0, 12);
}

async function safeJson(path){
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function firstAvailableArray(paths){
  for (const p of paths){
    const data = await safeJson(p);
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    if (items.length) return items;
  }
  return [];
}

function guessProvider(it){
  if (it.preview_image_url || /ttv|twitch/i.test(it.thumbnail_url||'')) return 'twitch';
  return 'youtube';
}
function guessKind(it){
  if (it.clip_id || (it.kind === 'clip')) return 'clip';
  if (it.video_id || it.kind === 'vod') return 'vod';
  return 'archive';
}
function cryptoRandomId(){
  try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(16); } catch { return Math.random().toString(16).slice(2); }
}
