import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getSilentMode, setSilentMode } from "../../state";

export const data = new SlashCommandBuilder()
  .setName("silent")
  .setDescription("Toggle announcement messages on/off")
  .addBooleanOption((option) =>
    option
      .setName("enabled")
      .setDescription("True to mute announcements, false to unmute")
      .setRequired(true),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  const enabled = interaction.options.getBoolean("enabled", true);
  setSilentMode(enabled);

  await interaction.reply({
    content: `Silent mode is now ${getSilentMode() ? "ON" : "OFF"}.`,
    ephemeral: true,
  });
};
