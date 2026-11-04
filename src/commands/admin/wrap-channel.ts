import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getWrapChannel, setWrapChannel } from "../../services/settings";
import { wrapStatus } from "../../wrap/window";

const NEEDED = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.AttachFiles, "Attach Files"],
] as const;

export const data = new SlashCommandBuilder()
  .setName("wrap-channel")
  .setDescription("Where the server wrap is posted when wrap week opens")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Post the server wrap here when wrap week opens")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Text or announcement channel")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("clear").setDescription("Don't post the wrap automatically"),
  )
  .addSubcommand((sub) =>
    sub.setName("show").setDescription("Show the current wrap channel"),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();
  const opens = `<t:${Math.floor(wrapStatus().nextOpens / 1000)}:D>`;

  if (sub === "show") {
    const current = getWrapChannel(guildId);
    await interaction.reply({
      content: current
        ? `The server wrap will be posted in <#${current}> when wrap week opens (${opens}), unless \`/silent\` is on.`
        : "No wrap channel is set, so the wrap isn't posted automatically.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "clear") {
    setWrapChannel(guildId, null);
    await interaction.reply({
      content: "The wrap won't be posted automatically. People can still use `/wrap`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  const me = interaction.guild.members.me;
  const permissions = me ? interaction.guild.channels.cache.get(channel.id)?.permissionsFor(me) : null;
  const missing = NEEDED.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);

  if (missing.length > 0) {
    await interaction.reply({
      content: `I can't post in <#${channel.id}> yet. Give me ${missing.join(", ")} there, then try again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  setWrapChannel(guildId, channel.id);
  await interaction.reply({
    content: `The server wrap will be posted in <#${channel.id}> when wrap week opens (${opens}).`,
    flags: MessageFlags.Ephemeral,
  });
};
