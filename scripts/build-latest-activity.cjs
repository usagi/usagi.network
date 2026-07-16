#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readJson(rel, fallback)
{
 try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
 catch { return fallback; }
}

function normalizeStream(items, provider, kind)
{
 return (Array.isArray(items) ? items : []).map(item => ({
  id: item.id || item.video_id || item.clip_id || item.yt_id || '',
  provider: item.provider || provider,
  kind: item.kind || kind,
  title: item.title || 'Untitled',
  date: item.date || item.published_at || item.created_at || '',
  thumbnail: item.thumbnail || item.thumbnail_url || item.preview_image_url || item.thumb || '',
  url: item.url || buildStreamUrl(item, provider, kind),
 })).filter(item => item.id && item.date);
}

function buildStreamUrl(item, provider, kind)
{
 const id = item.id || item.video_id || item.clip_id || item.yt_id || '';
 if (!id) return '';
 if (provider === 'twitch' && kind === 'clip') return `https://clips.twitch.tv/${id}`;
 if (provider === 'twitch') return `https://www.twitch.tv/videos/${id}`;
 if (provider === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
 return '';
}

function normalizeVersion(value)
{
 return String(value || '').trim().replace(/^v/i, '');
}

function buildReleaseUrl(repo, tag)
{
 if (!repo) return '';
 const cleanTag = String(tag || '').trim();
 return cleanTag ? `https://github.com/${repo}/releases/tag/${encodeURIComponent(cleanTag)}` : `https://github.com/${repo}/releases`;
}

function softwareReleases()
{
 const data = readJson('assets/data/software.json', { groups: [] });
 const items = (data.groups || []).flatMap(group => group.items || []);
 return items.map(item =>
 {
  const rawTag = item.fallbackVersion || '';
  const releaseTag = item.fallbackReleaseTag || rawTag;
  const version = normalizeVersion(rawTag);
  return {
   id: `release:${item.repo}:${releaseTag || version}`,
   provider: 'github',
   kind: 'release',
   title: `${item.title || item.repo} ${rawTag || `v${version}`}`,
   date: item.fallbackReleaseDate || '',
   thumbnail: item.media?.screenshot || item.media?.icon || '',
   url: buildReleaseUrl(item.repo, releaseTag || version),
  };
 }).filter(item => item.id && item.date);
}

function main()
{
 const clips = normalizeStream(readJson('assets/data/stream/twitch-clips.json', []), 'twitch', 'clip');
 const vods = normalizeStream(readJson('assets/data/stream/twitch-vods.json', []), 'twitch', 'vod');
 const yt = normalizeStream(readJson('assets/data/stream/youtube-archives.json', []), 'youtube', 'archive');
 const releases = softwareReleases();
 const streamItems = [...clips, ...vods, ...yt]
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  .slice(0, 9);
 const releaseItems = releases
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  .slice(0, 3);
 const items = [...streamItems, ...releaseItems]
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  .slice(0, 12);
 const payload = {
  generated_at: new Date().toISOString(),
  items,
 };
 const out = path.join(root, 'assets/data/latest-activity.json');
 fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
 console.log(`Wrote ${items.length} latest activity items -> ${path.relative(root, out)}`);
}

main();
