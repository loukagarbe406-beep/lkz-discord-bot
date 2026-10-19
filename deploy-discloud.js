/**
 * Déploie le bot sur Discloud (24/7).
 * Usage: node deploy-discloud.js
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.DISCLOUD_TOKEN?.trim();

if (!token) {
  console.error(
    "Manque DISCLOUD_TOKEN.\n" +
      "1) https://discloud.com/dashboard → Profil → API Token\n" +
      "2) Mets DISCLOUD_TOKEN=... dans .env"
  );
  process.exit(1);
}

const packDir = path.join(__dirname, "_discloud-pack");
const zipName = "lkz-discord-bot-discloud.zip";
const zipPath = path.join(__dirname, zipName);

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === "node_modules" || name === "data" && false) continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log("→ Pack…");
fs.rmSync(packDir, { recursive: true, force: true });
fs.mkdirSync(packDir);

const files = [
  "bot.js",
  "package.json",
  "package-lock.json",
  "discloud.config",
  ".env",
];
for (const f of files) {
  const src = path.join(__dirname, f);
  if (!fs.existsSync(src)) {
    console.warn("skip missing", f);
    continue;
  }
  fs.copyFileSync(src, path.join(packDir, f));
}
copyRecursive(path.join(__dirname, "src"), path.join(packDir, "src"));

/* Discloud exige discloud.config à la racine du zip */
if (!fs.existsSync(path.join(packDir, "discloud.config"))) {
  console.error("discloud.config manquant");
  process.exit(1);
}

fs.rmSync(zipPath, { force: true });
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Force -Path '${packDir}\\*' -DestinationPath '${zipPath}'"`,
  { stdio: "inherit" }
);

const buf = fs.readFileSync(zipPath);
console.log("→ Zip", buf.length, "bytes");

/* Vérifie que discloud.config est bien dans le zip */
const listing = execSync(
  `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries | ForEach-Object { $_.FullName }"`,
  { encoding: "utf8" }
);
console.log("→ Contenu zip:\n" + listing);
if (!/discloud\.config/i.test(listing)) {
  console.error("discloud.config absent du zip — abort");
  process.exit(1);
}

console.log("→ Upload Discloud…");
const form = new FormData();
form.append(
  "file",
  new Blob([buf], { type: "application/zip" }),
  zipName
);
const r = await fetch("https://api.discloud.app/v2/upload", {
  method: "POST",
  headers: { "api-token": token },
  body: form,
});
const text = await r.text();
console.log("status", r.status);
console.log(text);

if (!r.ok) {
  process.exit(1);
}

console.log("→ Stop PM2 local (évite 2 bots)…");
try {
  execSync("npx pm2 stop lkz-discord-bot", {
    stdio: "inherit",
    cwd: __dirname,
  });
} catch {
  console.warn("PM2 déjà arrêté ou absent — OK");
}

fs.rmSync(packDir, { recursive: true, force: true });
console.log("\nOK — bot en ligne 24/7 sur Discloud.");
console.log("Dashboard: https://discloud.com/dashboard");
