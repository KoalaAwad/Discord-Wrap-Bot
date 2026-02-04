import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getMessageTotals } from "../../services/batch";
import {
  getReactionTotals,
  getTopReactedMessage,
} from "../../services/reactions";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show current batch totals");

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  const messageTotals = getMessageTotals();
  const reactionTotals = getReactionTotals();
  const topMessage = getTopReactedMessage();

  const topMessageLink = topMessage.messageId
    ? `https://discord.com/channels/${interaction.guild?.id}/${topMessage.channelId}/${topMessage.messageId}`
    : "No message yet";

  await interaction.reply({
    content: [
      `Top message sender: ${messageTotals.topUserId ? `<@${messageTotals.topUserId}> (${messageTotals.topCount ?? 0})` : "None"}`,
      `Top reactor: ${reactionTotals.topReactorId ? `<@${reactionTotals.topReactorId}> (${reactionTotals.topReactorCount ?? 0})` : "None"}`,
      `Top reaction receiver: ${reactionTotals.topReceiverId ? `<@${reactionTotals.topReceiverId}> (${reactionTotals.topReceiverCount ?? 0})` : "None"}`,
      `Top reacted message: ${topMessageLink} (${topMessage.reactionCount ?? 0})`,
    ].join("\n"),
    ephemeral: true,
  });
};
