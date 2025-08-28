// Centralized content source configuration
export const SOURCES = {
 youtube: {
  // Prefer channelId if you have it; otherwise we'll scrape the handle page.
  channelId: null, // e.g., 'UCxxxxxxxxxxxxxxxxxx'
  handle: 'usagi.network', // YouTube handle without leading '@'
  limit: 12,
 },
 twitch: {
  channel: 'usaginetwork',
  clipsLimit: 12,
  vodsLimit: 12,
 },
};
