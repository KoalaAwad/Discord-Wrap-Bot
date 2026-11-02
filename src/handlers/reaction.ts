import { Events, type Client } from "discord.js";
import {
  recordReaction,
  removeAllReactions,
  removeEmojiReactions,
  removeReaction,
} from "../services/reactions";
import { canTrack, canTrackMember } from "../services/tracking";
import { isChannelWhitelisted } from "../services/whitelist";

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
    if (!reactor || !canTrack(message.guildId, message.channel, reactor)) {
      return;
    }

    // Only credit the author as a receiver if they can be tracked too.
    const author = message.author.bot
      ? null
      : await members.fetch(message.author.id).catch(() => null);
    const authorAllowed =
      author !== null && canTrackMember(message.guildId, author);

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

  // Removals need no fetching or whitelist check: deleting a row that was
  // never stored is a no-op.
  client.on(Events.MessageReactionRemove, (reaction, user) => {
    removeReaction(reaction.message.id, user.id, reaction.emoji.toString());
  });

  client.on(Events.MessageReactionRemoveEmoji, (reaction) => {
    removeEmojiReactions(reaction.message.id, reaction.emoji.toString());
  });

  client.on(Events.MessageReactionRemoveAll, (message) => {
    removeAllReactions(message.id);
  });
}
