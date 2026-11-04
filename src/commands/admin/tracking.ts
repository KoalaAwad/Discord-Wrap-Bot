import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import { countOptIns } from "../../services/privacy";
import { isPaused, setPaused } from "../../services/settings";
import { listWhitelist } from "../../services/whitelist";

export const data = new SlashCommandBuilder()
  .setName("tracking")
  .setDescription("Pause, resume or check tracking for the whole server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub.setName("pause").setDescription("Stop recording anything new"),
  )
  .addSubcommand((sub) =>
    sub.setName("resume").setDescription("Start recording again"),
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show what the bot is tracking"),
  );

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    const channels = listWhitelist(guildId).length;
    await interaction.reply({
      content: [
        `Tracking is **${isPaused(guildId) ? "paused" : "on"}**.`,
        `Whitelisted channels/categories: ${channels}.`,
        `Members opted in: ${countOptIns(guildId)}.`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pause = subcommand === "pause";
  const changed = isPaused(guildId) !== pause;
  setPaused(guildId, pause);

  await interaction.reply({
    content: !changed
      ? `Tracking was already ${pause ? "paused" : "on"}.`
      : pause
        ? "Tracking paused. Nothing new is recorded; existing stats are kept and `/stats` still works."
        : "Tracking resumed.",
    flags: MessageFlags.Ephemeral,
  });
  // Ends open voice sessions on pause, starts them for people in calls on resume.
  if (changed && interaction.guild) await resyncVoice(interaction.guild);
};
