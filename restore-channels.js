/**
 * Restaure les noms utiles après un rename trop agressif,
 * avec un format propre (sans fusionner les tickets).
 */
import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();

/** Ordre = rawPosition au moment du mauvais rename */
const RESTORE = [
  "👋｜bienvenue",
  "📁｜communaute",
  "💾｜backup",
  "📁｜lmds-lien",
  "💬｜question-reponse",
  "📁｜clients-en-attente",
  "📺｜iptv",
  "📁｜clients-finalises",
  "📁｜clients-essais-24h",
  "💬｜general",
  "🌐｜site",
  "✅｜lagrosse",
  "✅｜iptv-grinjox",
  "✅｜iptv-quentinq",
  "✅｜iptv-samsam022690",
  "✅｜iptv-knyywk",
  "✅｜rayan-rayan",
  "✅｜dylan4677",
  "✅｜badgones",
  "✅｜raphx",
  "✅｜romskouille",
  "✅｜staff-1009",
  "🔒｜ferme-dng243",
  "✅｜q3nt1n94",
  "✅｜marco0101",
  "✅｜userno",
  "✅｜archive",
  "✅｜iptv-matteeoo4118",
  "✅｜iptv-enzogtn",
  "✅｜iptv-mhd0101",
  "✅｜iptv-liveandrei",
  "✅｜iptv-betryrer",
  "✅｜iptv-ennzo7",
  "✅｜iptv-marianne084919",
  "✅｜iptv-rayonx699",
  "✅｜iptv-razeezu",
  "✅｜iptv-leaaabt",
  "✅｜iptv-leroisobek",
  "✅｜iptv-lego69ne",
  "✅｜iptv-slowinop",
  "✅｜iptv-attex",
  "✅｜iptv-ash-kashu",
  "✅｜iptv-souswodyy",
  "✅｜iptv-theogfd",
  "✅｜iptv-tenko13",
  "✅｜iptv-abibogoss",
  "✅｜iptv-dju71-v2",
  "✅｜viallour72",
  "✅｜iptv-esskaby75",
  "✅｜amouff",
  "✅｜zekroy",
  "✅｜dju71",
  "✅｜iptv-staanis",
  "✅｜iptv-tksryan",
  "✅｜iptv-mifup",
  "✅｜iptv-imedd1",
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    const channels = [...guild.channels.cache.values()].sort(
      (a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0)
    );

    if (channels.length !== RESTORE.length) {
      console.warn(
        `Attention: ${channels.length} salons vs ${RESTORE.length} noms — on mappe au mieux`
      );
    }

    let n = 0;
    for (let i = 0; i < Math.min(channels.length, RESTORE.length); i++) {
      const ch = channels[i];
      const next = RESTORE[i];
      if (ch.name === next) {
        console.log(`= ${next}`);
        continue;
      }
      console.log(`${ch.name}  →  ${next}`);
      await ch.setName(next, "LMDS+ restore noms propres");
      n++;
      await new Promise((r) => setTimeout(r, 350));
    }
    console.log(`Restaurés/renommés: ${n}`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
