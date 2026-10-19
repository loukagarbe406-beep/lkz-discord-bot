/**
 * Bot LMDS+ Pronos
 *
 * Intro  : embed + Pronostiquer · Mes pronos · Classement
 * Staff  : /prono-du-jour · /intro
 * Auto   : scores finaux → résultat + points
 */
import "dotenv/config";
import http from "node:http";
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { load, save, nextMatchId, calcPoints } from "./src/store.js";
import { fetchSiteMatches, SITE_URL, SITE_NAME } from "./src/site-matches.js";
import { fetchDayScores, findFinishedScore } from "./src/scores.js";
import {
  handleIptvButton,
  handleIptvSelect,
  postIptvPanel,
} from "./src/iptv-tickets.js";

const token = process.env.DISCORD_TOKEN?.trim();
const pronosChannelId = process.env.PRONOS_CHANNEL_ID?.trim() || null;
/** Poll scores auto (ms) — défaut 3 min */
const SCORES_POLL_MS = Number(process.env.SCORES_POLL_MS || 180_000);

if (!token) {
  console.error("Manque DISCORD_TOKEN dans .env");
  process.exit(1);
}

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
];
/* Message Content = intent privilégié Discord (Developer Portal → Bot → activer) */
if (process.env.ENABLE_MESSAGE_CONTENT === "1") {
  intents.push(GatewayIntentBits.MessageContent);
}
const client = new Client({
  intents,
  partials: [Partials.Channel, Partials.Message],
});

const SITE_CHANNEL_ID =
  process.env.SITE_CHANNEL_ID?.trim() ||
  process.env.LINKS_CHANNEL_ID?.trim() ||
  "1532150230168899693";

/** !match / !matchs / !lien → DM du lien site */
const LINK_CMD_RE = /^\s*!(matchs?|lien|liens|site)\b/i;
const linkCmdCooldown = new Map(); /* userId → ts */
const LINK_CMD_COOLDOWN_MS = 20_000;

function siteChannelMessage(botId = client.user?.id) {
  const mention = botId ? `<@${botId}>` : "LMDS BOT";
  return (
    "Les streams sont désormais disponibles sur notre site officiel.\n\n" +
    "Nous vous recommandons d’enregistrer et partager ce lien.\n\n" +
    `Envoie un message en DM au bot ${mention} pour le recevoir.`
  );
}

function siteDmReply() {
  return (
    "Les streams sont désormais disponibles sur notre site officiel.\n\n" +
    "Nous vous recommandons d’enregistrer et partager ce lien.\n\n" +
    SITE_URL
  );
}

async function sendSiteLinkDm(user) {
  await user.send(siteDmReply());
}

function isStaff(member) {
  return (
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function assertChannel(interaction) {
  if (!pronosChannelId) return true;
  return interaction.channelId === pronosChannelId;
}

function matchTitle(m) {
  return `${m.home}  vs  ${m.away}`;
}

function buildMatchEmbed(m, data) {
  const preds = Object.values(data.predictions).filter((p) => p.matchId === m.id);
  const status =
    m.status === "open"
      ? "🟢 Pronos ouverts"
      : `🏁 Terminé · **${m.homeScore}-${m.awayScore}**`;

  const embed = new EmbedBuilder()
    .setColor(m.status === "open" ? 0xa855f7 : 0x22c55e)
    .setTitle(`⚽ ${matchTitle(m)}`)
    .setDescription(
      [
        m.competition ? `**${m.competition}**` : null,
        status,
        m.siteUrl ? `[Voir sur ${SITE_NAME}](${m.siteUrl})` : null,
        `🌐 **${SITE_NAME}** → ${SITE_URL}`,
        "",
        m.status === "open"
          ? "Clique **Pronostiquer** et entre ton score."
          : "_Match clôturé — points distribués._",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .addFields({
      name: "Pronos",
      value: preds.length ? `${preds.length} joueur${preds.length > 1 ? "s" : ""}` : "Aucun pour l’instant",
      inline: true,
    })
    .setFooter({ text: `${SITE_NAME} · Exact 3 pts · Bon résultat 1 pt` });

  return embed;
}

function buildButtons(m) {
  const row = new ActionRowBuilder();
  if (m.status === "open") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`prono:${m.id}`)
        .setLabel("Pronostiquer")
        .setEmoji("🎯")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`voir:${m.id}`)
        .setLabel("Mes pronos")
        .setEmoji("👀")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`result:${m.id}`)
        .setLabel("Résultat")
        .setEmoji("🏁")
        .setStyle(ButtonStyle.Success)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`voir:${m.id}`)
        .setLabel("Voir mon prono")
        .setEmoji("👀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`done:${m.id}`)
        .setLabel("Terminé")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }
  return row;
}

function showPronoModal(interaction, match, data) {
  const prev = data.predictions[`${match.id}:${interaction.user.id}`];
  const modal = new ModalBuilder()
    .setCustomId(`modal-prono:${match.id}`)
    .setTitle(`${match.home} vs ${match.away}`.slice(0, 45));

  const homeInput = new TextInputBuilder()
    .setCustomId("home")
    .setLabel(`Buts ${match.home}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("ex: 2")
    .setRequired(true)
    .setMaxLength(2);
  const awayInput = new TextInputBuilder()
    .setCustomId("away")
    .setLabel(`Buts ${match.away}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("ex: 1")
    .setRequired(true)
    .setMaxLength(2);
  if (prev) {
    homeInput.setValue(String(prev.home));
    awayInput.setValue(String(prev.away));
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(homeInput),
    new ActionRowBuilder().addComponents(awayInput)
  );

  return interaction.showModal(modal);
}

async function publishSiteMatch(channel, sm, data, userId) {
  const id = nextMatchId(data);
  const match = {
    id,
    home: sm.home,
    away: sm.away,
    competition: sm.competition,
    status: "open",
    createdAt: Date.now(),
    createdBy: userId,
    messageId: null,
    channelId: channel.id,
    siteSlug: sm.slug,
    siteUrl: sm.slug
      ? `${SITE_URL}/match?slug=${encodeURIComponent(sm.slug)}`
      : `${SITE_URL}/match?t=${encodeURIComponent(sm.title || `${sm.home} - ${sm.away}`)}`,
  };
  data.matches[id] = match;
  save(data);

  const msg = await channel.send({
    embeds: [buildMatchEmbed(match, data)],
    components: [buildButtons(match)],
  });
  data.matches[id].messageId = msg.id;
  save(data);
  return match;
}

function onBotReady() {
  console.log(`Connecté : ${client.user.tag}`);
  console.log("Pronos + scores auto prêts.");
  startScoresAuto();
  ensureIntroInPronosChannel().catch((err) =>
    console.warn("intro:", err.message || err)
  );
}

client.once("clientReady", onBotReady);
client.once("ready", onBotReady);

function buildIntroEmbed() {
  return new EmbedBuilder()
    .setColor(0x1e1b4b)
    .setTitle(`${SITE_NAME} · Pronostics`)
    .setDescription(
      "Pronostique les matchs du jour, gagne des points, grimpe au classement.\n\n" +
        "**Exact** → 3 pts · **Bon résultat** → 1 pt\n\n" +
        `🌐 Regarde les matchs sur **${SITE_NAME}**\n➜ ${SITE_URL}`
    )
    .addFields({
      name: "Comment faire",
      value: "Clique **Pronostiquer**, choisis un match, entre ton score.",
    })
    .setFooter({ text: `${SITE_NAME} · Résultats automatiques en fin de match` });
}

function buildIntroButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("intro-prono")
      .setLabel("Pronostiquer")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("intro-mes-pronos")
      .setLabel("Mes pronos")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("intro-classement")
      .setLabel("Classement")
      .setStyle(ButtonStyle.Secondary)
  );
}

let introBusy = false;

async function ensureIntroMessage(channel) {
  if (!channel?.isTextBased?.()) return null;
  if (introBusy) return null;
  introBusy = true;
  try {
    const data = load();
    const payload = {
      embeds: [buildIntroEmbed()],
      components: [buildIntroButtons()],
    };

    if (data.introMessageId) {
      try {
        const msg = await channel.messages.fetch(data.introMessageId);
        await msg.edit(payload);
        try {
          if (!msg.pinned) await msg.pin().catch(() => {});
        } catch {
          /* ignore */
        }
        return msg;
      } catch {
        /* message deleted — recreate */
      }
    }

    const msg = await channel.send(payload);
    data.introMessageId = msg.id;
    save(data);
    try {
      await msg.pin();
    } catch {
      /* pas le droit de pin */
    }
    return msg;
  } finally {
    introBusy = false;
  }
}

async function ensureIntroInPronosChannel() {
  if (!pronosChannelId) return;
  const channel = await client.channels.fetch(pronosChannelId);
  await ensureIntroMessage(channel);
}

async function replyPronoPicker(interaction) {
  const data = load();
  const open = Object.values(data.matches).filter((m) => m.status === "open");
  if (!open.length) {
    await interaction.reply({
      content: "Aucun match ouvert pour l’instant. Reviens après le **prono du jour**.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const options = open.slice(0, 25).map((m) => {
    const label = `${m.home} vs ${m.away}`.slice(0, 100);
    const desc = (m.competition || `ID ${m.id}`).slice(0, 100);
    return { label, description: desc, value: m.id };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("pick-prono")
      .setPlaceholder("Choisis le match à pronostiquer")
      .addOptions(options)
  );

  await interaction.reply({
    content: "🎯 Choisis le match :",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

function buildClassementPayload(data) {
  const rows = Object.entries(data.scores)
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.points - a.points || b.exact - a.exact);

  if (!rows.length) {
    return {
      content: "Pas encore de points — clique **Pronostiquer** !",
      embeds: [],
    };
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.slice(0, 15).map((r, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    return `${medal} <@${r.userId}> — **${r.points}** pts · ${r.exact} exacts`;
  });

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x1e1b4b)
        .setTitle("Classement")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Exact 3 pts · Bon résultat 1 pt" }),
    ],
  };
}

function buildMesPronosPayload(data, userId) {
  const preds = Object.values(data.predictions || {})
    .filter((p) => p.userId === userId)
    .sort((a, b) => (b.at || 0) - (a.at || 0));

  if (!preds.length) {
    return {
      content: "Tu n’as encore aucun prono. Clique **Pronostiquer**.",
      embeds: [],
    };
  }

  const lines = preds.slice(0, 25).map((p) => {
    const m = data.matches[p.matchId];
    if (!m) {
      return `• Match inconnu · \`${p.home}-${p.away}\``;
    }
    if (m.status === "closed") {
      const pts = calcPoints(p.home, p.away, m.homeScore, m.awayScore);
      return `• **${m.home}** \`${p.home}-${p.away}\` **${m.away}** → réel **${m.homeScore}-${m.awayScore}** · **${pts}** pt${pts > 1 ? "s" : ""}`;
    }
    return `• **${m.home}** \`${p.home}-${p.away}\` **${m.away}** · _en cours_`;
  });

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x1e1b4b)
        .setTitle("Mes pronos")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${preds.length} prono${preds.length > 1 ? "s" : ""}` }),
    ],
  };
}

let scoresBusy = false;
let scoresStarted = false;

function startScoresAuto() {
  if (scoresStarted) return;
  scoresStarted = true;
  const tick = () => {
    pollAndCloseScores().catch((err) =>
      console.warn("scores auto:", err.message || err)
    );
  };
  tick();
  setInterval(tick, Number.isFinite(SCORES_POLL_MS) && SCORES_POLL_MS >= 60_000
    ? SCORES_POLL_MS
    : 180_000);
}

/**
 * Clôture un match, calcule les points, met à jour l’embed.
 * @returns {{ detail: string, results: Array }}
 */
function applyMatchResult(match, home, away, data) {
  match.status = "closed";
  match.homeScore = home;
  match.awayScore = away;
  match.closedAt = Date.now();

  const results = [];
  for (const pred of Object.values(data.predictions)) {
    if (pred.matchId !== match.id) continue;
    const pts = calcPoints(pred.home, pred.away, home, away);
    if (!data.scores[pred.userId]) {
      data.scores[pred.userId] = { points: 0, exact: 0, ok: 0, tag: pred.userTag };
    }
    data.scores[pred.userId].points += pts;
    data.scores[pred.userId].tag = pred.userTag;
    if (pts === 3) data.scores[pred.userId].exact += 1;
    else if (pts === 1) data.scores[pred.userId].ok += 1;
    results.push({ userId: pred.userId, pred: `${pred.home}-${pred.away}`, pts });
  }
  save(data);
  results.sort((a, b) => b.pts - a.pts);

  const detail =
    results.length === 0
      ? "_Aucun prono._"
      : results
          .slice(0, 20)
          .map((r) => `• <@${r.userId}> \`${r.pred}\` → **${r.pts}**`)
          .join("\n");

  return { detail, results };
}

function resultEmbed(match, home, away, detail, auto = false) {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(`🏁 ${match.home} ${home}-${away} ${match.away}`)
    .setDescription(detail)
    .setFooter({
      text: auto
        ? "Résultat auto · /classement"
        : "Tape /classement",
    });
}

async function pollAndCloseScores() {
  if (scoresBusy) return;
  scoresBusy = true;
  try {
    const data = load();
    const open = Object.values(data.matches).filter((m) => m.status === "open");
    if (!open.length) return;

    let dayScores;
    try {
      dayScores = await fetchDayScores();
    } catch (err) {
      console.warn("fetch scores:", err.message || err);
      return;
    }

    for (const match of open) {
      const found = findFinishedScore(match.home, match.away, dayScores);
      if (!found) continue;

      const { detail } = applyMatchResult(
        match,
        found.homeScore,
        found.awayScore,
        data
      );

      await refreshMatchMessage(null, match, data);

      try {
        const channel = match.channelId
          ? await client.channels.fetch(match.channelId)
          : pronosChannelId
            ? await client.channels.fetch(pronosChannelId)
            : null;
        if (channel?.isTextBased?.()) {
          await channel.send({
            embeds: [
              resultEmbed(match, found.homeScore, found.awayScore, detail, true),
            ],
          });
        }
      } catch (err) {
        console.warn("annonce résultat:", err.message || err);
      }

      console.log(
        `Auto résultat : ${match.home} ${found.homeScore}-${found.awayScore} ${match.away}`
      );
    }
  } finally {
    scoresBusy = false;
  }
}

/* Salon : !match / !matchs / !lien → lien en MP (jamais le lien dans le chat) */
/* DM : n’importe quel message → lien site */
client.on("messageCreate", async (message) => {
  try {
    if (message.author?.bot) return;

    /* ——— DM ——— */
    if (!message.guild) {
      try {
        await message.reply(siteDmReply());
      } catch (err) {
        console.warn("DM site link:", err.message || err);
        try {
          await sendSiteLinkDm(message.author);
        } catch {
          /* DM fermés */
        }
      }
      return;
    }

    /* ——— Salon : !match / !lien (besoin Message Content Intent)
       ou @LMDS BOT lien / match (marche sans intent) ——— */
    const content = String(message.content || "");
    const mentioned = Boolean(client.user && message.mentions?.has?.(client.user));
    const isLinkCmd =
      LINK_CMD_RE.test(content) ||
      (mentioned && /\b(matchs?|lien|liens|site)\b/i.test(content));
    if (!isLinkCmd) return;

    const uid = message.author.id;
    const now = Date.now();
    const last = linkCmdCooldown.get(uid) || 0;
    if (now - last < LINK_CMD_COOLDOWN_MS) {
      try {
        const tip = await message.reply({
          content: "⏳ Attends quelques secondes avant de redemander le lien.",
          allowedMentions: { repliedUser: false },
        });
        setTimeout(() => tip.delete().catch(() => {}), 8_000);
      } catch {
        /* ignore */
      }
      return;
    }
    linkCmdCooldown.set(uid, now);

    try {
      await sendSiteLinkDm(message.author);
      const ack = await message.reply({
        content: "📩 Je t’ai envoyé le lien **en privé** — regarde tes MP.",
        allowedMentions: { repliedUser: false },
      });
      setTimeout(() => ack.delete().catch(() => {}), 12_000);
      message.delete().catch(() => {});
    } catch {
      try {
        const fail = await message.reply({
          content:
            "❌ Impossible de t’écrire en MP. Ouvre tes messages privés (Paramètres → Confidentialité → autoriser les MP des membres du serveur), puis réessaie `!lien`.",
          allowedMentions: { repliedUser: false },
        });
        setTimeout(() => fail.delete().catch(() => {}), 20_000);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn("messageCreate site link:", err.message || err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      if (await handleIptvSelect(interaction)) return;
      await handleSelect(interaction);
      return;
    }
    if (interaction.isButton()) {
      if (await handleIptvButton(interaction)) return;
      await handleButton(interaction);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error(err);
    const msg = { content: "Oups — réessaie.", flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

async function handleLinkCommand(interaction) {
  try {
    await sendSiteLinkDm(interaction.user);
    await interaction.reply({
      content: "📩 Lien envoyé **en privé** — regarde tes MP.",
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    await interaction.reply({
      content:
        "❌ Impossible de t’écrire en MP. Ouvre tes messages privés (Paramètres → Confidentialité → autoriser les MP des membres du serveur), puis réessaie.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleCommand(interaction) {
  const name = interaction.commandName;

  /* /lien /matchs /site → MP ( /match reste staff : créer un prono ) */
  if (name === "lien" || name === "matchs" || name === "site") {
    await handleLinkCommand(interaction);
    return;
  }

  if (name === "iptv-panel") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Staff only.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const msg = await postIptvPanel(interaction.channel);
    await interaction.editReply(`Panneau IPTV publié → ${msg.url}`);
    return;
  }

  if (!assertChannel(interaction)) {
    await interaction.reply({
      content: `Va dans <#${pronosChannelId}> pour les pronos.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const data = load();

  if (name === "prono-du-jour" || name === "sync") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Seul le staff peut publier le prono du jour.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    let site;
    try {
      site = await fetchSiteMatches();
    } catch (err) {
      await interaction.editReply(`Impossible de lire le site : ${err.message || err}`);
      return;
    }

    const list = site.today?.length ? site.today : site.all;
    if (!list.length) {
      await interaction.editReply("Aucun match foot du jour sur le site.");
      return;
    }

    const existingSlugs = new Set(
      Object.values(data.matches)
        .filter((m) => m.siteSlug)
        .map((m) => m.siteSlug)
    );

    let created = 0;
    let skipped = 0;
    const channel = interaction.channel;

    for (const sm of list.slice(0, 15)) {
      if (existingSlugs.has(sm.slug)) {
        skipped += 1;
        continue;
      }
      await publishSiteMatch(channel, sm, data, interaction.user.id);
      existingSlugs.add(sm.slug);
      created += 1;
    }

    await interaction.editReply(
      created
        ? `⚽ **Prono du jour** — **${created}** match(s) publié(s)${skipped ? ` · ${skipped} déjà là` : ""}.\nClique **Pronostiquer** sur le message d’intro.`
        : `Rien de nouveau — ${skipped} match(s) déjà publiés.\nClique **Pronostiquer** sur le message d’intro.`
    );
    await ensureIntroMessage(channel).catch(() => {});
    return;
  }

  if (name === "pronostiquer") {
    await replyPronoPicker(interaction);
    return;
  }

  if (name === "intro") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Seul le staff peut republier l’intro.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await ensureIntroMessage(interaction.channel);
    await interaction.editReply("Message d’intro prêt (avec bouton **Pronostiquer**).");
    return;
  }

  if (name === "match") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Seul le staff peut créer un match.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const home = interaction.options.getString("domicile", true).trim();
    const away = interaction.options.getString("exterieur", true).trim();
    const competition = interaction.options.getString("competition")?.trim() || "";
    const id = nextMatchId(data);

    const match = {
      id,
      home,
      away,
      competition,
      status: "open",
      createdAt: Date.now(),
      createdBy: interaction.user.id,
      messageId: null,
      channelId: interaction.channelId,
    };
    data.matches[id] = match;
    save(data);

    const msg = await interaction.reply({
      embeds: [buildMatchEmbed(match, data)],
      components: [buildButtons(match)],
      fetchReply: true,
    });

    data.matches[id].messageId = msg.id;
    save(data);
    return;
  }

  if (name === "classement") {
    const payload = buildClassementPayload(data);
    if (!payload.embeds.length) {
      await interaction.reply({
        content: payload.content,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply(payload);
  }
}

async function handleSelect(interaction) {
  if (interaction.customId !== "pick-prono") return;

  const matchId = interaction.values[0];
  const data = load();
  const match = data.matches[matchId];

  if (!match || match.status !== "open") {
    await interaction.reply({
      content: "Ce match n’est plus ouvert.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await showPronoModal(interaction, match, data);
}

async function handleButton(interaction) {
  if (interaction.customId === "intro-prono") {
    await replyPronoPicker(interaction);
    return;
  }
  if (interaction.customId === "intro-mes-pronos") {
    const payload = buildMesPronosPayload(load(), interaction.user.id);
    await interaction.reply({
      ...payload,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.customId === "intro-classement") {
    const payload = buildClassementPayload(load());
    await interaction.reply({
      ...payload,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [action, matchId] = interaction.customId.split(":");
  const data = load();
  const match = data.matches[matchId];

  if (!match && action !== "done") {
    await interaction.reply({
      content: "Ce match n’existe plus.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "prono") {
    if (match.status !== "open") {
      await interaction.reply({
        content: "Pronos fermés pour ce match.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await showPronoModal(interaction, match, data);
    return;
  }

  if (action === "voir") {
    const pred = data.predictions[`${matchId}:${interaction.user.id}`];
    if (!pred) {
      await interaction.reply({
        content: "Tu n’as pas encore pronostiqué ce match.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const extra =
      match.status === "closed"
        ? `\nScore réel : **${match.homeScore}-${match.awayScore}** → **${calcPoints(pred.home, pred.away, match.homeScore, match.awayScore)} pt(s)**`
        : "";
    await interaction.reply({
      content: `Ton prono : **${match.home} ${pred.home}-${pred.away} ${match.away}**${extra}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "result") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Seul le staff peut clôturer.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (match.status !== "open") {
      await interaction.reply({
        content: "Déjà clôturé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal-result:${matchId}`)
      .setTitle("Score final".slice(0, 45));

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("home")
          .setLabel(`Score ${match.home}`.slice(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("away")
          .setLabel(`Score ${match.away}`.slice(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2)
      )
    );

    await interaction.showModal(modal);
  }
}

async function handleModal(interaction) {
  const [kind, matchId] = interaction.customId.split(":");
  const data = load();
  const match = data.matches[matchId];

  if (!match) {
    await interaction.reply({
      content: "Match introuvable.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const homeRaw = interaction.fields.getTextInputValue("home").trim();
  const awayRaw = interaction.fields.getTextInputValue("away").trim();
  const home = Number(homeRaw);
  const away = Number(awayRaw);

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20) {
    await interaction.reply({
      content: "Entre des scores valides (0 à 20).",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (kind === "modal-prono") {
    if (match.status !== "open") {
      await interaction.reply({
        content: "Pronos fermés.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const key = `${matchId}:${interaction.user.id}`;
    const prev = data.predictions[key];
    data.predictions[key] = {
      matchId,
      userId: interaction.user.id,
      userTag: interaction.user.username,
      home,
      away,
      at: Date.now(),
    };
    save(data);

    await refreshMatchMessage(interaction, match, data);

    await interaction.reply({
      content: prev
        ? `Prono mis à jour : **${match.home} ${home}-${away} ${match.away}**`
        : `Prono enregistré : **${match.home} ${home}-${away} ${match.away}** ✅`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (kind === "modal-result") {
    if (!isStaff(interaction.member)) {
      await interaction.reply({
        content: "Staff only.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (match.status !== "open") {
      await interaction.reply({
        content: "Déjà clôturé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { detail } = applyMatchResult(match, home, away, data);
    await refreshMatchMessage(interaction, match, data);

    await interaction.reply({
      embeds: [resultEmbed(match, home, away, detail, false)],
    });
  }
}

async function refreshMatchMessage(interaction, match, data) {
  try {
    const channel =
      interaction?.channel ||
      (match.channelId ? await client.channels.fetch(match.channelId) : null);
    if (!channel || !match.messageId) return;
    const msg = await channel.messages.fetch(match.messageId);
    await msg.edit({
      embeds: [buildMatchEmbed(match, data)],
      components: [buildButtons(match)],
    });
  } catch (e) {
    console.warn("Refresh message:", e.message);
  }
}

/* Healthcheck HTTP (Render / Railway / Koyeb) — le bot Discord tourne à côté */
function startHealthServer() {
  const port = Number(process.env.PORT || 0);
  if (!port) return;
  http
    .createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    })
    .listen(port, () => console.log(`Health http://0.0.0.0:${port}`));

  const keepUrl = (process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (keepUrl) {
    setInterval(() => {
      fetch(keepUrl).catch(() => {});
    }, 8 * 60 * 1000);
  }
}

startHealthServer();
client.login(token);
