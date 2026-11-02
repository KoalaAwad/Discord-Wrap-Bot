import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

const TIMEOUT_MS = 60_000;

/**
 * Asks the command's user to confirm with buttons, privately.
 * Resolves with the button press to `update()` when confirmed, or null when
 * cancelled or timed out (the prompt is already updated in those cases).
 */
export async function confirm(
  interaction: ChatInputCommandInteraction,
  prompt: string,
  confirmLabel: string,
): Promise<ButtonInteraction | null> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm")
      .setLabel(confirmLabel)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  const response = await interaction.reply({
    content: prompt,
    components: [row],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
    withResponse: true,
  });

  const press = await response.resource?.message
    ?.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (button) => button.user.id === interaction.user.id,
      time: TIMEOUT_MS,
    })
    .catch(() => null);

  if (!press) {
    await interaction.editReply({ content: "Timed out, nothing changed.", components: [] });
    return null;
  }
  if (press.customId !== "confirm") {
    await press.update({ content: "Cancelled, nothing changed.", components: [] });
    return null;
  }
  return press;
}
