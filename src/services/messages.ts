import { db } from "../db";
import { removeAllReactions } from "./reactions";

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

const deleteStmt = db.prepare<[string]>(
  "DELETE FROM messages WHERE message_id = ?",
);

/** Deleted messages disappear from stats, along with their reactions. */
export function deleteMessages(messageIds: string[]) {
  db.transaction(() => {
    for (const id of messageIds) {
      deleteStmt.run(id);
      removeAllReactions(id);
    }
  })();
}

export function recordMessage(record: MessageRecord) {
  insertStmt.run(
    record.messageId,
    record.guildId,
    record.channelId,
    record.authorId,
    record.createdAt,
  );
}
