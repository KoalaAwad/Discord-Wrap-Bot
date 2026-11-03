import type { Guild } from "discord.js";

export type Person = { name: string; avatarUrl: string };

/**
 * Looks up display names and avatars for the people a wrap mentions. Members
 * who have left fall back to their account name, then to "a former member".
 */
export async function lookupPeople(guild: Guild, ids: Iterable<string>) {
  const unique = [...new Set(ids)];
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, Person]> => {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        return [id, {
          name: member.displayName,
          avatarUrl: member.displayAvatarURL({ extension: "png", size: 256 }),
        }];
      }
      const user = await guild.client.users.fetch(id).catch(() => null);
      return [id, {
        name: user?.displayName ?? "a former member",
        avatarUrl:
          user?.displayAvatarURL({ extension: "png", size: 256 }) ??
          "https://cdn.discordapp.com/embed/avatars/0.png",
      }];
    }),
  );
  return new Map(entries);
}

export function channelName(guild: Guild, id: string | undefined) {
  if (!id) return "a channel";
  const channel = guild.channels.cache.get(id);
  return channel ? `#${channel.name}` : "#deleted-channel";
}
