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
const topMessageStmt = db.prepare<Range, TopMessage>(
  `SELECT message_id, channel_id, COUNT(DISTINCT user_id) AS n FROM reactions
   WHERE guild_id = ? AND created_at >= ?
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

export function getServerStats(guildId: string, period: Period, limit = 3) {
  const range: Range = [guildId, periodStart(period)];
  return {
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
  };
}
