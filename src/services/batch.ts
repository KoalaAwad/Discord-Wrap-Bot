import type { Message } from "discord.js";
import { getSilentMode } from "../state";
import { drainReactionSummary, getTopReactedMessage } from "./reactions";

type BatchMessage = {
  userId: string;
  createdAt: number;
  channelId: string;
};

const messageBatch: BatchMessage[] = [];
const totalMessageCounts = new Map<string, number>();

export async function handleBatchMessage(message: Message) {
  if (message.author.bot || !message.guild) return;

  messageBatch.push({
    userId: message.author.id,
    createdAt: message.createdTimestamp,
    channelId: message.channelId,
  });

  if (messageBatch.length < 5) return;

  const batch = messageBatch.splice(0, 5);
  const counts = new Map<string, number>();

  for (const item of batch) {
    counts.set(item.userId, (counts.get(item.userId) ?? 0) + 1);
    totalMessageCounts.set(
      item.userId,
      (totalMessageCounts.get(item.userId) ?? 0) + 1,
    );
  }

  let topUserId: string | undefined;
  let topCount = 0;

  for (const [userId, count] of counts) {
    if (count > topCount) {
      topUserId = userId;
      topCount = count;
    }
  }

  if (topUserId && !getSilentMode() && message.channel.isSendable()) {
    await message.channel.send(
      `Batch complete! <@${topUserId}> sent the most messages (${topCount}).`,
    );
  }

  const reactionSummary = drainReactionSummary();

  if (reactionSummary) {
    if (
      reactionSummary.topReactorId &&
      !getSilentMode() &&
      message.channel.isSendable()
    ) {
      await message.channel.send(
        `User <@${reactionSummary.topReactorId}> reacted the most with ${reactionSummary.topEmoji} used ${reactionSummary.topEmojiCount} times!`,
      );
    }

    if (
      reactionSummary.topReceiverId &&
      !getSilentMode() &&
      message.channel.isSendable()
    ) {
      await message.channel.send(
        `User <@${reactionSummary.topReceiverId}> received the most reactions (${reactionSummary.topReceiverCount}) this batch!`,
      );
    }
  }

  const topMessage = getTopReactedMessage();

  if (
    topMessage.messageId &&
    !getSilentMode() &&
    message.channel.isSendable()
  ) {
    const link = topMessage.channelId
      ? `https://discord.com/channels/${message.guild.id}/${topMessage.channelId}/${topMessage.messageId}`
      : topMessage.messageId;

    await message.channel.send(
      `Current top reacted message: ${link} with ${topMessage.reactionCount ?? 0} reactions!`,
    );
  }
}

export function getMessageTotals() {
  let topUserId: string | undefined;
  let topCount = 0;

  for (const [userId, count] of totalMessageCounts) {
    if (count > topCount) {
      topUserId = userId;
      topCount = count;
    }
  }

  return {
    topUserId,
    topCount: topCount || undefined,
  };
}
