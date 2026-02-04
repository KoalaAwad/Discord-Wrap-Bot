import { SlashCommandBuilder, GuildMember } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("user")
  .setDescription("Provides information about the user");

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!(interaction.member instanceof GuildMember)) {
    await interaction.reply("Member data is unavailable");
    return;
  }
  await interaction.reply(
    `This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}`,
  );
};
