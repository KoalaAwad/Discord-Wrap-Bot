import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { isOptedOut } from "../../services/privacy";
import { getServerStats, getUserStats, type Period } from "../../services/stats";

const periodLabels: Record<Period, string> = {
  week: "the last 7 days",
  month: "the last 30 days",
  year: "this year",
  all: "all time",
};

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show server stats, or one member's stats")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option.setName("user").setDescription("Show this member's stats instead"),
  )
  .addStringOption((option) =>
    option
      .setName("period")
      .setDescription("Time range (default: all time)")
      .addChoices(
        { name: "Last 7 days", value: "week" },
        { name: "Last 30 days", value: "month" },
        { name: "This year", value: "year" },
        { name: "All time", value: "all" },
      ),
  )
  .addBooleanOption((option) =>
    option.setName("public").setDescription("Post the result in the channel"),
  );

type Ranked = { id: string; n: number };

function ranking(rows: Ranked[], format: (id: string) => string) {
  if (rows.length === 0) return "none yet";
  return rows.map((row) => `${format(row.id)} (${row.n})`).join(", ");
}

function duration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

/** Discord renders <t:…> in each viewer's own timezone. */
const timestamp = (ms: number) => `<t:${Math.floor(ms / 1000)}:f>`;

const user = (id: string) => `<@${id}>`;
const channel = (id: string) => `<#${id}>`;
const emoji = (id: string) => id;

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (!interaction.inGuild()) return;
  const guildId = interaction.guildId;
  const period = (interaction.options.getString("period") ?? "all") as Period;
  const target = interaction.options.getUser("user");
  const isPublic = interaction.options.getBoolean("public") ?? false;

  let lines: string[];

  if (target && isOptedOut(guildId, target.id)) {
    lines = [`${user(target.id)} has opted out of tracking in this server.`];
  } else if (target) {
    const stats = getUserStats(guildId, target.id, period);
    lines = [
      `**${user(target.id)} — ${periodLabels[period]}**`,
      `Messages sent: ${stats.sent}`,
      `Reactions given: ${stats.reactionsGiven}`,
      `Reactions received: ${stats.reactionsReceived}`,
      `Favourite emoji: ${stats.favouriteEmoji ? `${stats.favouriteEmoji.id} (${stats.favouriteEmoji.n})` : "none yet"}`,
      `Most active in: ${stats.favouriteChannel ? channel(stats.favouriteChannel.id) : "none yet"}`,
      `Voice time: ${duration(stats.voiceMs)}`,
    ];
  } else {
    const stats = getServerStats(guildId, period);
    const top = stats.topMessage;
    const call = stats.longestCall;
    const peak = stats.peakVoice;
    const voiceTop = stats.topVoice.length
      ? stats.topVoice.map((row) => `${user(row.id)} (${duration(row.ms)})`).join(", ")
      : "none yet";
    lines = [
      `**Server stats — ${periodLabels[period]}**`,
      `Top senders: ${ranking(stats.topSenders, user)}`,
      `Busiest channels: ${ranking(stats.topChannels, channel)}`,
      `Top reactors: ${ranking(stats.topReactors, user)}`,
      `Most reacted to: ${ranking(stats.topReceivers, user)}`,
      `Top emoji: ${ranking(stats.topEmoji, emoji)}`,
      `Most reacted message: ${top ? `https://discord.com/channels/${guildId}/${top.channel_id}/${top.message_id} (${top.n} people)` : "none yet"}`,
      `Most time in voice: ${voiceTop}`,
      `Longest call (2+ people): ${call ? `${channel(call.channelId)}, ${duration(call.end - call.start)}${call.ongoing ? " and still going" : ""}, started ${timestamp(call.start)}` : "none yet"}`,
      `Busiest voice moment: ${peak && peak.count >= 2 ? `${peak.count} people in ${channel(peak.channelId)} on ${timestamp(peak.at)}` : "none yet"}`,
    ];
  }

  await interaction.reply({
    content: lines.join("\n"),
    allowedMentions: { parse: [] },
    ...(isPublic ? {} : { flags: MessageFlags.Ephemeral }),
  });
};
