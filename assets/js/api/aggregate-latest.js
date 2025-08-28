// Aggregate items from our data JSON and shape them for Home "Latest Activity".
export async function fetchLatestActivity() {
  const sources = [
    '/assets/data/stream/twitch-clips.json',
    '/assets/data/stream/twitch-vods.json',
    '/assets/data/stream/youtube-archives.json',
  ];
  const results = await Promise.all(sources.map(p => safeJson(p)));
  const [clips, vods, yt] = results.map(x => (Array.isArray(x) ? x : []));
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
