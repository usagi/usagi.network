# Cloudflare Worker: usagi-network-stream-proxy

This Worker exposes JSON endpoints to proxy Twitch/YouTube for the site without exposing secrets to clients.

## Endpoints

- GET /api/twitch/clips -> latest clips (12)
- GET /api/twitch/vods -> latest vods (12)
- GET /api/youtube/archives -> latest youtube videos (12)
- GET /api/soundcloud/tracks -> latest soundcloud tracks (rss based)

## Env Vars (Wrangler)

- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET
- TWITCH_CHANNEL_LOGIN (default set in wrangler.toml)
- YOUTUBE_API_KEY
- YOUTUBE_CHANNEL_ID
- SOUNDCLOUD_PROFILE_URL (optional, default: <https://soundcloud.com/usagi-network>)
- SOUNDCLOUD_USER_ID (optional; if omitted, resolved from oEmbed)
- SOUNDCLOUD_LIMIT (optional, default: 50)

## Deploy

- Install Wrangler: npm i -g wrangler
- Configure secrets:

```bash
wrangler secret put TWITCH_CLIENT_ID
wrangler secret put TWITCH_CLIENT_SECRET
wrangler secret put YOUTUBE_API_KEY
wrangler secret put YOUTUBE_CHANNEL_ID
```

- Publish:

```bash
wrangler deploy
```

Set the site config at `assets/js/api/config.js`:

```js
export const SOURCES = {
  // ...
  api: { base: 'https://<your-worker>.workers.dev' }
};
```
