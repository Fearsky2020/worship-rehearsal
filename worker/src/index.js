
const VERSION = "1.0.0";

function corsHeaders(origin) {
  const allowed = [
    "https://fearsky2020.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ];
  const value = allowed.includes(origin) ? origin : "https://fearsky2020.github.io";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s*[|\-–—]\s*(official\s*(music\s*)?video|official\s*audio|lyrics?|mv)\s*$/i, "")
    .replace(/\[[^\]]*(official|lyrics?|mv)[^\]]*\]/ig, "")
    .trim();
}

function querySet(title, type) {
  const t = cleanTitle(title);
  if (type === "staff") return [
    `"${t}" 五线谱`,
    `"${t}" sheet music`,
    `"${t}" score filetype:pdf`,
    `site:musescore.com "${t}"`
  ];
  if (type === "numbered") return [
    `"${t}" 简谱`,
    `"${t}" 歌谱`,
    `"${t}" 数字谱`,
    `"${t}" 敬拜 简谱`
  ];
  return [
    `"${t}" 和弦谱`,
    `"${t}" chords`,
    `site:chordify.net "${t}"`,
    `site:praisecharts.com "${t}"`
  ];
}

function inferPreviewType(url = "") {
  const u = url.toLowerCase().split("?")[0];
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(u)) return "image";
  if (/\.pdf$/.test(u)) return "pdf";
  return "page";
}

function sourceName(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("praisecharts")) return "PraiseCharts";
    if (host.includes("chordify")) return "Chordify";
    if (host.includes("ultimate-guitar")) return "Ultimate Guitar";
    if (host.includes("musescore")) return "MuseScore";
    if (host.includes("youtube")) return "YouTube";
    return host;
  } catch {
    return "网页";
  }
}

async function braveSearch(env, query, count = 8) {
  if (!env.BRAVE_API_KEY) throw new Error("BRAVE_API_KEY is not configured");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(count, 20)));
  url.searchParams.set("safesearch", "moderate");
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": env.BRAVE_API_KEY
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brave Search ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeResult(item, type) {
  const url = item.url || "";
  return {
    scoreType: type,
    source: sourceName(url),
    title: item.title || "",
    url,
    key: "",
    previewType: inferPreviewType(url),
    text: "",
    description: item.description || "",
    kind: "search"
  };
}

function dedupe(items, excludeSources = [], excludeUrls = []) {
  const blockedSources = new Set(excludeSources.map(x => String(x).toLowerCase()));
  const blockedUrls = new Set(excludeUrls);
  const seen = new Set();
  return items.filter(item => {
    if (!item.url || seen.has(item.url) || blockedUrls.has(item.url)) return false;
    if (blockedSources.has(String(item.source).toLowerCase())) return false;
    seen.add(item.url);
    return true;
  });
}

async function searchType(env, title, type, excludeSources, excludeUrls) {
  const queries = querySet(title, type);
  const collected = [];
  // Keep V1 economical: use at most 2 Brave queries per score type.
  for (const q of queries.slice(0, 2)) {
    const data = await braveSearch(env, q, 8);
    const rows = data?.web?.results || [];
    for (const row of rows) collected.push(normalizeResult(row, type));
  }
  return dedupe(collected, excludeSources, excludeUrls).slice(0, 8);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "Worship Search Worker",
        version: VERSION,
        searchProvider: "Brave Search API",
        braveConfigured: Boolean(env.BRAVE_API_KEY)
      }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/search") {
      try {
        const body = await request.json();
        const title = String(body.title || "").trim();
        if (!title) return json({ error: "title is required" }, 400, origin);

        const requestedTypes = Array.isArray(body.requestedTypes) && body.requestedTypes.length
          ? body.requestedTypes.filter(x => ["chord","staff","numbered"].includes(x))
          : ["chord","staff","numbered"];

        const excludeSources = Array.isArray(body.excludeSources) ? body.excludeSources : [];
        const excludeUrls = Array.isArray(body.excludeUrls) ? body.excludeUrls : [];

        const results = { chord: [], staff: [], numbered: [] };

        // Sequential search keeps rate/cost behavior predictable.
        for (const type of requestedTypes) {
          results[type] = await searchType(env, title, type, excludeSources, excludeUrls);
        }

        return json({
          schemaVersion: "1.1",
          title,
          results,
          provider: "Brave Search API",
          note: "Search results are links/metadata only. The Worker does not bypass source restrictions or republish protected full scores."
        }, 200, origin);
      } catch (err) {
        console.error(err);
        return json({ error: err.message || "search failed" }, 500, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/analyze-audio") {
      return json({
        error: "NOT_IMPLEMENTED",
        message: "Audio analysis is intentionally not implemented in Search Worker V1."
      }, 501, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  }
};
