type ReactionRecord = {
  userId: string;
  emojiDisplay: string;
  messageAuthorId: string;
  messageId: string;
  messageChannelId: string;
};

type ReactionSummary = {
  topReactorId?: string | undefined;
  topEmoji?: string | undefined;
  topEmojiCount?: number | undefined;
  topReceiverId?: string | undefined;
  topReceiverCount?: number | undefined;
  topMessageId?: string | undefined;
  topMessageCount?: number | undefined;
  topMessageChannelId?: string | undefined;
};

type ReactionTotals = {
  topReactorId?: string | undefined;
  topReactorCount?: number | undefined;
  topReceiverId?: string | undefined;
  topReceiverCount?: number | undefined;
};

type TopMessageTotals = {
  messageId?: string | undefined;
  channelId?: string | undefined;
  reactionCount?: number | undefined;
};

const reactionBatch: ReactionRecord[] = [];
const totalReactionsByUser = new Map<string, number>();
const totalReactionsByReceiver = new Map<string, number>();
const totalReactionsByMessage = new Map<string, number>();
const messageChannelById = new Map<string, string>();

export function recordReaction(record: ReactionRecord) {
  reactionBatch.push(record);

  totalReactionsByUser.set(
    record.userId,
    (totalReactionsByUser.get(record.userId) ?? 0) + 1,
  );
  totalReactionsByReceiver.set(
    record.messageAuthorId,
    (totalReactionsByReceiver.get(record.messageAuthorId) ?? 0) + 1,
  );
  totalReactionsByMessage.set(
    record.messageId,
    (totalReactionsByMessage.get(record.messageId) ?? 0) + 1,
  );
  messageChannelById.set(record.messageId, record.messageChannelId);
}

export function drainReactionSummary(): ReactionSummary | null {
  if (reactionBatch.length === 0) return null;

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

  let topEmoji: string | undefined;
  let topEmojiCount = 0;

  if (topReactorId) {
    const emojiMap =
      reactionCountsByUserEmoji.get(topReactorId) ?? new Map<string, number>();
    for (const [emojiDisplay, count] of emojiMap) {
      if (count > topEmojiCount) {
        topEmoji = emojiDisplay;
        topEmojiCount = count;
      }
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

  let topMessageId: string | undefined;
  let topMessageCount = 0;
  let topMessageChannelId: string | undefined;

  for (const [messageId, count] of reactionCountsByMessage) {
    if (count > topMessageCount) {
      topMessageId = messageId;
      topMessageCount = count;
      topMessageChannelId = messageInfoById.get(messageId)?.channelId;
    }
  }

  reactionBatch.splice(0, reactionBatch.length);

  return {
    topReactorId,
    topEmoji,
    topEmojiCount: topEmojiCount || undefined,
    topReceiverId,
    topReceiverCount: topReceiverCount || undefined,
    topMessageId,
    topMessageCount: topMessageCount || undefined,
    topMessageChannelId,
  };
}

export function getReactionTotals(): ReactionTotals {
  let topReactorId: string | undefined;
  let topReactorCount = 0;

  for (const [userId, count] of totalReactionsByUser) {
    if (count > topReactorCount) {
      topReactorId = userId;
      topReactorCount = count;
    }
  }

  let topReceiverId: string | undefined;
  let topReceiverCount = 0;

  for (const [userId, count] of totalReactionsByReceiver) {
    if (count > topReceiverCount) {
      topReceiverId = userId;
      topReceiverCount = count;
    }
  }

  return {
    topReactorId,
    topReactorCount: topReactorCount || undefined,
    topReceiverId,
    topReceiverCount: topReceiverCount || undefined,
  };
}

export function getTopReactedMessage(): TopMessageTotals {
  let messageId: string | undefined;
  let reactionCount = 0;

  for (const [id, count] of totalReactionsByMessage) {
    if (count > reactionCount) {
      messageId = id;
      reactionCount = count;
    }
  }

  return {
    messageId,
    channelId: messageId ? messageChannelById.get(messageId) : undefined,
    reactionCount: reactionCount || undefined,
  };
}
