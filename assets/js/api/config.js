// Centralized content source configuration
export const SOURCES = {
 youtube: {
  // Prefer channelId if you have it; otherwise we'll use the handle only for links.
  channelId: null, // e.g., 'UCxxxxxxxxxxxxxxxxxx'
  // If you know uploads playlist id, set it to auto-updating official playlist embed:
  // uploadsPlaylistId = 'UU' + channelId.slice(2)
  uploadsPlaylistId: null,
  handle: 'usagi.network', // YouTube handle without leading '@'
  limit: 12,
  useOfficialPlaylistEmbed: false,
 },
 twitch: {
  channel: 'usaginetwork',
  clipsLimit: 12,
  vodsLimit: 12,
  useOfficialEmbeds: false,
 },
 api: {
  // Set your Cloudflare Worker base URL (no trailing slash), e.g. 'https://your-worker.workers.dev'
  base: 'https://usagi-network-stream-proxy.usaginetwork.workers.dev',
 }
};
