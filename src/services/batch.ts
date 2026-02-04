import type { Message } from "discord.js";
import { getSilentMode } from "../state";
import { drainReactionSummary } from "./reactions";

type BatchMessage = {
  userId: string;
  createdAt: number;
  channelId: string;
};

const messageBatch: BatchMessage[] = [];
let topMessageOverallId: string | undefined;
let topMessageOverallCount = 0;
let topMessageOverallChannelId: string | undefined;

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

    if (reactionSummary.topMessageId) {
      if ((reactionSummary.topMessageCount ?? 0) > topMessageOverallCount) {
        topMessageOverallId = reactionSummary.topMessageId;
        topMessageOverallCount = reactionSummary.topMessageCount ?? 0;
        topMessageOverallChannelId = reactionSummary.topMessageChannelId;
      }
    }
  }

  if (topMessageOverallId && !getSilentMode() && message.channel.isSendable()) {
    const link = topMessageOverallChannelId
      ? `https://discord.com/channels/${message.guild.id}/${topMessageOverallChannelId}/${topMessageOverallId}`
      : topMessageOverallId;

    await message.channel.send(
      `Current top reacted message: ${link} with ${topMessageOverallCount} reactions!`,
    );
  }
}
