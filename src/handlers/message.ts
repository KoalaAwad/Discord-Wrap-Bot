import { Events, type Client } from "discord.js";
import { handleBatchMessage } from "../services/batch";

let isRegistered = false;

export function registerMessageHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.on(Events.MessageCreate, async (message) => {
    await handleBatchMessage(message);
  });
}
