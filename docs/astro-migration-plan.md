# Astro migration plan

This site is being migrated from a hash-based SPA/Trunk frontend to an Astro
static site. The migration goal is not only a visual rewrite. It must preserve
the existing automated content refresh behavior and improve search/indexability.

## Decisions

- Use Astro as the primary static site generator.
- Prefer normal URLs over hash routes.
- Keep GitHub Pages as the hosting target for long-term survivability.
- Keep content source files simple and inspectable: Markdown, JSON, images, and
  static assets.
- Keep automatic refresh of external activity data. The site must not depend on
  manual website updates for routine activity.
- Rename the auto-refreshed data branch role from `version-1` to `auto-data`.
- Render searchable HTML at build time, then use client JavaScript only for
  progressive enhancement such as media players, lightboxes, BGM controls, live
  embeds, and optional latest-data refresh.

## Existing refresh contracts to preserve

| Area | Current source | Current output |
| --- | --- | --- |
| Twitch clips and VODs | `scripts/fetch-stream-data.cjs` using Twitch Helix | `assets/data/stream/*.json` |
| YouTube archives | `scripts/fetch-stream-data.cjs` using YouTube Data API | `assets/data/stream/youtube-archives.json` |
| SoundCloud tracks | `scripts/fetch-soundcloud-data.cjs` using oEmbed + RSS | `assets/data/soundcloud-tracks.json` |
| Software releases | `scripts/refresh-software-releases.cjs` using GitHub releases/tags | `assets/data/software.json` fallback metadata |
| Latest Activity | Derived from stream JSON + software release metadata | should become `assets/data/latest-activity.json` and static homepage HTML |

## Target build pipeline

```text
scheduled workflow or manual dispatch
  -> fetch stream data
  -> fetch soundcloud data
  -> refresh software release metadata
  -> build latest activity JSON
  -> Astro build
  -> smoke test static output
  -> deploy GitHub Pages artifact
  -> persist refreshed JSON to auto-data
```

The built site should remain usable if external APIs are unavailable. In that
case, the previous committed JSON data is the fallback source of truth.

## URL shape

```text
/
/stream/
/music/
/software/
/software/<slug>/
/artwork/
/essay/
/essay/<slug>/
/about/
```

## Essay handling

Essay Markdown files are canonical source documents. The web version is rendered
as dark-mode HTML. Print/PDF output should use print CSS with a light paper-like
layout.

