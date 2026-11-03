import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import { optIn } from "../../services/privacy";
import { listWhitelist } from "../../services/whitelist";

export const data = new SlashCommandBuilder()
  .setName("optin")
  .setDescription("Let the bot count your activity here for /stats and the wrap")
  .setContexts(InteractionContextType.Guild);

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;

  const changed = optIn(guildId, interaction.user.id);
  const channels = listWhitelist(guildId);
  const where = channels.length
    ? `in ${channels.map((id) => `<#${id}>`).join(", ")}`
    : "once an admin whitelists some channels";

  await interaction.reply({
    content: [
      changed ? "**You're in.**" : "You're already opted in.",
      `Your messages, reactions and voice time are counted ${where}. Message text is never stored.`,
      "Use `/optout` any time to stop and delete your data.",
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  if (changed && interaction.guild) await resyncVoice(interaction.guild);
};
