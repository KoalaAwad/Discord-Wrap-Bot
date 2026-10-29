import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getSilentMode, setSilentMode } from "../../services/settings";

export const data = new SlashCommandBuilder()
  .setName("silent")
  .setDescription("Toggle announcement messages on/off")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addBooleanOption((option) =>
    option
      .setName("enabled")
      .setDescription("True to mute announcements, false to unmute")
      .setRequired(true),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const enabled = interaction.options.getBoolean("enabled", true);
  setSilentMode(interaction.guildId, enabled);

  await interaction.reply({
    content: `Silent mode is now ${getSilentMode(interaction.guildId) ? "ON" : "OFF"}.`,
    flags: MessageFlags.Ephemeral,
  });
};
