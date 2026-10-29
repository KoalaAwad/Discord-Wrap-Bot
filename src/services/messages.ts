import { db } from "../db";

type MessageRecord = {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  createdAt: number;
};

const insertStmt = db.prepare<[string, string, string, string, number]>(
  `INSERT OR IGNORE INTO messages (message_id, guild_id, channel_id, author_id, created_at)
   VALUES (?, ?, ?, ?, ?)`,
);

export function recordMessage(record: MessageRecord) {
  insertStmt.run(
    record.messageId,
    record.guildId,
    record.channelId,
    record.authorId,
    record.createdAt,
  );
}
