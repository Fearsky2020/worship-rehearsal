# Worship Rehearsal V3.2

V3.2 adds two production fixes/features.

## 1. Browser cache busting
Frontend assets now use:
- `styles.css?v=3.2.0`
- `app.js?v=3.2.0`

This prevents Chrome from continuing to run an old broken JavaScript file after a deployment.

## 2. Search Worker V1
A deployable Cloudflare Worker is included under `worker/`.

V1 supports:
- `/health`
- `/search`
- chord / staff / numbered score searches
- result source metadata
- exclude source / URL for “继续找”

The Worker uses Brave Search API via the `BRAVE_API_KEY` Worker secret.

## Frontend Worker setting
V3.2 adds a simple UI under 高级 → Search Worker:
- paste Worker URL
- save
- test connection

## Audio analysis
`/analyze-audio` is deliberately **not implemented** in Worker V1. It returns HTTP 501 instead of pretending audio analysis succeeded.

## Copyright/source behavior
Search Worker V1 returns links and metadata. It does not bypass restrictions or copy protected full scores.
