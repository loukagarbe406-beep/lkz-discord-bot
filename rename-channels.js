/**
 * Renomme les salons existants (ne crée / ne supprime rien).
 * Usage: node rename-channels.js [--dry]
 */
import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

const DRY = process.argv.includes("--dry");
const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();

if (!token || !guildId) {
  console.error("Manque DISCORD_TOKEN ou GUILD_ID dans .env");
  process.exit(1);
}

/** Noms propres : emoji｜slug — on garde le sens du salon d’origine */
const RULES = [
  { re: /bienvenue|welcome|arriv/i, name: "👋｜bienvenue" },
  { re: /r[eè]gle|rules/i, name: "📜｜regles" },
  { re: /annonce|news|actu/i, name: "📢｜annonces" },
  { re: /g[eé]n[eé]ral|tchat|chat(?!-)|discussion/i, name: "💬｜general" },
  { re: /prono/i, name: "🎯｜pronos" },
  { re: /iptv|abonnement|offre/i, name: "📺｜iptv" },
  { re: /ticket/i, name: "🎫｜tickets" },
  { re: /lien|link|site|match/i, name: "🔗｜liens" },
  { re: /support|aide|help/i, name: "🆘｜support" },
  { re: /staff|modo|admin/i, name: "🛡️｜staff" },
  { re: /log/i, name: "📋｜logs" },
  { re: /backup|sauvegarde/i, name: "💾｜backup" },
  { re: /media|photo|clip/i, name: "🖼️｜media" },
  { re: /vocal|voice|parle/i, name: "🔊｜vocal" },
  { re: /afk/i, name: "💤｜afk" },
];

function cleanSlug(raw) {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s|_-]+/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function suggestName(ch) {
  const src = `${ch.name} ${ch.topic || ""}`;
  for (const rule of RULES) {
    if (rule.re.test(src)) return rule.name;
  }
  if (ch.type === ChannelType.GuildCategory) {
    const slug = cleanSlug(ch.name) || "categorie";
    return `📁｜${slug}`;
  }
  if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
    const slug = cleanSlug(ch.name) || "vocal";
    return `🔊｜${slug}`;
  }
  const slug = cleanSlug(ch.name) || "salon";
  return `💬｜${slug}`;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    const channels = [...guild.channels.cache.values()].sort(
      (a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0)
    );

    console.log(`Serveur: ${guild.name} (${guild.id}) — ${channels.length} salons`);
    console.log(DRY ? "Mode DRY — aucun rename" : "Rename en cours…");

    let changed = 0;
    for (const ch of channels) {
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement &&
        ch.type !== ChannelType.GuildVoice &&
        ch.type !== ChannelType.GuildStageVoice &&
        ch.type !== ChannelType.GuildCategory &&
        ch.type !== ChannelType.GuildForum
      ) {
        continue;
      }
      /* Ne pas fusionner tickets / archives clients */
      if (
        /^iptv-/i.test(ch.name) ||
        /^✅/u.test(ch.name) ||
        /^🔒/u.test(ch.name) ||
        /ferme|ticket|clients?/i.test(ch.name)
      ) {
        console.log(`skip ticket/archive ${ch.name}`);
        continue;
      }

      const next = suggestName(ch);
      if (next === ch.name) {
        console.log(`= ${ch.name}`);
        continue;
      }
      console.log(`${ch.name}  →  ${next}`);
      if (!DRY) {
        await ch.setName(next, "LMDS+ rename propre");
        changed++;
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    console.log(DRY ? "Dry OK" : `Renommés: ${changed}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token).catch((err) => {
  console.error("Login impossible — token invalide ?", err.message);
  process.exit(1);
});
