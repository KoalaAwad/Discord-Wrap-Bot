import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  await interaction.reply("Pong!");
};
