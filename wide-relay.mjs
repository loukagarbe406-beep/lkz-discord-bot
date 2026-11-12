/**
 * Relais HLS wideiptv/hdm1 — IP résidentielle (CF est 403 sur wideiptv).
 * GET /index.m3u8?id=116
 * GET /seg.ts?u=…
 */
import http from "http";
import { URL } from "url";

const PORT = Number(process.env.PORT || 8788);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SITE = "https://thedaddy.li";
const WIDE = "https://wideiptv.top";

const SLUG = new Map();
const MASTER = new Map();

function cors(res, type = "text/plain; charset=utf-8") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Accept");
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store");
}

async function fetchText(url, headers = {}, method = "GET", body) {
  const r = await fetch(url, {
    method,
    headers: { "User-Agent": UA, ...headers },
    body,
    redirect: "follow",
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, t, headers: r.headers };
}

async function resolveSlug(id) {
  const hit = SLUG.get(id);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.slug;
  const page = await fetchText(SITE + "/player/stream-" + id + ".php", {
    Referer: SITE + "/",
    Accept: "text/html",
  });
  if (!page.ok) throw new Error("player page " + page.status);
  const iframe = (page.t.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1];
  if (!iframe) throw new Error("no iframe");
  const slug = new URL(iframe, SITE).searchParams.get("stream");
  if (!slug) throw new Error("no slug");
  SLUG.set(id, { at: Date.now(), slug });
  return slug;
}

async function mintMaster(slug) {
  const r = await fetchText(
    WIDE + "/api/refresh_token.php",
    {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: WIDE,
      Referer: WIDE + "/player/" + encodeURIComponent(slug),
    },
    "POST",
    JSON.stringify({ channel: slug, current_token: "boot" })
  );
  let data;
  try {
    data = JSON.parse(r.t);
  } catch (_) {
    throw new Error("bad token json");
  }
  if (!data || !data.success || !data.token) throw new Error("token fail");
  return (
    "https://cdn.hdm1.net/" +
    encodeURIComponent(slug) +
    "/index.m3u8?token=" +
    encodeURIComponent(String(data.token))
  );
}

async function resolveMaster(id, hard) {
  if (!hard) {
    const hit = MASTER.get(id);
    if (hit && Date.now() - hit.at < 60 * 1000) return hit.url;
  }
  const slug = await resolveSlug(id);
  const url = await mintMaster(slug);
  MASTER.set(id, { at: Date.now(), url, slug });
  return url;
}

function hostOk(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return (
      h.includes("hdm1") ||
      h.includes("wideiptv") ||
      h.endsWith(".top") ||
      h.endsWith(".net")
    );
  } catch (_) {
    return false;
  }
}

function rewrite(text, base, id) {
  /* Chemins relatifs → le Pages Function préfixe RELAY_BASE public */
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line;
      let abs = t;
      try {
        abs = new URL(t, base).href;
      } catch (_) {
        return line;
      }
      if (/\.m3u8(\?|$)/i.test(abs)) {
        return (
          "/index.m3u8?id=" +
          encodeURIComponent(id) +
          "&u=" +
          encodeURIComponent(abs)
        );
      }
      return (
        "/seg.ts?id=" +
        encodeURIComponent(id) +
        "&u=" +
        encodeURIComponent(abs)
      );
    })
    .join("\n");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }
    const u = new URL(req.url || "/", "http://127.0.0.1:" + PORT);
    const origin = "http://127.0.0.1:" + PORT;
    const id = String(u.searchParams.get("id") || "").replace(/\D/g, "") || "118";
    const rawU = u.searchParams.get("u") || "";
    const hard = u.searchParams.get("refresh") === "1";

    if (u.pathname === "/seg.ts" || (u.pathname === "/index.m3u8" && rawU)) {
      let target = rawU;
      try {
        target = decodeURIComponent(rawU);
      } catch (_) {}
      if (!/^https?:\/\//i.test(target) || !hostOk(target)) {
        cors(res);
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const up = await fetch(target, {
        headers: {
          "User-Agent": UA,
          Referer: WIDE + "/",
          Origin: WIDE,
          Accept: "*/*",
          ...(req.headers.range ? { Range: req.headers.range } : {}),
        },
        redirect: "follow",
      });
      const ctype = up.headers.get("content-type") || "";
      if (/mpegurl|m3u8/i.test(ctype) || /\.m3u8(\?|$)/i.test(target)) {
        const text = await up.text();
        cors(res, "application/vnd.apple.mpegurl");
        res.writeHead(200);
        res.end(rewrite(text, target, id));
        return;
      }
      const buf = Buffer.from(await up.arrayBuffer());
      cors(res, ctype || "video/mp2t");
      res.writeHead(200);
      res.end(buf);
      return;
    }

    if (u.pathname === "/index.m3u8" || u.pathname === "/") {
      const master = await resolveMaster(id, hard);
      const pl = await fetchText(master, {
        Referer: WIDE + "/",
        Origin: WIDE,
        Accept: "*/*",
      });
      if (!pl.ok || !/#EXTM3U/i.test(pl.t)) {
        cors(res);
        res.writeHead(502);
        res.end("master " + pl.status);
        return;
      }
      cors(res, "application/vnd.apple.mpegurl");
      res.writeHead(200);
      res.end(rewrite(pl.t, master, id));
      return;
    }

    if (u.pathname === "/health") {
      cors(res, "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    cors(res);
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    cors(res);
    res.writeHead(502);
    res.end("relay error: " + (e && e.message ? e.message : "fail"));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("wide-relay on http://0.0.0.0:" + PORT);
});
