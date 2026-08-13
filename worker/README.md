# Worship Search Worker V1

Cloudflare Worker for Worship Rehearsal V3.2.

## What V1 does
- `GET /health`
- `POST /search`
- Searches:
  - chord charts
  - staff notation / sheet music
  - numbered notation / 简谱
- Returns links + metadata only
- Supports `excludeSources` / `excludeUrls` for “这个不行，继续找”
- Does **not** bypass paywalls, source embedding restrictions, or republish protected full scores.

## What V1 does NOT do
`POST /analyze-audio` intentionally returns HTTP 501. Audio analysis is a later worker.

## Secret
Create a Brave Search API key and store it as a Cloudflare Worker secret:

```bash
npx wrangler secret put BRAVE_API_KEY
```

Never commit the API key into GitHub or frontend JavaScript.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put BRAVE_API_KEY
npm run deploy
```

Wrangler will return a URL similar to:

```text
https://worship-search-worker.<account>.workers.dev
```

Open Worship Rehearsal → 高级 → Search Worker, paste that URL, save, then press “测试连接”.
