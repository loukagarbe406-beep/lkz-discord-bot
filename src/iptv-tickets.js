/**
 * Panneau IPTV Discord — offre, durée, paiement, ticket + consignes.
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  MessageFlags,
} from "discord.js";

export const PLANS = [
  { id: "24h", label: "Test 24h - Indisponible", price: "Indisponible", months: 0, free: true, unavailable: true },
  { id: "1m", label: "1 mois", price: "10 €", months: 1 },
  { id: "3m", label: "3 mois", price: "25 €", months: 3 },
  { id: "6m", label: "6 mois ⭐", price: "45 €", months: 6, best: true },
  { id: "12m", label: "12 mois", price: "70 €", months: 12 },
];

export const PAYMENTS = [
  { id: "paypal", label: "PayPal", emoji: "💳" },
  { id: "iban", label: "Virement bancaire", emoji: "🏦" },
];

const DEFAULT_IBAN = "FR38 3000 2050 0000 0085 7593 A21";
const SITE_URL = (
  process.env.SITE_URL?.trim() || "https://lmdslive.pages.dev"
).replace(/\/$/, "");
const SITE_NAME = process.env.SITE_NAME?.trim() || "LMDS+";

/** userId → { planId, payId } */
const pendingOrders = new Map();

function cfg() {
  return {
    paypalUrl:
      process.env.PAYPAL_URL?.trim() ||
      process.env.PAYPAL_EMAIL?.trim() ||
      "https://www.paypal.com/paypalme/ailekazaide01",
    iban: process.env.BANK_IBAN?.trim() || DEFAULT_IBAN,
    staffRoleId: process.env.IPTV_STAFF_ROLE_ID?.trim() || "",
    /* Owner IPTV — propriétaire du serveur */
    ownerUserId:
      process.env.IPTV_OWNER_ID?.trim() || "1512543793495408686",
    ticketsCategoryId: process.env.IPTV_TICKETS_CATEGORY_ID?.trim() || "",
    panelChannelId: process.env.IPTV_CHANNEL_ID?.trim() || "",
  };
}

export function planById(id) {
  return PLANS.find((p) => p.id === id) || null;
}

export function payById(id) {
  return PAYMENTS.find((p) => p.id === id) || null;
}

function ticketChannelName(safeName) {
  return `⏳｜iptv-${safeName}`;
}

function isIptvTicketName(name) {
  const n = String(name || "");
  return (
    n.startsWith("iptv-") ||
    n.startsWith("⏳｜iptv-") ||
    n.startsWith("⏳-iptv-") ||
    /iptv-/i.test(n)
  );
}

function isOpenTicketForUser(channel, safeName, userId) {
  if (channel?.type !== ChannelType.GuildText) return false;
  if (!channel.topic?.includes(userId)) return false;
  const n = channel.name || "";
  return (
    n === ticketChannelName(safeName) ||
    n === `iptv-${safeName}` ||
    n.endsWith(`iptv-${safeName}`)
  );
}

export function buildOfferEmbed() {
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setDescription(
      [
        "# Contenu disponible",
        "",
        `Sur **${SITE_NAME}**, tu as un catalogue large et une équipe qui t’accompagne **avant, pendant et après** ta commande.`,
        "",
        `• Plus de **28 300** chaînes TV dans **+180** pays`,
        `• Plus de **157 000** films et **50 000** séries`,
        `• Qualité **SD / HD / FHD / UHD / 4K**`,
        `• Compatible **TV, PC, smartphone** et box IPTV`,
        `• Abonnements **1, 3, 6** ou **12** mois`,
        "",
        "## Une expérience fluide",
        "→ Infra optimisée pour limiter coupures et freezes",
        "→ Diffusion stable selon ta connexion et ton appareil",
        "→ Serveurs surveillés pour garder une bonne qualité",
        "",
        "## Nos offres",
        "### 🔹 1 mois — 10 €",
        "### 🔹 3 mois — 25 €",
        "### 🔹 6 mois — 45 €",
        "### 🔹 12 mois — 70 €",
        "",
        `## Pourquoi ${SITE_NAME} ?`,
        "→ Activation rapide",
        "→ Service fiable et sécurisé",
        "→ Bon rapport qualité / prix",
        "→ Assistance réactive sur Discord",
      ].join("\n")
    );
}

export function buildPanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("iptv-open")
        .setLabel("Souscrire à un abonnement")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function postIptvPanel(channel) {
  return channel.send({
    embeds: [buildOfferEmbed()],
    components: buildPanelComponents(),
  });
}

function planSelectOptions(cur) {
  return PLANS.map((p) => {
    const opt = {
      label: (p.unavailable
        ? p.label
        : `${p.label} - ${p.price}`
      ).slice(0, 100),
      value: p.id,
    };
    /* Jamais description: undefined — Discord fait tourner le select en boucle */
    if (p.unavailable) opt.description = "Temporairement indisponible";
    else if (p.best) opt.description = "Le plus rentable";
    else if (p.free) opt.description = "Essai sans engagement";
    else opt.description = "Abonnement IPTV";
    /* Ne jamais envoyer default:false — Discord peut bloquer le select */
    if (cur.planId === p.id) opt.default = true;
    return opt;
  });
}

function paySelectOptions(cur) {
  return PAYMENTS.map((p) => {
    const opt = {
      label: p.label.slice(0, 100),
      value: p.id,
      description: p.id === "paypal" ? "Paiement PayPal" : "Virement IBAN",
    };
    if (cur.payId === p.id) opt.default = true;
    return opt;
  });
}

function orderSelectRows(userId) {
  const cur = pendingOrders.get(userId) || {};
  const plan = planById(cur.planId);
  const planRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("iptv-plan")
      .setPlaceholder(
        cur.planId
          ? `Duree : ${plan?.label || "?"} - ${plan?.price || "?"}`
          : "1) Choisis la duree"
      )
      .addOptions(planSelectOptions(cur))
  );

  const payRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("iptv-pay")
      .setPlaceholder(
        cur.payId
          ? `Paiement : ${payById(cur.payId)?.label || "?"}`
          : "2) Choisis le moyen de paiement"
      )
      .addOptions(paySelectOptions(cur))
  );

  const selectedPlan = planById(cur.planId);
  const canConfirm = !!(
    cur.planId &&
    !selectedPlan?.unavailable &&
    (selectedPlan?.free || cur.payId)
  );

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iptv-confirm")
      .setLabel("Confirmer & ouvrir le ticket")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canConfirm)
  );

  return [planRow, payRow, btnRow];
}

function orderPreviewEmbed(userId) {
  const cur = pendingOrders.get(userId) || {};
  const plan = planById(cur.planId);
  const pay = payById(cur.payId);
  return new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle("Commande IPTV")
    .setDescription(
      [
        plan
          ? `**Durée** : ${plan.label} — **${plan.price}**`
          : "_Choisis une durée_",
        plan?.free
          ? "**Paiement** : aucun (test gratuit)"
          : pay
            ? `**Paiement** : ${pay.label}`
            : "_Choisis un moyen de paiement_",
        "",
        "Quand c’est bon, clique **Confirmer & ouvrir le ticket**.",
      ].join("\n")
    );
}

export async function handleIptvButton(interaction) {
  const id = interaction.customId;

  if (id === "iptv-open") {
    pendingOrders.set(interaction.user.id, {});
    await interaction.reply({
      embeds: [orderPreviewEmbed(interaction.user.id)],
      components: orderSelectRows(interaction.user.id),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (id === "iptv-confirm") {
    const cur = pendingOrders.get(interaction.user.id) || {};
    const plan = planById(cur.planId);
    if (plan?.unavailable) {
      await interaction.reply({
        content:
          "⛔ Le **test 24h** est temporairement **indisponible**. Choisis une autre durée.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const pay = plan?.free
      ? { id: "free", label: "Test gratuit" }
      : payById(cur.payId);
    if (!plan || !pay) {
      await interaction.reply({
        content: plan?.free
          ? "Choisis d’abord la **durée**."
          : "Choisis d’abord la **durée** et le **moyen de paiement**.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    /* deferUpdate = stop le spinner du bouton tout de suite */
    try {
      await interaction.deferUpdate();
    } catch (err) {
      console.error("iptv confirm defer:", err?.message || err);
      return true;
    }
    try {
      const channel = await createTicketChannel(interaction, plan, pay);
      pendingOrders.delete(interaction.user.id);
      await interaction.editReply({
        content: `✅ Ticket créé → ${channel}`,
        embeds: [],
        components: [],
      });
      await interaction
        .followUp({
          content: `Ton ticket : ${channel}`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    } catch (err) {
      console.error("iptv ticket:", err);
      const msg = String(err?.message || err);
      await interaction
        .editReply({
          content: msg.includes("déjà un ticket")
            ? `ℹ️ ${msg}`
            : `Impossible de créer le ticket : ${msg}`,
          components: orderSelectRows(interaction.user.id),
          embeds: [orderPreviewEmbed(interaction.user.id)],
        })
        .catch(() => {});
    }
    return true;
  }

  if (id === "iptv-close") {
    if (!isIptvTicketName(interaction.channel?.name)) {
      await interaction.reply({
        content: "Pas un ticket IPTV.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const staff =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      (cfg().staffRoleId &&
        interaction.member?.roles?.cache?.has(cfg().staffRoleId)) ||
      (cfg().ownerUserId && interaction.user.id === cfg().ownerUserId);
    const isOwner =
      interaction.channel.topic?.includes(interaction.user.id) || false;

    if (!staff && !isOwner) {
      await interaction.reply({
        content: "Seul le staff / owner (ou le créateur) peut fermer.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.reply({ content: "Ticket fermé dans 3s…" });
    setTimeout(() => {
      interaction.channel.delete("Ticket IPTV fermé").catch(() => {});
    }, 3000);
    return true;
  }

  return false;
}

export async function handleIptvSelect(interaction) {
  const id = interaction.customId;
  if (id !== "iptv-plan" && id !== "iptv-pay") return false;

  /* Stop le spinner Discord tout de suite (sinon ça tourne à l’infini) */
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  } catch (err) {
    console.error("iptv select defer:", err?.message || err);
    return true;
  }

  const cur = pendingOrders.get(interaction.user.id) || {};
  if (id === "iptv-plan") {
    const chosen = planById(interaction.values[0]);
    if (chosen?.unavailable) {
      await interaction
        .editReply({
          embeds: [orderPreviewEmbed(interaction.user.id)],
          components: orderSelectRows(interaction.user.id),
          content:
            "⛔ Test 24h indisponible — choisis une autre durée.",
        })
        .catch((e) => console.error("iptv select unavailable:", e?.message || e));
      return true;
    }
    cur.planId = interaction.values[0];
  }
  if (id === "iptv-pay") cur.payId = interaction.values[0];
  pendingOrders.set(interaction.user.id, cur);

  const payload = {
    content: null,
    embeds: [orderPreviewEmbed(interaction.user.id)],
    components: orderSelectRows(interaction.user.id),
  };
  try {
    await interaction.editReply(payload);
  } catch (err) {
    console.error("iptv select editReply:", err?.message || err);
    await interaction
      .followUp({
        content: "Sélection enregistrée — reclique **Confirmer** si besoin.",
        embeds: payload.embeds,
        components: payload.components,
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
  return true;
}

function buildTicketEmbed(plan, pay, user) {
  const { iban, paypalUrl } = cfg();
  const lines = [
    `Salut ${user} 👋`,
    "",
    `**Offre** : IPTV · ${plan.label} · **${plan.price}**`,
    `**Paiement choisi** : ${pay.label}`,
    "",
  ];

  if (plan.free || pay.id === "free") {
    lines.push(
      "## Test gratuit 24h",
      "",
      "1. Indique ici l’appareil / appli que tu utilises (Smart TV, Firestick, téléphone…)",
      "",
      "2. Un membre du staff te génère ton **accès test 24h** 🎉",
      "",
      "_Aucun paiement requis pour cette offre._"
    );
  } else if (pay.id === "paypal") {
    lines.push(
      "## Comment payer (PayPal)",
      "",
      "1. Paie le montant exact via ce lien PayPal :",
      `→ [Lien PayPal](${paypalUrl})`,
      "",
      "2. Envoie **la preuve de paiement** ici (capture d’écran)",
      "",
      "3. On te génère ton **code d’accès IPTV** 🎉"
    );
  } else {
    lines.push(
      "## Comment payer (Virement bancaire)",
      "",
      "1. Fais un virement du montant exact sur cet IBAN :",
      `→ \`${iban}\``,
      "",
      "2. Envoie **la preuve de paiement** ici (capture d’écran)",
      "",
      "3. On te génère ton **code d’accès IPTV** 🎉"
    );
  }

  return new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle("Ticket IPTV — instructions")
    .setDescription(lines.join("\n"))
    .setFooter({
      text: "Reste sur ce salon, on te répond ici",
    });
}

/**
 * Catégorie Tickets : @everyone n’a pas ViewChannel.
 * Si le bot n’y a pas d’overwrite → Discord refuse create (50013).
 * On ne peut pas s’auto-ajouter (Missing Access) → fallback hors catégorie.
 */
async function resolveTicketsParent(guild) {
  const { ticketsCategoryId } = cfg();
  const parentId = ticketsCategoryId || "1536043338179018883";
  const category = await guild.channels.fetch(parentId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    console.warn("iptv: catégorie tickets introuvable → salon à la racine");
    return null;
  }

  const me = guild.members.me || (await guild.members.fetchMe());
  const canView = category.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel);
  const canManage = category.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels);

  if (canView && canManage) return parentId;

  /* Tentative d’auto-fix (échoue souvent si ViewChannel déjà deny) */
  try {
    await category.permissionOverwrites.edit(me.id, {
      ViewChannel: true,
      ManageChannels: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      AttachFiles: true,
    });
    if (category.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel)) {
      return parentId;
    }
  } catch (err) {
    console.warn(
      "iptv: impossible d’accéder à la catégorie Tickets (",
      err.message || err,
      ") → ticket créé hors catégorie. Ajoute le rôle du bot avec Voir le salon sur « Tickets »."
    );
  }
  return null;
}

async function createTicketChannel(interaction, plan, pay) {
  const guild = interaction.guild;
  if (!guild) throw new Error("Pas de serveur");

  const { staffRoleId, ownerUserId } = cfg();
  const everyone = guild.roles.everyone;
  const safeName =
    interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 20) || "client";

  try {
    await guild.channels.fetch();
  } catch (_) {}

  const existing = guild.channels.cache.find((c) =>
    isOpenTicketForUser(c, safeName, interaction.user.id)
  );
  if (existing) {
    throw new Error(`Tu as déjà un ticket ouvert : ${existing}`);
  }

  const parentId = await resolveTicketsParent(guild);

  const overwrites = [
    {
      id: everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: interaction.client.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  if (ownerUserId) {
    overwrites.push({
      id: ownerUserId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  const createPayload = {
    name: ticketChannelName(safeName),
    type: ChannelType.GuildText,
    topic: `IPTV ${plan.id}/${pay.id} · user:${interaction.user.id} · ${plan.price}`,
    permissionOverwrites: overwrites,
    reason: `Ticket IPTV ${interaction.user.tag}`,
  };
  if (parentId) createPayload.parent = parentId;

  let channel;
  try {
    channel = await guild.channels.create(createPayload);
  } catch (err) {
    if (err?.code === 50013) {
      /* Retry hors catégorie, puis sans overwrites staff/owner */
      if (createPayload.parent) {
        delete createPayload.parent;
        try {
          channel = await guild.channels.create(createPayload);
        } catch (err2) {
          if (err2?.code !== 50013) throw err2;
        }
      }
      if (!channel) {
        createPayload.permissionOverwrites = [
          {
            id: everyone.id,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: interaction.client.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ];
        channel = await guild.channels.create(createPayload);
        /* Ajoute owner/staff après coup si possible */
        if (ownerUserId) {
          await channel.permissionOverwrites
            .edit(ownerUserId, {
              ViewChannel: true,
              SendMessages: true,
              AttachFiles: true,
              ReadMessageHistory: true,
              ManageChannels: true,
            })
            .catch(() => {});
        }
        if (staffRoleId) {
          await channel.permissionOverwrites
            .edit(staffRoleId, {
              ViewChannel: true,
              SendMessages: true,
              AttachFiles: true,
              ReadMessageHistory: true,
              ManageChannels: true,
            })
            .catch(() => {});
        }
      }
    } else {
      throw err;
    }
  }

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iptv-close")
      .setLabel("Fermer le ticket")
      .setStyle(ButtonStyle.Danger)
  );

  const pings = [interaction.user.toString()];
  if (ownerUserId) pings.push(`<@${ownerUserId}>`);
  if (staffRoleId) pings.push(`<@&${staffRoleId}>`);
  await channel.send({
    content: pings.join(" "),
    embeds: [buildTicketEmbed(plan, pay, interaction.user)],
    components: [closeRow],
  });

  return channel;
}
