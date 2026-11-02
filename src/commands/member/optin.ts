import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import { optIn } from "../../services/privacy";

export const data = new SlashCommandBuilder()
  .setName("optin")
  .setDescription("Undo /optout so the bot may track you here again")
  .setContexts(InteractionContextType.Guild);

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;

  const changed = optIn(interaction.guildId, interaction.user.id);

  await interaction.reply({
    content: changed
      ? "You're opted back in. You'll be tracked from now on wherever an admin has whitelisted you."
      : "You weren't opted out. Whether you're tracked depends on the server's `/whitelist`.",
    flags: MessageFlags.Ephemeral,
  });
  if (changed && interaction.guild) await resyncVoice(interaction.guild);
};
