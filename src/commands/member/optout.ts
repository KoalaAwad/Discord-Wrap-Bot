import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { resyncVoice } from "../../handlers/voice";
import { isOptedIn, optOut } from "../../services/privacy";
import { confirm } from "../../util/confirm";

export const data = new SlashCommandBuilder()
  .setName("optout")
  .setDescription("Stop the bot tracking you here and delete your data")
  .setContexts(InteractionContextType.Guild);

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;

  if (!isOptedIn(guildId, interaction.user.id)) {
    await interaction.reply({
      content: "You're not opted in, so nothing about you is tracked here. Use `/optin` if you want to join.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const press = await confirm(
    interaction,
    [
      "**Opt out of tracking in this server?**",
      "- Your messages, reactions and voice time are deleted now.",
      "- Nothing about you is tracked from now on.",
      "- Reactions others gave your messages stay theirs but no longer count for you.",
      "",
      "You can `/optin` later, but deleted history can't be restored.",
    ].join("\n"),
    "Opt out and delete my data",
  );
  if (!press) return;

  optOut(guildId, interaction.user.id);
  await press.update({
    content: "Done. You're no longer tracked and your data in this server is deleted.",
    components: [],
  });
  if (interaction.guild) await resyncVoice(interaction.guild);
};
