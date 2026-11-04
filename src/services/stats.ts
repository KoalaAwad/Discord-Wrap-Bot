import { db } from "../db";

export type Period = "week" | "month" | "year" | "all";

type Ranked = { id: string; n: number };
type TopMessage = { message_id: string; channel_id: string; n: number };
type Range = [guildId: string, since: number];
type UserRange = [guildId: string, since: number, userId: string];

export function periodStart(period: Period, now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case "week":
      return now.getTime() - 7 * day;
    case "month":
      return now.getTime() - 30 * day;
    case "year":
      return new Date(now.getFullYear(), 0, 1).getTime();
    case "all":
      return 0;
  }
}

const topSendersStmt = db.prepare<[...Range, number], Ranked>(
  `SELECT author_id AS id, COUNT(*) AS n FROM messages
   WHERE guild_id = ? AND created_at >= ?
   GROUP BY author_id ORDER BY n DESC LIMIT ?`,
);
const topChannelsStmt = db.prepare<[...Range, number], Ranked>(
  `SELECT channel_id AS id, COUNT(*) AS n FROM messages
   WHERE guild_id = ? AND created_at >= ?
   GROUP BY channel_id ORDER BY n DESC LIMIT ?`,
);
const topReactorsStmt = db.prepare<[...Range, number], Ranked>(
  `SELECT user_id AS id, COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ?
   GROUP BY user_id ORDER BY n DESC LIMIT ?`,
);
const topReceiversStmt = db.prepare<[...Range, number], Ranked>(
  `SELECT message_author_id AS id, COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ? AND message_author_id IS NOT NULL
   GROUP BY message_author_id ORDER BY n DESC LIMIT ?`,
);
const topEmojiStmt = db.prepare<[...Range, number], Ranked>(
  `SELECT emoji AS id, COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ?
   GROUP BY emoji ORDER BY n DESC LIMIT ?`,
);
// "Most reacted" counts distinct people, so one person spamming emoji doesn't win.
// Messages by authors who aren't tracked (never opted in, or opted out) are
// skipped so the link never points at them.
const topMessageStmt = db.prepare<Range, TopMessage>(
  `SELECT message_id, channel_id, COUNT(DISTINCT user_id) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ? AND message_author_id IS NOT NULL
   GROUP BY message_id ORDER BY n DESC, COUNT(*) DESC LIMIT 1`,
);

const userSentStmt = db.prepare<UserRange, { n: number }>(
  `SELECT COUNT(*) AS n FROM messages
   WHERE guild_id = ? AND created_at >= ? AND author_id = ?`,
);
const userGivenStmt = db.prepare<UserRange, { n: number }>(
  `SELECT COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ? AND user_id = ?`,
);
const userReceivedStmt = db.prepare<UserRange, { n: number }>(
  `SELECT COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ? AND message_author_id = ?`,
);
const userEmojiStmt = db.prepare<UserRange, Ranked>(
  `SELECT emoji AS id, COUNT(*) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ? AND user_id = ?
   GROUP BY emoji ORDER BY n DESC LIMIT 1`,
);
const userChannelStmt = db.prepare<UserRange, Ranked>(
  `SELECT channel_id AS id, COUNT(*) AS n FROM messages
   WHERE guild_id = ? AND created_at >= ? AND author_id = ?
   GROUP BY channel_id ORDER BY n DESC LIMIT 1`,
);

type SessionRow = {
  channel_id: string;
  user_id: string;
  joined_at: number;
  left_at: number | null;
};

// Sessions that overlap the period; open ones are still in progress.
const sessionsStmt = db.prepare<Range, SessionRow>(
  `SELECT channel_id, user_id, joined_at, left_at FROM voice_sessions
   WHERE guild_id = ? AND (left_at IS NULL OR left_at >= ?)`,
);

export type Call = {
  channelId: string;
  start: number;
  end: number;
  ongoing: boolean;
};
export type Peak = { channelId: string; count: number; at: number };

/**
 * Works out voice highlights from raw sessions, clipped to [since, now].
 * A "call" is a stretch where a channel has 2 or more people in it.
 */
export function summarizeVoice(sessions: SessionRow[], since: number, now: number) {
  const timeByUser = new Map<string, number>();
  const edgesByChannel = new Map<string, { at: number; delta: 1 | -1 }[]>();

  for (const session of sessions) {
    const start = Math.max(session.joined_at, since);
    const end = Math.min(session.left_at ?? now, now);
    if (end <= start) continue;

    timeByUser.set(
      session.user_id,
      (timeByUser.get(session.user_id) ?? 0) + (end - start),
    );

    const edges = edgesByChannel.get(session.channel_id) ?? [];
    edges.push({ at: start, delta: 1 }, { at: end, delta: -1 });
    edgesByChannel.set(session.channel_id, edges);
  }

  let longestCall: Call | undefined;
  let peak: Peak | undefined;

  for (const [channelId, edges] of edgesByChannel) {
    // Leaves sort before joins at the same instant, so a hand-off between
    // two people doesn't count as both being there at once.
    edges.sort((a, b) => a.at - b.at || a.delta - b.delta);

    let count = 0;
    let callStart: number | undefined;

    for (const edge of edges) {
      count += edge.delta;

      if (!peak || count > peak.count) {
        peak = { channelId, count, at: edge.at };
      }

      if (count >= 2 && callStart === undefined) {
        callStart = edge.at;
      } else if (count < 2 && callStart !== undefined) {
        const call = { channelId, start: callStart, end: edge.at, ongoing: false };
        if (!longestCall || call.end - call.start > longestCall.end - longestCall.start) {
          longestCall = call;
        }
        callStart = undefined;
      }
    }
  }

  // Open sessions end at `now`, which marks a call that is still going.
  if (longestCall && longestCall.end === now) longestCall.ongoing = true;

  const topVoice = [...timeByUser]
    .map(([id, ms]) => ({ id, ms }))
    .sort((a, b) => b.ms - a.ms);

  return { topVoice, longestCall, peak };
}

export function getVoiceStats(guildId: string, period: Period, now = Date.now()) {
  const since = periodStart(period, new Date(now));
  return summarizeVoice(sessionsStmt.all(guildId, since), since, now);
}

export function getServerStats(guildId: string, period: Period, limit = 3) {
  const range: Range = [guildId, periodStart(period)];
  const voice = getVoiceStats(guildId, period);
  return {
    topVoice: voice.topVoice.slice(0, limit),
    longestCall: voice.longestCall,
    peakVoice: voice.peak,
    topSenders: topSendersStmt.all(...range, limit),
    topChannels: topChannelsStmt.all(...range, limit),
    topReactors: topReactorsStmt.all(...range, limit),
    topReceivers: topReceiversStmt.all(...range, limit),
    topEmoji: topEmojiStmt.all(...range, limit),
    topMessage: topMessageStmt.get(...range),
  };
}

export function getUserStats(guildId: string, userId: string, period: Period) {
  const range: UserRange = [guildId, periodStart(period), userId];
  return {
    sent: userSentStmt.get(...range)?.n ?? 0,
    reactionsGiven: userGivenStmt.get(...range)?.n ?? 0,
    reactionsReceived: userReceivedStmt.get(...range)?.n ?? 0,
    favouriteEmoji: userEmojiStmt.get(...range),
    favouriteChannel: userChannelStmt.get(...range),
    voiceMs:
      getVoiceStats(guildId, period).topVoice.find((row) => row.id === userId)
        ?.ms ?? 0,
  };
}
