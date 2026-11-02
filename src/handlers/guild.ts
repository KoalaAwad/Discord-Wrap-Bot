import { Events, type Client } from "discord.js";
import { deleteGuildData, knownGuildIds } from "../services/privacy";
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

  client.on(Events.GuildDelete, (guild) => {
    // Discord also sends this during outages; only a real removal wipes data.
    if (!guild.available) return;
    deleteGuildData(guild.id);
    console.log(`Removed from ${guild.name} (${guild.id}); deleted its data.`);
  });

  // Catch removals that happened while the bot was offline. Unavailable
  // guilds are still in the cache, so an outage never triggers this.
  client.once(Events.ClientReady, (readyClient) => {
    for (const guildId of knownGuildIds()) {
      if (readyClient.guilds.cache.has(guildId)) continue;
      deleteGuildData(guildId);
      console.log(`No longer in server ${guildId}; deleted its data.`);
    }
  });
}
