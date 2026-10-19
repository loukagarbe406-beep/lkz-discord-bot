/**
 * Attend que le bot soit sur GUILD_ID, puis renomme les salons.
 * Usage: node wait-and-rename.js
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!token || !guildId) {
  console.error("Manque DISCORD_TOKEN ou GUILD_ID");
  process.exit(1);
}

const invite =
  "https://discord.com/oauth2/authorize?client_id=" +
  Buffer.from(token.split(".")[0], "base64").toString() +
  "&permissions=8&scope=bot%20applications.commands&guild_id=" +
  guildId +
  "&disable_guild_select=true";

console.log("Invite le bot ici (compte owner du serveur) :");
console.log(invite);
console.log("\nAttente du join…");

async function inGuild() {
  const r = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: "Bot " + token },
  });
  if (!r.ok) return false;
  const guilds = await r.json();
  return Array.isArray(guilds) && guilds.some((g) => g.id === guildId);
}

let joined = false;
for (let i = 0; i < 120; i++) {
  if (await inGuild()) {
    joined = true;
    console.log("Bot sur le serveur — rename…");
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "rename-channels.js")],
      { stdio: "inherit", cwd: __dirname, env: process.env }
    );
    child.on("exit", (code) => process.exit(code ?? 0));
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
  if (i % 5 === 0) console.log("…toujours pas sur le serveur (" + (i + 1) + ")");
}
if (!joined) {
  console.error("Timeout — invite le bot puis relance: node rename-channels.js");
  process.exit(1);
}
