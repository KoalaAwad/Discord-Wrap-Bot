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
