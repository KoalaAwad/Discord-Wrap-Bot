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

const getPausedStmt = db.prepare<[string], { paused: number }>(
  "SELECT paused FROM guild_settings WHERE guild_id = ?",
);
const setPausedStmt = db.prepare<[number, string]>(
  "UPDATE guild_settings SET paused = ? WHERE guild_id = ?",
);

export function isPaused(guildId: string) {
  return getPausedStmt.get(guildId)?.paused === 1;
}

export function setPaused(guildId: string, value: boolean) {
  ensureGuild(guildId);
  setPausedStmt.run(value ? 1 : 0, guildId);
}

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
