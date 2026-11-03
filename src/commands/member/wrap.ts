import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type SlashCommandBooleanOption,
} from "discord.js";
import { isOptedIn } from "../../services/privacy";
import { loadDeck, parseButtonId, wrapMessage, type DeckKey } from "../../wrap/render";
import { wrapStatus } from "../../wrap/window";

const previewOption = (option: SlashCommandBooleanOption) =>
  option
    .setName("preview")
    .setDescription("Admins: preview this year so far, before wrap week");

export const data = new SlashCommandBuilder()
  .setName("wrap")
  .setDescription("Your server's year, wrapped")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub.setName("server").setDescription("The whole server's year").addBooleanOption(previewOption),
  )
  .addSubcommand((sub) =>
    sub.setName("me").setDescription("Your own year").addBooleanOption(previewOption),
  )
  .addSubcommand((sub) =>
    sub
      .setName("member")
      .setDescription("Someone else's year")
      .addUserOption((option) => option.setName("user").setDescription("The member").setRequired(true))
      .addBooleanOption(previewOption),
  );

function canPreview(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

/** A line telling people when the next wrap week starts. */
function countdown() {
  const opens = Math.floor(wrapStatus().nextOpens / 1000);
  return `-# The next wrap opens <t:${opens}:R>, on <t:${opens}:D>.`;
}

/** Whether a deck key from a button may be shown to this viewer right now. */
function isAllowed(interaction: ButtonInteraction, key: DeckKey) {
  if (key.preview) {
    return canPreview(interaction) && key.year === new Date().getFullYear();
  }
  return key.year === wrapStatus().year;
}

/** Personal wraps exist only for members who opted in themselves. */
function notOptedInReply(guild: Guild, key: DeckKey, viewerId: string) {
  if (key.kind !== "user" || isOptedIn(guild.id, key.targetId)) return null;
  return key.targetId === viewerId
    ? "You haven't opted in here, so there's nothing to wrap. Use `/optin` to be included from now on."
    : `<@${key.targetId}> hasn't opted in to tracking in this server.`;
}

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inCachedGuild()) return;
  const guild = interaction.guild;
  const sub = interaction.options.getSubcommand();
  const wantsPreview = interaction.options.getBoolean("preview") ?? false;

  if (wantsPreview && !canPreview(interaction)) {
    await interaction.reply({
      content: "Only admins (Manage Server) can preview the wrap before wrap week.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const status = wrapStatus();
  const key: DeckKey = {
    kind: sub === "server" ? "server" : "user",
    targetId:
      sub === "server"
        ? guild.id
        : sub === "me"
          ? interaction.user.id
          : interaction.options.getUser("user", true).id,
    year: wantsPreview ? new Date().getFullYear() : status.year,
    preview: wantsPreview,
  };

  const notOptedIn = notOptedInReply(guild, key, interaction.user.id);
  if (notOptedIn) {
    await interaction.reply({ content: notOptedIn, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  // Rendering can take longer than Discord's 3 second reply limit.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // A new command always rebuilds the deck; wrapMessage below reuses it.
  const deck = await loadDeck(guild, key, true);

  // Outside wrap week with nothing from last year, there's only a countdown.
  if (!status.open && !wantsPreview && deck.empty) {
    await interaction.editReply({
      content: `There's no ${key.year} wrap for this server. ${countdown().slice(3)}`,
    });
    return;
  }

  const note = wantsPreview
    ? "-# Preview of the year so far. Only you can see this."
    : status.open
      ? undefined
      : countdown();
  await interaction.editReply({
    ...(await wrapMessage(guild, key, 0, "private", note)),
    flags: MessageFlags.IsComponentsV2,
  });
};

export const handleButton = async (
  interaction: ButtonInteraction,
): Promise<void> => {
  if (!interaction.inCachedGuild()) return;
  const guild = interaction.guild;
  const { action, key, page } = parseButtonId(interaction.customId);

  if (!isAllowed(interaction, key)) {
    await interaction.reply({
      content: "That wrap isn't available any more. Run `/wrap` again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const notOptedIn = notOptedInReply(guild, key, interaction.user.id);
  if (notOptedIn) {
    await interaction.reply({ content: notOptedIn, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  if (action === "nav") {
    await interaction.deferUpdate();
    // attachments: [] drops the previous slide's image before adding the new one.
    await interaction.editReply({ ...(await wrapMessage(guild, key, page, "private")), attachments: [] });
    return;
  }

  if (action === "share") {
    await interaction.deferReply();
    await interaction.editReply({
      ...(await wrapMessage(guild, key, page, "public")),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply({
    ...(await wrapMessage(guild, key, 0, "private")),
    flags: MessageFlags.IsComponentsV2,
  });
};
