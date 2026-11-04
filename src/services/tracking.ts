import type { GuildBasedChannel, GuildMember } from "discord.js";
import { isOptedIn } from "./privacy";
import { isPaused } from "./settings";
import { isChannelWhitelisted } from "./whitelist";

/** Whether this member's activity may be stored at all, in any channel. */
export function canTrackMember(guildId: string, member: GuildMember) {
  if (member.user.bot) return false;
  if (isPaused(guildId)) return false;
  return isOptedIn(guildId, member.id);
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
