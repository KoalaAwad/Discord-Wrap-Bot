import { Events, type Client } from "discord.js";
import { recordReaction } from "../services/reactions";
import {
  isChannelWhitelisted,
  isMemberWhitelisted,
} from "../services/whitelist";

let isRegistered = false;

export function registerReactionHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch {
      return;
    }

    const message = reaction.message;
    if (!message.inGuild()) return;
    if (!isChannelWhitelisted(message.guildId, message.channel)) return;

    const members = message.guild.members;
    const reactor = await members.fetch(user.id).catch(() => null);
    if (!reactor || !isMemberWhitelisted(message.guildId, reactor)) return;

    // Only credit the author as a receiver if they're whitelisted too.
    const author = message.author.bot
      ? null
      : await members.fetch(message.author.id).catch(() => null);
    const authorAllowed =
      author !== null && isMemberWhitelisted(message.guildId, author);

    recordReaction({
      messageId: message.id,
      userId: user.id,
      emoji: reaction.emoji.toString(),
      guildId: message.guildId,
      channelId: message.channelId,
      messageAuthorId: authorAllowed ? message.author.id : null,
      createdAt: Date.now(),
    });
  });
}
