import { Events, type Client } from "discord.js";
import { ensureGuild } from "../services/settings";

let isRegistered = false;

export function registerGuildHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.on(Events.GuildCreate, async (guild) => {
    ensureGuild(guild.id);

    const channel = guild.systemChannel;
    if (!channel?.isSendable()) return;

    await channel
      .send(
        "Thanks for adding me! I don't track anything yet. An admin can use `/whitelist add` to pick the channels and members (or roles) I'm allowed to track.",
      )
      .catch(() => undefined);
  });
}
