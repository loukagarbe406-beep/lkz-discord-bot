/**
 * Récupère les matchs publiés sur le site LMDS+.
 * Prefers data/matches.json (Cloudflare Pages).
 */
const SITE_URL = (
  process.env.SITE_URL || "https://lmdslive.pages.dev"
).replace(/\/$/, "");
const SITE_NAME = process.env.SITE_NAME?.trim() || "LMDS+";

function parseTeams(title) {
  const raw = String(title || "").trim();
  const parts = raw.split(/\s+vs\.?\s+|\s+\/\s+/i);
  if (parts.length >= 2) {
    return {
      home: parts[0].trim(),
      away: parts.slice(1).join(" / ").trim(),
    };
  }
  const dash = raw.split(/\s+-\s+/);
  if (dash.length === 2) {
    return { home: dash[0].trim(), away: dash[1].trim() };
  }
  return { home: raw || "Équipe 1", away: "Équipe 2" };
}

function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((m) => m && (m.title || m.slug))
    .map((m) => {
      const { home, away } = parseTeams(m.title || m.slug);
      return {
        slug: String(m.slug || `${home}-${away}`).toLowerCase(),
        home,
        away,
        competition: String(m.sub || m.competition || "").trim(),
        sport: String(m.sport || "football").toLowerCase(),
        state: String(m.state || "").toLowerCase(),
        title: String(m.title || `${home} vs ${away}`),
      };
    });
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

export async function fetchSiteMatches() {
  let data = null;
  let lastErr = null;
  const urls = [
    `${SITE_URL}/data/matches.json`,
    `${SITE_URL}/js/site-data.json`,
    `${SITE_URL}/api/site-data`,
  ];
  for (const url of urls) {
    try {
      data = await fetchJson(url);
      /* LMDS matches.json OU site-data v1 */
      if (data && (data.version === 1 || data.live || data.upcoming)) break;
    } catch (err) {
      lastErr = err;
      data = null;
    }
  }
  if (!data || !(data.live || data.upcoming || data.version === 1)) {
    throw lastErr || new Error("site-data / matches.json indisponible");
  }

  const live = normalizeList(data.live);
  const upcoming = normalizeList(data.upcoming);
  const tomorrow = normalizeList(data.tomorrow);

  const isFoot = (m) =>
    !m.sport || m.sport === "football" || m.sport === "foot";

  const seen = new Set();
  const all = [];
  const today = [];
  for (const m of [...live, ...upcoming, ...tomorrow]) {
    if (seen.has(m.slug)) continue;
    seen.add(m.slug);
    if (!isFoot(m)) continue;
    all.push(m);
  }

  const seenToday = new Set();
  for (const m of [...live, ...upcoming]) {
    if (seenToday.has(m.slug) || !isFoot(m)) continue;
    seenToday.add(m.slug);
    today.push(m);
  }

  return {
    all,
    today,
    live,
    upcoming,
    tomorrow,
    updatedAt: data.updatedAt || null,
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
  };
}

export { SITE_URL, SITE_NAME };
