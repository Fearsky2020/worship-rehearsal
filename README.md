# Worship Rehearsal V3.6 — Automatic Visual Score Verification

Built on the public V3.5 release (`705e5159645caf79ddb760641670f720b3f624a2`).

## Pipeline

YouTube title
→ simplified/traditional normalization
→ one Brave Image Search request per requested score type
→ heuristic prefilter
→ Workers AI vision verification
→ only verified/probable candidates are returned.

## Vision checks

The vision model checks the image itself for:

- whether it is genuinely musical notation / jianpu / chord chart;
- whether the notation type matches chord / staff / numbered;
- visible song title;
- whether the visible title matches the current song.

Clearly different song titles are rejected automatically.

If the title cannot be read, a candidate is accepted only when:
- the image is strongly recognized as a score; and
- Brave result metadata strongly matches the normalized song title.

## Cost control

- Brave remains one request per requested score type.
- Vision checks at most 3 candidate images per score type.
- Stops after 2 accepted candidates per type.
- Uses Brave thumbnails first to keep vision image payloads small.

## Cloudflare

`wrangler.jsonc` adds the Workers AI binding:

```json
"ai": { "binding": "AI" }
```

The existing `BRAVE_API_KEY` secret is reused and must not be read or re-entered.

Vision model default:

`@cf/meta/llama-3.2-11b-vision-instruct`

If Cloudflare requires acceptance of the model's license/terms on first use, stop for the account owner to review and accept them; do not automate legal acceptance.

## Endpoints

- `GET /health`
- `POST /search`
- `POST /vision-test`
- `POST /analyze-audio` remains 501
