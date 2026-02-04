import { Events, type Client } from "discord.js";
import { recordReaction } from "../services/reactions";

let isRegistered = false;

export function registerReactionHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }
    if (!reaction.message.guild) return;
    if (!reaction.message.author) return;

    recordReaction({
      userId: user.id,
      emojiDisplay: reaction.emoji.toString(),
      messageAuthorId: reaction.message.author.id,
      messageId: reaction.message.id,
      messageChannelId: reaction.message.channelId,
    });
  });
}
