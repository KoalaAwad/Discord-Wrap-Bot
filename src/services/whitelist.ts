import type { GuildBasedChannel, GuildMember } from "discord.js";
import { db } from "../db";

export type WhitelistKind = "channel" | "user" | "role";

type WhitelistRow = { kind: WhitelistKind; target_id: string };

const addStmt = db.prepare<[string, WhitelistKind, string, string, number]>(
  `INSERT OR IGNORE INTO whitelist (guild_id, kind, target_id, added_by, added_at)
   VALUES (?, ?, ?, ?, ?)`,
);
const removeStmt = db.prepare<[string, WhitelistKind, string]>(
  "DELETE FROM whitelist WHERE guild_id = ? AND kind = ? AND target_id = ?",
);
const listStmt = db.prepare<[string], WhitelistRow>(
  "SELECT kind, target_id FROM whitelist WHERE guild_id = ? ORDER BY kind, added_at",
);
const kindIdsStmt = db.prepare<[string, WhitelistKind], { target_id: string }>(
  "SELECT target_id FROM whitelist WHERE guild_id = ? AND kind = ?",
);

/** Returns false if the entry already existed. */
export function addToWhitelist(
  guildId: string,
  kind: WhitelistKind,
  targetId: string,
  addedBy: string,
) {
  return addStmt.run(guildId, kind, targetId, addedBy, Date.now()).changes > 0;
}

/** Returns false if there was nothing to remove. */
export function removeFromWhitelist(
  guildId: string,
  kind: WhitelistKind,
  targetId: string,
) {
  return removeStmt.run(guildId, kind, targetId).changes > 0;
}

export function listWhitelist(guildId: string) {
  return listStmt.all(guildId);
}

function whitelistedIds(guildId: string, kind: WhitelistKind) {
  return new Set(kindIdsStmt.all(guildId, kind).map((row) => row.target_id));
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
  const allowed = whitelistedIds(guildId, "channel");
  const scope = [channel.id, channel.parentId];
  if (channel.isThread()) scope.push(channel.parent?.parentId ?? null);
  return scope.some((id) => id !== null && allowed.has(id));
}

/** Whitelisting @everyone (role id === guild id) opts in every member. */
export function isMemberWhitelisted(guildId: string, member: GuildMember) {
  if (whitelistedIds(guildId, "user").has(member.id)) return true;
  const roles = whitelistedIds(guildId, "role");
  return member.roles.cache.some((role) => roles.has(role.id));
}
