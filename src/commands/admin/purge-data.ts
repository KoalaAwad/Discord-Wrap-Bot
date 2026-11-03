import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import { deleteChannelData, deleteUserData } from "../../services/privacy";
import { confirm } from "../../util/confirm";

export const data = new SlashCommandBuilder()
  .setName("purge-data")
  .setDescription("Delete stored stats for one member or one channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName("user")
      .setDescription("Delete a member's data (doesn't stop future tracking)")
      .addUserOption((option) =>
        option.setName("user").setDescription("The member").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Delete a channel's data (its threads are separate)")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Text, voice, announcement, stage or forum channel, or a thread")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
            ChannelType.AnnouncementThread,
          )
          .setRequired(true),
      ),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;

  if (interaction.options.getSubcommand() === "user") {
    const user = interaction.options.getUser("user", true);
    const press = await confirm(
      interaction,
      `Delete all stored messages, reactions and voice time for <@${user.id}>? This can't be undone. If they're opted in, new activity keeps being tracked; they can \`/optout\` to stop that.`,
      "Delete their data",
    );
    if (!press) return;

    deleteUserData(guildId, user.id);
    await press.update({ content: `Deleted all data for <@${user.id}>.`, components: [] });
    // Their open voice session was deleted too; restart it if they're in a call.
    if (interaction.guild) await resyncVoice(interaction.guild);
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  const press = await confirm(
    interaction,
    `Delete all stored messages, reactions and voice time in <#${channel.id}>? This can't be undone. If it's still whitelisted, new activity there keeps being tracked.`,
    "Delete channel data",
  );
  if (!press) return;

  deleteChannelData(guildId, channel.id);
  await press.update({ content: `Deleted all data for <#${channel.id}>.`, components: [] });
  if (interaction.guild) await resyncVoice(interaction.guild);
};
