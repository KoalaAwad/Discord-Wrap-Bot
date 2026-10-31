import { db } from "../db";

const closeStmt = db.prepare<[number, string, string]>(
  `UPDATE voice_sessions SET left_at = MAX(joined_at, ?)
   WHERE guild_id = ? AND user_id = ? AND left_at IS NULL`,
);
const openStmt = db.prepare<[string, string, string, number]>(
  `INSERT INTO voice_sessions (guild_id, channel_id, user_id, joined_at)
   VALUES (?, ?, ?, ?)`,
);
const closeAllStmt = db.prepare<[number]>(
  "UPDATE voice_sessions SET left_at = MAX(joined_at, ?) WHERE left_at IS NULL",
);
const getHeartbeatStmt = db.prepare<[], { value: string }>(
  "SELECT value FROM bot_meta WHERE key = 'heartbeat'",
);
const setHeartbeatStmt = db.prepare<[string]>(
  `INSERT INTO bot_meta (key, value) VALUES ('heartbeat', ?)
   ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
);

export function endVoiceSession(guildId: string, userId: string, at: number) {
  closeStmt.run(at, guildId, userId);
}

/** Closes any session the member still has open first, so moves are clean. */
export function startVoiceSession(
  guildId: string,
  channelId: string,
  userId: string,
  at: number,
) {
  db.transaction(() => {
    closeStmt.run(at, guildId, userId);
    openStmt.run(guildId, channelId, userId, at);
  })();
}

/** Written every minute so a crash loses at most a minute of voice time. */
export function writeHeartbeat(at = Date.now()) {
  setHeartbeatStmt.run(String(at));
}

/**
 * Sessions still open at startup were cut off by a crash or restart.
 * End them at the last heartbeat, since that's when the bot last saw them.
 */
export function closeStaleSessions(now = Date.now()) {
  const heartbeat = Number(getHeartbeatStmt.get()?.value ?? now);
  closeAllStmt.run(Math.min(heartbeat, now));
}
