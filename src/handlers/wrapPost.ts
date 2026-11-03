import { Events, MessageFlags, type Client } from "discord.js";
import { markWrapPosted, pendingWrapPosts } from "../services/settings";
import { loadDeck, wrapMessage, type DeckKey } from "../wrap/render";
import { wrapStatus } from "../wrap/window";

const CHECK_MS = 30 * 60 * 1000;

let isRegistered = false;

/** Posts each server's wrap once, as soon as wrap week is open. */
async function postDueWraps(client: Client) {
  const status = wrapStatus();
  if (!status.open) return;

  for (const { guild_id, wrap_channel_id } of pendingWrapPosts(status.year)) {
    const guild = client.guilds.cache.get(guild_id);
    if (!guild?.available) continue;

    try {
      const key: DeckKey = { kind: "server", targetId: guild.id, year: status.year, preview: false };
      // Nothing tracked all year: skip quietly rather than announce an empty wrap.
      if ((await loadDeck(guild, key)).empty) {
        markWrapPosted(guild.id, status.year);
        continue;
      }

      const channel = await guild.channels.fetch(wrap_channel_id);
      if (!channel?.isSendable()) throw new Error("channel missing or not sendable");

      await channel.send({
        ...(await wrapMessage(
          guild,
          key,
          0,
          "public",
          `**The ${status.year} wrap is here!** Use \`/wrap me\` to see your own year.`,
        )),
        flags: MessageFlags.IsComponentsV2,
      });
      markWrapPosted(guild.id, status.year);
      console.log(`Posted the ${status.year} wrap in ${guild.name}.`);
    } catch (error) {
      // Left unmarked so the next check tries again (e.g. after permissions are fixed).
      console.warn(`Couldn't post the wrap in ${guild.name} (${guild.id}):`, error);
    }
  }
}

export function registerWrapPostHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.once(Events.ClientReady, (readyClient) => {
    void postDueWraps(readyClient);
    setInterval(() => void postDueWraps(readyClient), CHECK_MS);
  });
}
