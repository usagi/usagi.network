// Aggregate items from our data JSON and shape them for Home "Latest Activity".
import { SOURCES } from '#api/config.js';
import { getLatestGitHubReleases } from '#api/github.js?v=20260528';

export async function fetchLatestActivity()
{
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
 const [clips, vods, yt, releases] = await Promise.all([
  firstAvailableArray([sources[0], sources[3]].filter(Boolean)),
  firstAvailableArray([sources[1], sources[4]].filter(Boolean)),
  firstAvailableArray([sources[2], sources[5]].filter(Boolean)),
  fetchSoftwareReleases(),
 ]);
 const mapItem = (it) => ({
  id: it.id || it.video_id || it.clip_id || it.yt_id || cryptoRandomId(),
  provider: it.provider || guessProvider(it),
  kind: it.kind || guessKind(it),
  title: it.title || 'Untitled',
  date: it.date || it.published_at || it.created_at || '',
  thumbnail: it.thumbnail || it.thumbnail_url || it.preview_image_url || '',
 });
 const streamItems = [...clips, ...vods, ...yt].map(mapItem)
  .filter(x => x.id && x.date)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
 const releaseItems = releases
  .filter(x => x.id && x.date)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
 return [...streamItems.slice(0, 9), ...releaseItems.slice(0, 3)]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 12);
}

async function fetchSoftwareReleases()
{
 try
 {
  const data = await safeJson('/assets/data/software.json');
  const items = (data?.groups || []).flatMap(group => group.items || []);
  const repos = items.map(item => item.repo).filter(Boolean);
  let releases = [];
  try { releases = await getLatestGitHubReleases(repos); } catch { releases = []; }
  const byRepo = new Map(releases.map(release => [release.repo, release]));
  return items.map(item =>
  {
   const release = byRepo.get(item.repo) || {};
   const rawTag = release.rawTag || item.fallbackVersion || '';
   const version = release.version || normalizeVersion(rawTag);
   return {
    id: `release:${item.repo}:${rawTag || version}`,
    provider: 'github',
    kind: 'release',
    title: `${item.title || item.repo} ${rawTag || `v${version}`}`,
    date: release.date || item.fallbackReleaseDate || '',
    thumbnail: item.media?.screenshot || item.media?.icon || '',
    url: release.url || buildReleaseUrl(item.repo, rawTag || version),
   };
  }).filter(item => item.date);
 } catch { return []; }
}

function buildReleaseUrl(repo, tag)
{
 if (!repo) return '';
 const cleanTag = String(tag || '').replace(/^v/i, '');
 return cleanTag ? `https://github.com/${repo}/releases/tag/${encodeURIComponent(cleanTag)}` : `https://github.com/${repo}/releases`;
}

async function safeJson(path)
{
 try
 {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) return null;
  return await res.json();
 } catch { return null; }
}

async function firstAvailableArray(paths)
{
 for (const p of paths)
 {
  const data = await safeJson(p);
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  if (items.length) return items;
 }
 return [];
}

function guessProvider(it)
{
 if (it.preview_image_url || /ttv|twitch/i.test(it.thumbnail_url || '')) return 'twitch';
 return 'youtube';
}
function guessKind(it)
{
 if (it.clip_id || (it.kind === 'clip')) return 'clip';
 if (it.video_id || it.kind === 'vod') return 'vod';
 return 'archive';
}
function normalizeVersion(value)
{
 return String(value || '').trim().replace(/^v/i, '');
}
function cryptoRandomId()
{
 try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(16); } catch { return Math.random().toString(16).slice(2); }
}
