import { db } from "../db";

type ReactionRecord = {
  messageId: string;
  userId: string;
  emoji: string;
  guildId: string;
  channelId: string;
  /** null when the message author isn't whitelisted. */
  messageAuthorId: string | null;
  createdAt: number;
};

const insertStmt = db.prepare<
  [string, string, string, string, string, string | null, number]
>(
  `INSERT OR IGNORE INTO reactions
     (message_id, user_id, emoji, guild_id, channel_id, message_author_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const removeStmt = db.prepare<[string, string, string]>(
  "DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
);
const removeEmojiStmt = db.prepare<[string, string]>(
  "DELETE FROM reactions WHERE message_id = ? AND emoji = ?",
);
const removeAllStmt = db.prepare<[string]>(
  "DELETE FROM reactions WHERE message_id = ?",
);

export function removeReaction(messageId: string, userId: string, emoji: string) {
  removeStmt.run(messageId, userId, emoji);
}

/** A moderator cleared one emoji from a message. */
export function removeEmojiReactions(messageId: string, emoji: string) {
  removeEmojiStmt.run(messageId, emoji);
}

/** A moderator cleared every reaction, or the message was deleted. */
export function removeAllReactions(messageId: string) {
  removeAllStmt.run(messageId);
}

export function recordReaction(record: ReactionRecord) {
  insertStmt.run(
    record.messageId,
    record.userId,
    record.emoji,
    record.guildId,
    record.channelId,
    record.messageAuthorId,
    record.createdAt,
  );
}
