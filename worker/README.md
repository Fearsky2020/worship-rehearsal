# Worship Search Worker V1.4

Brave image search + OpenCC title normalization + Workers AI visual verification.

Deploy:
1. npm install
2. npx wrangler deploy
3. GET /health
4. POST /vision-test with a known public score image

The existing BRAVE_API_KEY Cloudflare Secret is reused.
If the selected Meta vision model requires a first-use license acceptance, stop and let the Cloudflare account owner review/accept it manually.
