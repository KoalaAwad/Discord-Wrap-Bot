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

const getWrapChannelStmt = db.prepare<[string], { wrap_channel_id: string | null }>(
  "SELECT wrap_channel_id FROM guild_settings WHERE guild_id = ?",
);
const setWrapChannelStmt = db.prepare<[string | null, string]>(
  "UPDATE guild_settings SET wrap_channel_id = ? WHERE guild_id = ?",
);
const pendingWrapPostsStmt = db.prepare<
  [number],
  { guild_id: string; wrap_channel_id: string }
>(
  `SELECT guild_id, wrap_channel_id FROM guild_settings
   WHERE wrap_channel_id IS NOT NULL AND silent = 0
     AND (wrap_posted_year IS NULL OR wrap_posted_year < ?)`,
);
const markWrapPostedStmt = db.prepare<[number, string]>(
  "UPDATE guild_settings SET wrap_posted_year = ? WHERE guild_id = ?",
);

export function getWrapChannel(guildId: string) {
  return getWrapChannelStmt.get(guildId)?.wrap_channel_id ?? null;
}

export function setWrapChannel(guildId: string, channelId: string | null) {
  ensureGuild(guildId);
  setWrapChannelStmt.run(channelId, guildId);
}

/** Servers with an auto-post channel that haven't had `year`'s wrap posted. */
export function pendingWrapPosts(year: number) {
  return pendingWrapPostsStmt.all(year);
}

export function markWrapPosted(guildId: string, year: number) {
  markWrapPostedStmt.run(year, guildId);
}

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
