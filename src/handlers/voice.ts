import { Events, type Client, type Guild, type VoiceState } from "discord.js";
import { canTrack } from "../services/tracking";
import {
  closeStaleSessions,
  endVoiceSession,
  getOpenSessions,
  startVoiceSession,
  writeHeartbeat,
} from "../services/voice";

const HEARTBEAT_MS = 60_000;

let isRegistered = false;

async function isTrackable(state: VoiceState) {
  const channel = state.channel;
  if (!channel || channel.id === state.guild.afkChannelId) return false;

  const member =
    state.member ??
    (await state.guild.members.fetch(state.id).catch(() => null));
  return member !== null && canTrack(state.guild.id, channel, member);
}

/**
 * Makes stored sessions match who is in voice right now and whether they may
 * be tracked. Call after anything that changes the rules (whitelist, opt-out,
 * pause) so people already in a call are picked up or dropped immediately.
 * Sessions that are already right are left alone, so calls aren't split.
 */
export async function resyncVoice(guild: Guild, now = Date.now()) {
  const open = getOpenSessions(guild.id);
  const seen = new Set<string>();

  for (const state of guild.voiceStates.cache.values()) {
    if (!state.channelId) continue;
    seen.add(state.id);

    const trackable = await isTrackable(state);
    const current = open.get(state.id);

    if (trackable && current !== state.channelId) {
      startVoiceSession(guild.id, state.channelId, state.id, now);
    } else if (!trackable && current !== undefined) {
      endVoiceSession(guild.id, state.id, now);
    }
  }

  // Open sessions for people who are no longer in any voice channel.
  for (const userId of open.keys()) {
    if (!seen.has(userId)) endVoiceSession(guild.id, userId, now);
  }
}

export function registerVoiceHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.once(Events.ClientReady, async (readyClient) => {
    closeStaleSessions();

    // Anyone already in a call when the bot starts gets a session from now.
    for (const guild of readyClient.guilds.cache.values()) {
      if (guild.available) await resyncVoice(guild);
    }

    writeHeartbeat();
    setInterval(() => writeHeartbeat(), HEARTBEAT_MS);
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Mute, deafen, stream and camera changes keep the same channel.
    if (oldState.channelId === newState.channelId) return;

    const now = Date.now();
    if (await isTrackable(newState)) {
      startVoiceSession(newState.guild.id, newState.channelId!, newState.id, now);
    } else {
      endVoiceSession(newState.guild.id, newState.id, now);
    }
  });
}
