import { Events, type Client, type VoiceState } from "discord.js";
import {
  closeStaleSessions,
  endVoiceSession,
  startVoiceSession,
  writeHeartbeat,
} from "../services/voice";
import {
  isChannelWhitelisted,
  isMemberWhitelisted,
} from "../services/whitelist";

const HEARTBEAT_MS = 60_000;

let isRegistered = false;

async function isTrackable(state: VoiceState) {
  const channel = state.channel;
  if (!channel || channel.id === state.guild.afkChannelId) return false;
  if (!isChannelWhitelisted(state.guild.id, channel)) return false;

  const member =
    state.member ??
    (await state.guild.members.fetch(state.id).catch(() => null));
  if (!member || member.user.bot) return false;
  return isMemberWhitelisted(state.guild.id, member);
}

export function registerVoiceHandler(client: Client) {
  if (isRegistered) return;
  isRegistered = true;

  client.once(Events.ClientReady, async (readyClient) => {
    closeStaleSessions();

    // Anyone already in a call when the bot starts gets a session from now.
    const now = Date.now();
    for (const guild of readyClient.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        if (await isTrackable(state)) {
          startVoiceSession(guild.id, state.channelId!, state.id, now);
        }
      }
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
