import "dotenv/config";
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();

if (!token || !guildId) {
  console.error("Manque DISCORD_TOKEN ou GUILD_ID dans .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("prono-du-jour")
    .setDescription("Publier tous les matchs du jour (site) pour les pronos")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("intro")
    .setDescription("Republier le message d’intro avec les boutons")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("classement")
    .setDescription("Classement des pronos"),

  new SlashCommandBuilder()
    .setName("match")
    .setDescription("Créer un match à la main (staff)")
    .addStringOption((o) =>
      o.setName("domicile").setDescription("Équipe domicile").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("exterieur").setDescription("Équipe extérieur").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("competition").setDescription("Ligue 1, C1…").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("lien")
    .setDescription("Recevoir le lien du site en message privé"),

  new SlashCommandBuilder()
    .setName("matchs")
    .setDescription("Recevoir le lien des matchs / streams en message privé"),

  new SlashCommandBuilder()
    .setName("site")
    .setDescription("Recevoir le lien du site en message privé"),

  new SlashCommandBuilder()
    .setName("iptv-panel")
    .setDescription("Publier le panneau offre IPTV (tickets)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  const app = await rest.get(Routes.oauth2CurrentApplication());
  await rest.put(Routes.applicationGuildCommands(app.id, guildId), { body: commands });
  console.log(`OK — ${commands.length} commandes enregistrées.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
