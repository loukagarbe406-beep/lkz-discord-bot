/**
 * Publie les embeds LMDS+ (IPTV / bienvenue / règles / site) une fois.
 * Usage : node publish-messages.js
 */
import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from "discord.js";
import { postIptvPanel } from "./src/iptv-tickets.js";

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();
const iptvChannelId = process.env.IPTV_CHANNEL_ID?.trim();
const linksChannelId = process.env.LINKS_CHANNEL_ID?.trim();
const site = process.env.SITE_URL?.trim() || "https://lmdslive.pages.dev";

if (!token || !guildId) {
  console.error("Manque DISCORD_TOKEN ou GUILD_ID");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function findByName(guild, parts) {
  return guild.channels.cache.find((c) => {
    if (c.type !== ChannelType.GuildText) return false;
    const n = (c.name || "").toLowerCase();
    return parts.some((p) => n.includes(p));
  });
}

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();

    const iptv =
      (iptvChannelId && guild.channels.cache.get(iptvChannelId)) ||
      findByName(guild, ["iptv", "offre"]);
    const welcome = findByName(guild, ["bienvenue", "welcome", "arriv"]);
    const rules = findByName(guild, ["regle", "règle", "rules"]);
    const links =
      (linksChannelId && guild.channels.cache.get(linksChannelId)) ||
      findByName(guild, ["site", "lien"]);

    if (iptv?.isTextBased()) {
      await postIptvPanel(iptv);
      console.log("OK IPTV → #" + iptv.name);
    } else {
      console.log("Salon IPTV introuvable");
    }

    if (welcome?.isTextBased()) {
      await welcome.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle("Bienvenue sur LMDS+ 👋")
            .setDescription(
              [
                "Ici on regarde le **sport en direct** — et tu peux **coffrer ton IPTV dès 9,99€**.",
                "",
                "📺 **IPTV Premium** → ouvre un ticket dans le salon dédié",
                `🌐 **Site matchs** → ${site}`,
                "",
                "Lis les règles, puis rejoins le chat. Bienvenue dans la team !",
              ].join("\n")
            )
            .setFooter({ text: "LMDS+" }),
        ],
      });
      console.log("OK bienvenue → #" + welcome.name);
    } else {
      console.log("Salon bienvenue introuvable (skip)");
    }

    if (rules?.isTextBased()) {
      await rules.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("📜 Règles LMDS+")
            .setDescription(
              [
                "1. **Respect** — pas d’insultes, pas de harcèlement",
                "2. **Pas de pub** — sauf autorisation staff",
                "3. **Pas de spoil** score sans spoiler tag",
                "4. **Tickets IPTV** — uniquement via le panneau officiel",
                "5. **Paiements** — uniquement via les infos staff (PayPal / IBAN)",
                "",
                "Le non-respect = warn / mute / ban.",
              ].join("\n")
            ),
        ],
      });
      console.log("OK règles → #" + rules.name);
    } else {
      console.log("Salon règles introuvable (skip)");
    }

    if (links?.isTextBased()) {
      await links.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("🌐 LMDS+ — liens utiles")
            .setDescription(
              [
                `▶ **Site matchs** → ${site}`,
                "▶ **IPTV dès 9,99€** → salon IPTV / ticket",
                "▶ Reste sur le Discord pour l’activation",
              ].join("\n")
            ),
        ],
      });
      console.log("OK liens → #" + links.name);
    } else {
      console.log("Salon liens introuvable (skip)");
    }

    console.log("Terminé.");
  } catch (err) {
    console.error(err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(token);
