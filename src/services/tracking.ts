import type { GuildBasedChannel, GuildMember } from "discord.js";
import { isOptedOut } from "./privacy";
import { isPaused } from "./settings";
import { isChannelWhitelisted, isMemberWhitelisted } from "./whitelist";

/** Whether this member's activity may be stored at all, in any channel. */
export function canTrackMember(guildId: string, member: GuildMember) {
  if (member.user.bot) return false;
  if (isPaused(guildId)) return false;
  if (isOptedOut(guildId, member.id)) return false;
  return isMemberWhitelisted(guildId, member);
}

/** The one check every handler goes through before storing anything. */
export function canTrack(
  guildId: string,
  channel: GuildBasedChannel,
  member: GuildMember,
) {
  return (
    isChannelWhitelisted(guildId, channel) && canTrackMember(guildId, member)
  );
}
