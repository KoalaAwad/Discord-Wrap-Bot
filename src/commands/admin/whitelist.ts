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
import { countOptIns } from "../../services/privacy";
import {
  addToWhitelist,
  listWhitelist,
  removeFromWhitelist,
} from "../../services/whitelist";

const trackableChannels = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildCategory,
] as const;

function channelOption(sub: SlashCommandSubcommandBuilder) {
  return sub.addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel or category (covers its threads and VC chat)")
      .addChannelTypes(...trackableChannels)
      .setRequired(true),
  );
}

export const data = new SlashCommandBuilder()
  .setName("whitelist")
  .setDescription("Choose which channels the bot may track (members opt in themselves)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    channelOption(sub.setName("add").setDescription("Allow tracking in a channel")),
  )
  .addSubcommand((sub) =>
    channelOption(sub.setName("remove").setDescription("Stop tracking in a channel")),
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("Show the whitelisted channels"),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const ids = listWhitelist(guildId);
    const optIns = countOptIns(guildId);
    await interaction.reply({
      content: [
        `**Channels:** ${ids.length ? ids.map((id) => `<#${id}>`).join(", ") : "none"}`,
        `**Members opted in:** ${optIns}`,
        "",
        "Only members who ran `/optin` themselves are tracked, and only in these channels.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  const id = interaction.options.getChannel("channel", true).id;
  const target = `<#${id}>`;
  const content =
    subcommand === "add"
      ? addToWhitelist(guildId, id, interaction.user.id)
        ? `Now tracking ${target} for members who opt in with \`/optin\`.`
        : `${target} was already whitelisted.`
      : removeFromWhitelist(guildId, id)
        ? `Stopped tracking ${target}.`
        : `${target} wasn't whitelisted.`;

  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  // People already in a call are picked up or dropped right away.
  if (interaction.guild) await resyncVoice(interaction.guild);
};
