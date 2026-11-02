import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import {
  addToWhitelist,
  listWhitelist,
  removeFromWhitelist,
  type WhitelistKind,
} from "../../services/whitelist";

const trackableChannels = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildCategory,
] as const;

function targetOptions(sub: SlashCommandSubcommandBuilder) {
  return sub
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel or category (covers its threads and VC chat)")
        .addChannelTypes(...trackableChannels),
    )
    .addUserOption((option) =>
      option.setName("user").setDescription("A single member"),
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("Every member with this role (@everyone for all)"),
    );
}

export const data = new SlashCommandBuilder()
  .setName("whitelist")
  .setDescription("Choose which channels and members the bot may track")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    targetOptions(sub.setName("add").setDescription("Allow tracking")),
  )
  .addSubcommand((sub) =>
    targetOptions(sub.setName("remove").setDescription("Stop tracking")),
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("Show what is whitelisted"),
  );

const mention: Record<WhitelistKind, (id: string) => string> = {
  channel: (id) => `<#${id}>`,
  user: (id) => `<@${id}>`,
  role: (id) => `<@&${id}>`,
};

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const rows = listWhitelist(guildId);
    const lines = (["channel", "user", "role"] as const).map((kind) => {
      const ids = rows.filter((r) => r.kind === kind).map((r) => r.target_id);
      return `**${kind}s:** ${ids.length ? ids.map(mention[kind]).join(", ") : "none"}`;
    });
    const note =
      "Tracking needs both a whitelisted channel and a whitelisted member (by user or role).";
    await interaction.reply({
      content: [...lines, "", note].join("\n"),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  const targets: [WhitelistKind, string | undefined][] = [
    ["channel", interaction.options.getChannel("channel")?.id],
    ["user", interaction.options.getUser("user")?.id],
    ["role", interaction.options.getRole("role")?.id],
  ];
  const chosen = targets.filter(
    (target): target is [WhitelistKind, string] => target[1] !== undefined,
  );

  if (chosen.length === 0) {
    await interaction.reply({
      content: "Pick at least one channel, user or role.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = chosen.map(([kind, id]) => {
    const target = mention[kind](id);
    if (subcommand === "add") {
      return addToWhitelist(guildId, kind, id, interaction.user.id)
        ? `Now tracking ${target}.`
        : `${target} was already whitelisted.`;
    }
    return removeFromWhitelist(guildId, kind, id)
      ? `Stopped tracking ${target}.`
      : `${target} wasn't whitelisted.`;
  });

  await interaction.reply({
    content: lines.join("\n"),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  // People already in a call are picked up or dropped right away.
  if (interaction.guild) await resyncVoice(interaction.guild);
};
