/**
 * Relance / status Discloud sans re-upload.
 * Usage: node discloud-status.js
 */
import "dotenv/config";

const token = process.env.DISCLOUD_TOKEN?.trim();
if (!token) {
  console.error("Manque DISCLOUD_TOKEN");
  process.exit(1);
}

const headers = { "api-token": token, "Content-Type": "application/json" };

async function api(method, path) {
  const r = await fetch("https://api.discloud.app/v2" + path, {
    method,
    headers,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: r.status, json };
}

const apps = await api("GET", "/app/all");
console.log("apps", apps.status, JSON.stringify(apps.json, null, 2).slice(0, 2000));

const list = apps.json?.apps || apps.json?.data || [];
const arr = Array.isArray(list) ? list : list ? [list] : [];
const target =
  arr.find((a) => /lkz|lmds|discord/i.test(String(a?.name || a?.id || ""))) ||
  arr[0];

if (!target) {
  console.log("Aucune app Discloud trouvée — upload requis plus tard.");
  process.exit(0);
}

const id = target.id || target.appId || target.name;
console.log("→ Restart", id);
const restart = await api("PUT", `/app/${id}/restart`);
console.log("restart", restart.status, JSON.stringify(restart.json).slice(0, 500));

const status = await api("GET", `/app/${id}/status`);
console.log("status", status.status, JSON.stringify(status.json).slice(0, 800));
