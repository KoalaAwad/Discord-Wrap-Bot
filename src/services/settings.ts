import { db } from "../db";

const ensureGuildStmt = db.prepare<[string, number]>(
  "INSERT OR IGNORE INTO guild_settings (guild_id, created_at) VALUES (?, ?)",
);
const getSilentStmt = db.prepare<[string], { silent: number }>(
  "SELECT silent FROM guild_settings WHERE guild_id = ?",
);
const setSilentStmt = db.prepare<[number, string]>(
  "UPDATE guild_settings SET silent = ? WHERE guild_id = ?",
);

export function ensureGuild(guildId: string) {
  ensureGuildStmt.run(guildId, Date.now());
}

export function getSilentMode(guildId: string) {
  ensureGuild(guildId);
  return getSilentStmt.get(guildId)?.silent === 1;
}

export function setSilentMode(guildId: string, value: boolean) {
  ensureGuild(guildId);
  setSilentStmt.run(value ? 1 : 0, guildId);
}
