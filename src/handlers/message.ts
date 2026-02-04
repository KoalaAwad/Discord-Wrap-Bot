import { Events, type Client } from "discord.js";
import { getSilentMode } from "../state";

type BatchMessage = {
  userId: string;
  createdAt: number;
  channelId: string;
};

type BatchReaction = {
  userId: string;
  emojiDisplay: string;
  messageAuthorId: string;
  messageId: string;
  messageChannelId: string;
};

// this list of messages in the current batch
const messageBatch: BatchMessage[] = [];
// reaction counter mapped to a userID
const reactionBatch: BatchReaction[] = [];
let topMessageOverallId: string | undefined;
let topMessageOverallCount = 0;
let topMessageOverallChannelId: string | undefined;

export function registerMessageBatch(client: Client) {
  client.on(Events.MessageCreate, async (message) => {
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

    if (!topUserId) return;

    if (!getSilentMode()) {
      await message.channel.send(
        `Batch complete! <@${topUserId}> sent the most messages (${topCount}).`,
      );
    }

    if (reactionBatch.length > 0) {
      const reactionCountsByUser = new Map<string, number>();
      const reactionCountsByReceiver = new Map<string, number>();
      const reactionCountsByUserEmoji = new Map<string, Map<string, number>>();
      const reactionCountsByMessage = new Map<string, number>();
      const messageInfoById = new Map<string, { channelId: string }>();

      for (const reaction of reactionBatch) {
        reactionCountsByUser.set(
          reaction.userId,
          (reactionCountsByUser.get(reaction.userId) ?? 0) + 1,
        );

        reactionCountsByReceiver.set(
          reaction.messageAuthorId,
          (reactionCountsByReceiver.get(reaction.messageAuthorId) ?? 0) + 1,
        );

        reactionCountsByMessage.set(
          reaction.messageId,
          (reactionCountsByMessage.get(reaction.messageId) ?? 0) + 1,
        );
        messageInfoById.set(reaction.messageId, {
          channelId: reaction.messageChannelId,
        });

        const emojiMap =
          reactionCountsByUserEmoji.get(reaction.userId) ??
          new Map<string, number>();
        emojiMap.set(
          reaction.emojiDisplay,
          (emojiMap.get(reaction.emojiDisplay) ?? 0) + 1,
        );
        reactionCountsByUserEmoji.set(reaction.userId, emojiMap);
      }

      let topReactorId: string | undefined;
      let topReactionsCount = 0;

      for (const [userId, count] of reactionCountsByUser) {
        if (count > topReactionsCount) {
          topReactorId = userId;
          topReactionsCount = count;
        }
      }

      if (topReactorId) {
        const emojiMap =
          reactionCountsByUserEmoji.get(topReactorId) ??
          new Map<string, number>();
        let topEmoji = "";
        let topEmojiCount = 0;

        for (const [emojiDisplay, count] of emojiMap) {
          if (count > topEmojiCount) {
            topEmoji = emojiDisplay;
            topEmojiCount = count;
          }
        }

        if (!getSilentMode()) {
          await message.channel.send(
            `User <@${topReactorId}> reacted the most with ${topEmoji} used ${topEmojiCount} times!`,
          );
        }
      }

      let topReceiverId: string | undefined;
      let topReceiverCount = 0;

      for (const [userId, count] of reactionCountsByReceiver) {
        if (count > topReceiverCount) {
          topReceiverId = userId;
          topReceiverCount = count;
        }
      }

      if (topReceiverId && !getSilentMode()) {
        await message.channel.send(
          `User <@${topReceiverId}> received the most reactions (${topReceiverCount}) this batch!`,
        );
      }

      let topMessageId: string | undefined;
      let topMessageCount = 0;

      for (const [messageId, count] of reactionCountsByMessage) {
        if (count > topMessageCount) {
          topMessageId = messageId;
          topMessageCount = count;
        }
      }

      if (topMessageId) {
        const info = messageInfoById.get(topMessageId);
        if (topMessageCount > topMessageOverallCount) {
          topMessageOverallId = topMessageId;
          topMessageOverallCount = topMessageCount;
          topMessageOverallChannelId = info?.channelId;
        }
      }

      if (topMessageOverallId && !getSilentMode()) {
        const link = topMessageOverallChannelId
          ? `https://discord.com/channels/${message.guild?.id}/${topMessageOverallChannelId}/${topMessageOverallId}`
          : topMessageOverallId;

        await message.channel.send(
          `Current top reacted message: ${link} with ${topMessageOverallCount} reactions!`,
        );
      }

      reactionBatch.splice(0, reactionBatch.length);
    }
  });
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }
    if (!reaction.message.guild) return;
    if (!reaction.message.author) return;

    reactionBatch.push({
      userId: user.id,
      emojiDisplay: reaction.emoji.toString(),
      messageAuthorId: reaction.message.author.id,
      messageId: reaction.message.id,
      messageChannelId: reaction.message.channelId,
    });
  });
}
