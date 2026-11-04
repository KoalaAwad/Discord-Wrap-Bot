import type { GuildBasedChannel } from "discord.js";
import { db } from "../db";

// Admins only whitelist channels. Members opt themselves in (see privacy.ts),
// so nobody is tracked without their own say-so.

const addStmt = db.prepare<[string, string, string, number]>(
  `INSERT OR IGNORE INTO whitelist (guild_id, kind, target_id, added_by, added_at)
   VALUES (?, 'channel', ?, ?, ?)`,
);
const removeStmt = db.prepare<[string, string]>(
  "DELETE FROM whitelist WHERE guild_id = ? AND kind = 'channel' AND target_id = ?",
);
const listStmt = db.prepare<[string], { target_id: string }>(
  "SELECT target_id FROM whitelist WHERE guild_id = ? AND kind = 'channel' ORDER BY added_at",
);

/** Returns false if the channel was already whitelisted. */
export function addToWhitelist(guildId: string, channelId: string, addedBy: string) {
  return addStmt.run(guildId, channelId, addedBy, Date.now()).changes > 0;
}

/** Returns false if there was nothing to remove. */
export function removeFromWhitelist(guildId: string, channelId: string) {
  return removeStmt.run(guildId, channelId).changes > 0;
}

export function listWhitelist(guildId: string) {
  return listStmt.all(guildId).map((row) => row.target_id);
}

/**
 * A channel counts as whitelisted if it, its category, or (for threads) its
 * parent channel or the parent's category is whitelisted. A voice channel's
 * text chat has the voice channel's id, so whitelisting the VC covers both.
 */
export function isChannelWhitelisted(
  guildId: string,
  channel: GuildBasedChannel,
) {
  const allowed = new Set(listWhitelist(guildId));
  const scope = [channel.id, channel.parentId];
  if (channel.isThread()) scope.push(channel.parent?.parentId ?? null);
  return scope.some((id) => id !== null && allowed.has(id));
}
