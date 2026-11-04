import { db } from "../db";

const isOptedInStmt = db.prepare<[string, string], { n: number }>(
  "SELECT 1 AS n FROM opt_ins WHERE guild_id = ? AND user_id = ?",
);
const optInStmt = db.prepare<[string, string, number]>(
  "INSERT OR IGNORE INTO opt_ins (guild_id, user_id, opted_in_at) VALUES (?, ?, ?)",
);
const optOutStmt = db.prepare<[string, string]>(
  "DELETE FROM opt_ins WHERE guild_id = ? AND user_id = ?",
);
const countOptInsStmt = db.prepare<[string], { n: number }>(
  "SELECT COUNT(*) AS n FROM opt_ins WHERE guild_id = ?",
);

const userDeletes = [
  db.prepare<[string, string]>(
    "DELETE FROM messages WHERE guild_id = ? AND author_id = ?",
  ),
  db.prepare<[string, string]>(
    "DELETE FROM reactions WHERE guild_id = ? AND user_id = ?",
  ),
  // Reactions others left on this member's messages still count for the
  // people who reacted, but no longer credit the member as the receiver.
  db.prepare<[string, string]>(
    "UPDATE reactions SET message_author_id = NULL WHERE guild_id = ? AND message_author_id = ?",
  ),
  db.prepare<[string, string]>(
    "DELETE FROM voice_sessions WHERE guild_id = ? AND user_id = ?",
  ),
];

const channelDeletes = [
  db.prepare<[string, string]>(
    "DELETE FROM messages WHERE guild_id = ? AND channel_id = ?",
  ),
  db.prepare<[string, string]>(
    "DELETE FROM reactions WHERE guild_id = ? AND channel_id = ?",
  ),
  db.prepare<[string, string]>(
    "DELETE FROM voice_sessions WHERE guild_id = ? AND channel_id = ?",
  ),
];

// Opt-ins go too: if the bot is re-added later, members choose again.
const guildTables = [
  "guild_settings",
  "whitelist",
  "opt_ins",
  "messages",
  "reactions",
  "voice_sessions",
];
const guildDeletes = guildTables.map((table) =>
  db.prepare<[string]>(`DELETE FROM ${table} WHERE guild_id = ?`),
);
const knownGuildsStmt = db.prepare<[], { guild_id: string }>(
  guildTables.map((table) => `SELECT guild_id FROM ${table}`).join(" UNION "),
);

/** Members are only ever tracked after they opt in themselves. */
export function isOptedIn(guildId: string, userId: string) {
  return isOptedInStmt.get(guildId, userId) !== undefined;
}

export function countOptIns(guildId: string) {
  return countOptInsStmt.get(guildId)?.n ?? 0;
}

export function deleteUserData(guildId: string, userId: string) {
  db.transaction(() => {
    for (const stmt of userDeletes) stmt.run(guildId, userId);
  })();
}

/** Returns false if the member was already opted in. */
export function optIn(guildId: string, userId: string) {
  return optInStmt.run(guildId, userId, Date.now()).changes > 0;
}

/** Stops tracking and deletes the member's data. Returns false if they weren't opted in. */
export function optOut(guildId: string, userId: string) {
  let removed = false;
  db.transaction(() => {
    removed = optOutStmt.run(guildId, userId).changes > 0;
    for (const stmt of userDeletes) stmt.run(guildId, userId);
  })();
  return removed;
}

/** Covers the channel's own messages, reactions and voice sessions only. */
export function deleteChannelData(guildId: string, channelId: string) {
  db.transaction(() => {
    for (const stmt of channelDeletes) stmt.run(guildId, channelId);
  })();
}

export function deleteGuildData(guildId: string) {
  db.transaction(() => {
    for (const stmt of guildDeletes) stmt.run(guildId);
  })();
}

export function knownGuildIds() {
  return knownGuildsStmt.all().map((row) => row.guild_id);
}
