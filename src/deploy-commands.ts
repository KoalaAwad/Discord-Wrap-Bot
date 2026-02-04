import fs from "node:fs";
import path from "node:path";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config";

interface CommandModule {
  data: SlashCommandBuilder;
}

function loadCommands(): SlashCommandBuilder[] {
  const commands: SlashCommandBuilder[] = [];
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
      const command = require(filePath) as CommandModule;

      if (command?.data) {
        commands.push(command.data);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" export.`,
        );
      }
    }
  }

  return commands;
}

async function deployCommands() {
  const commands = loadCommands().map((command) => command.toJSON());
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  if (config.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        config.DISCORD_CLIENT_ID,
        config.DISCORD_GUILD_ID,
      ),
      { body: commands },
    );
    console.log(
      `Deployed ${commands.length} guild commands to ${config.DISCORD_GUILD_ID}.`,
    );
    return;
  }

  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
    body: commands,
  });

  console.log(`Deployed ${commands.length} global commands.`);
}

deployCommands().catch((error) => {
  console.error("Failed to deploy commands:", error);
  process.exit(1);
});
