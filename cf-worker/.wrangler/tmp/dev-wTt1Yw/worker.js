var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/^\/+/, "");
    if (path.toLowerCase().startsWith("api/")) path = path.slice(4);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    try {
      if (path === "diag") {
        const present = {
          TWITCH_CLIENT_ID: !!env.TWITCH_CLIENT_ID,
          TWITCH_CLIENT_SECRET: !!env.TWITCH_CLIENT_SECRET,
          TWITCH_CHANNEL_LOGIN: !!env.TWITCH_CHANNEL_LOGIN,
          YOUTUBE_API_KEY: !!env.YOUTUBE_API_KEY,
          YOUTUBE_CHANNEL_ID: !!env.YOUTUBE_CHANNEL_ID
        };
        return json(present, 0);
      }
      if (path === "twitch/clips") {
        const data = await fetchTwitchClips(env);
        return json(data, 300);
      }
      if (path === "twitch/vods") {
        const data = await fetchTwitchVods(env);
        return json(data, 300);
      }
      if (path === "youtube/archives") {
        const data = await fetchYouTube(env);
        return json(data, 600);
      }
      return withCors(new Response("Not found", { status: 404 }));
    } catch (e) {
      return withCors(new Response("Proxy error", { status: 502 }));
    }
  }
};
function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function withCors(res) {
  const headers = new Headers(res.headers);
  const cors = corsHeaders();
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
__name(withCors, "withCors");
function json(obj, maxAge = 60) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=${maxAge}`,
    ...corsHeaders()
  };
  return new Response(JSON.stringify(obj), { headers });
}
__name(json, "json");
async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`bad upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}
__name(fetchJson, "fetchJson");
async function getTwitchAppToken(env) {
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });
  const res = await fetchJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params,
    headers: { "content-type": "application/x-www-form-urlencoded" }
  });
  return res.access_token;
}
__name(getTwitchAppToken, "getTwitchAppToken");
async function getTwitchUser(login, token, env) {
  const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
  const res = await fetchJson(url, { headers: {
    "Client-ID": env.TWITCH_CLIENT_ID,
    "Authorization": `Bearer ${token}`
  } });
  return res.data && res.data[0];
}
__name(getTwitchUser, "getTwitchUser");
async function fetchTwitchClips(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN) {
    console.warn("TWITCH secrets missing");
    return [];
  }
  const token = await getTwitchAppToken(env);
  const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
  if (!user) return [];
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=12`;
  const res = await fetchJson(url, { headers: { "Client-ID": env.TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` } });
  return (res.data || []).map((c) => ({ provider: "twitch", kind: "clip", id: c.id, title: c.title, date: c.created_at, thumbnail_url: c.thumbnail_url }));
}
__name(fetchTwitchClips, "fetchTwitchClips");
async function fetchTwitchVods(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_CHANNEL_LOGIN) {
    console.warn("TWITCH secrets missing");
    return [];
  }
  const token = await getTwitchAppToken(env);
  const user = await getTwitchUser(env.TWITCH_CHANNEL_LOGIN, token, env);
  if (!user) return [];
  const url = `https://api.twitch.tv/helix/videos?user_id=${user.id}&first=12&type=archive`;
  const res = await fetchJson(url, { headers: { "Client-ID": env.TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` } });
  const items = (res.data || []).map((v) => ({ provider: "twitch", kind: "vod", id: v.id, title: v.title, date: v.published_at, thumbnail_url: v.thumbnail_url }));
  items.forEach((it) => {
    if (it.thumbnail_url) {
      it.thumbnail_url = it.thumbnail_url.replace("%{width}x%{height}", "640x360").replace("{width}x{height}", "640x360");
    }
  });
  return items;
}
__name(fetchTwitchVods, "fetchTwitchVods");
async function fetchYouTube(env) {
  if (!env.YOUTUBE_API_KEY || !env.YOUTUBE_CHANNEL_ID) {
    console.warn("YOUTUBE secrets missing");
    return [];
  }
  const url = `https://www.googleapis.com/youtube/v3/search?key=${env.YOUTUBE_API_KEY}&channelId=${env.YOUTUBE_CHANNEL_ID}&maxResults=12&order=date&part=snippet&type=video`;
  const res = await fetchJson(url);
  return (res.items || []).map((it) => ({ provider: "youtube", kind: "archive", id: it.id.videoId, title: it.snippet.title, date: it.snippet.publishedAt, thumbnail_url: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url }));
}
__name(fetchYouTube, "fetchYouTube");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-DtTft2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-DtTft2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
