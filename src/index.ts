import fs from "node:fs";
import path from "node:path";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags,
  Partials,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "./config";
import { registerGuildHandler } from "./handlers/guild";
import { registerMessageHandler } from "./handlers/message";
import { registerReactionHandler } from "./handlers/reaction";
import { registerVoiceHandler } from "./handlers/voice";
import { registerWrapPostHandler } from "./handlers/wrapPost";

interface Command {
  data: Pick<SlashCommandBuilder, "name" | "toJSON">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Handles buttons whose customId starts with "<command name>:". */
  handleButton?: (interaction: ButtonInteraction) => Promise<void>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const commands = new Collection<string, Command>();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.existsSync(foldersPath)
  ? fs.readdirSync(foldersPath)
  : [];

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(
      (file) =>
        (file.endsWith(".js") || file.endsWith(".ts")) &&
        !file.endsWith(".d.ts"),
    );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath) as Command;

    if (command && "data" in command && "execute" in command) {
      commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" export.`,
      );
    }
  }
}

async function routeButton(interaction: ButtonInteraction) {
  // Buttons without a matching handler (e.g. confirm prompts) are collected
  // by whoever sent them, so they're left alone here.
  const [name] = interaction.customId.split(":");
  const command = name ? commands.get(name) : undefined;
  if (!command?.handleButton) return;

  try {
    await command.handleButton(interaction);
  } catch (error) {
    console.error(`Error handling button ${interaction.customId}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "That button didn't work, try running the command again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isButton()) {
    await routeButton(interaction);
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "Command not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const reply = {
      content: "There was an error while executing this command.",
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

registerGuildHandler(client);
registerMessageHandler(client);
registerReactionHandler(client);
registerVoiceHandler(client);
registerWrapPostHandler(client);

void client.login(config.DISCORD_TOKEN);
