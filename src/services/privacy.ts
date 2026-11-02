import { db } from "../db";

const isOptedOutStmt = db.prepare<[string, string], { n: number }>(
  "SELECT 1 AS n FROM opt_outs WHERE guild_id = ? AND user_id = ?",
);
const optOutStmt = db.prepare<[string, string, number]>(
  "INSERT OR IGNORE INTO opt_outs (guild_id, user_id, opted_out_at) VALUES (?, ?, ?)",
);
const optInStmt = db.prepare<[string, string]>(
  "DELETE FROM opt_outs WHERE guild_id = ? AND user_id = ?",
);
const countOptOutsStmt = db.prepare<[string], { n: number }>(
  "SELECT COUNT(*) AS n FROM opt_outs WHERE guild_id = ?",
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

// opt_outs is left out on purpose: if the bot is re-added later, members who
// opted out stay opted out.
const guildTables = [
  "guild_settings",
  "whitelist",
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

export function isOptedOut(guildId: string, userId: string) {
  return isOptedOutStmt.get(guildId, userId) !== undefined;
}

export function countOptOuts(guildId: string) {
  return countOptOutsStmt.get(guildId)?.n ?? 0;
}

export function deleteUserData(guildId: string, userId: string) {
  db.transaction(() => {
    for (const stmt of userDeletes) stmt.run(guildId, userId);
  })();
}

/** Returns false if the member had already opted out. */
export function optOut(guildId: string, userId: string) {
  let added = false;
  db.transaction(() => {
    added = optOutStmt.run(guildId, userId, Date.now()).changes > 0;
    for (const stmt of userDeletes) stmt.run(guildId, userId);
  })();
  return added;
}

/** Returns false if the member wasn't opted out. */
export function optIn(guildId: string, userId: string) {
  return optInStmt.run(guildId, userId).changes > 0;
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
