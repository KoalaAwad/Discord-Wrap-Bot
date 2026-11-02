import { Events, type Client } from "discord.js";
import { deleteMessages, recordMessage } from "../services/messages";
import { canTrack } from "../services/tracking";
import { isChannelWhitelisted } from "../services/whitelist";

let isRegistered = false;

export function registerMessageHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.inGuild()) return;
    // Cheap check first so untracked channels never trigger a member fetch.
    if (!isChannelWhitelisted(message.guildId, message.channel)) return;

    const member =
      message.member ??
      (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member || !canTrack(message.guildId, message.channel, member)) return;

    recordMessage({
      messageId: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author.id,
      createdAt: message.createdTimestamp,
    });
  });

  client.on(Events.MessageDelete, (message) => {
    deleteMessages([message.id]);
  });

  client.on(Events.MessageBulkDelete, (messages) => {
    deleteMessages([...messages.keys()]);
  });
}
