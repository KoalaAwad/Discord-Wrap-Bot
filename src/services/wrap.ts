import { db } from "../db";
import { summarizeVoice } from "./stats";

// All queries take [guildId, start, end) in epoch ms. Hours, weekdays and days
// use the host's local time, matching how the wrap window is defined.

type Range = [guildId: string, start: number, end: number];
type UserRange = [...Range, userId: string];
type Ranked = { id: string; n: number };
type Session = {
  channel_id: string;
  user_id: string;
  joined_at: number;
  left_at: number | null;
};

const local = (column: string, format: string) =>
  `strftime('${format}', ${column} / 1000, 'unixepoch', 'localtime')`;
const inRange = "guild_id = ? AND created_at >= ? AND created_at < ?";

function ranked(sql: string) {
  return db.prepare<[...Range, number], Ranked>(`${sql} ORDER BY n DESC, id LIMIT ?`);
}
function userRanked(sql: string) {
  return db.prepare<UserRange, Ranked>(`${sql} ORDER BY n DESC, id LIMIT 1`);
}
function userCount(sql: string) {
  return db.prepare<UserRange, { n: number }>(sql);
}

const server = {
  messages: db.prepare<Range, { n: number }>(`SELECT COUNT(*) AS n FROM messages WHERE ${inRange}`),
  reactions: db.prepare<Range, { n: number }>(`SELECT COUNT(*) AS n FROM reactions WHERE ${inRange}`),
  activeIds: db.prepare<[...Range, ...Range], { id: string }>(
    `SELECT author_id AS id FROM messages WHERE ${inRange}
     UNION SELECT user_id FROM reactions WHERE ${inRange}`,
  ),
  senders: ranked(`SELECT author_id AS id, COUNT(*) AS n FROM messages WHERE ${inRange} GROUP BY author_id`),
  reactors: ranked(`SELECT user_id AS id, COUNT(*) AS n FROM reactions WHERE ${inRange} GROUP BY user_id`),
  receivers: ranked(
    `SELECT message_author_id AS id, COUNT(*) AS n FROM reactions
     WHERE ${inRange} AND message_author_id IS NOT NULL GROUP BY message_author_id`,
  ),
  emoji: ranked(`SELECT emoji AS id, COUNT(*) AS n FROM reactions WHERE ${inRange} GROUP BY emoji`),
  channels: ranked(`SELECT channel_id AS id, COUNT(*) AS n FROM messages WHERE ${inRange} GROUP BY channel_id`),
  months: ranked(`SELECT ${local("created_at", "%m")} AS id, COUNT(*) AS n FROM messages WHERE ${inRange} GROUP BY id`),
  weekdays: ranked(`SELECT ${local("created_at", "%w")} AS id, COUNT(*) AS n FROM messages WHERE ${inRange} GROUP BY id`),
  hours: ranked(`SELECT ${local("created_at", "%H")} AS id, COUNT(*) AS n FROM messages WHERE ${inRange} GROUP BY id`),
  nightOwls: ranked(
    `SELECT author_id AS id, COUNT(*) AS n FROM messages
     WHERE ${inRange} AND ${local("created_at", "%H")} < '05' GROUP BY author_id`,
  ),
  consistent: ranked(
    `SELECT author_id AS id, COUNT(DISTINCT ${local("created_at", "%Y-%m-%d")}) AS n
     FROM messages WHERE ${inRange} GROUP BY author_id`,
  ),
  // Distinct people, so one person spamming emoji doesn't win; untracked
  // authors are skipped so the link never points at them.
  topMessage: db.prepare<Range, { message_id: string; channel_id: string; author_id: string; n: number }>(
    `SELECT message_id, channel_id, message_author_id AS author_id, COUNT(DISTINCT user_id) AS n
     FROM reactions WHERE ${inRange} AND message_author_id IS NOT NULL
     GROUP BY message_id ORDER BY n DESC, COUNT(*) DESC LIMIT 1`,
  ),
  sessions: db.prepare<[string, number, number], Session>(
    `SELECT channel_id, user_id, joined_at, left_at FROM voice_sessions
     WHERE guild_id = ? AND joined_at < ? AND (left_at IS NULL OR left_at >= ?)`,
  ),
};

const person = {
  messages: userCount(`SELECT COUNT(*) AS n FROM messages WHERE ${inRange} AND author_id = ?`),
  given: userCount(`SELECT COUNT(*) AS n FROM reactions WHERE ${inRange} AND user_id = ?`),
  received: userCount(`SELECT COUNT(*) AS n FROM reactions WHERE ${inRange} AND message_author_id = ?`),
  nightMessages: userCount(
    `SELECT COUNT(*) AS n FROM messages WHERE ${inRange} AND author_id = ? AND ${local("created_at", "%H")} < '05'`,
  ),
  activeDays: userCount(
    `SELECT COUNT(DISTINCT ${local("created_at", "%Y-%m-%d")}) AS n FROM messages WHERE ${inRange} AND author_id = ?`,
  ),
  ahead: db.prepare<[...Range, ...UserRange], { n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT author_id FROM messages WHERE ${inRange} GROUP BY author_id
       HAVING COUNT(*) > (SELECT COUNT(*) FROM messages WHERE ${inRange} AND author_id = ?)
     )`,
  ),
  senders: db.prepare<Range, { n: number }>(
    `SELECT COUNT(DISTINCT author_id) AS n FROM messages WHERE ${inRange}`,
  ),
  channel: userRanked(`SELECT channel_id AS id, COUNT(*) AS n FROM messages WHERE ${inRange} AND author_id = ? GROUP BY channel_id`),
  emoji: userRanked(`SELECT emoji AS id, COUNT(*) AS n FROM reactions WHERE ${inRange} AND user_id = ? GROUP BY emoji`),
  weekday: userRanked(
    `SELECT ${local("created_at", "%w")} AS id, COUNT(*) AS n FROM messages WHERE ${inRange} AND author_id = ? GROUP BY id`,
  ),
  biggestFan: db.prepare<[...UserRange, string], Ranked>(
    `SELECT user_id AS id, COUNT(*) AS n FROM reactions
     WHERE ${inRange} AND message_author_id = ? AND user_id != ?
     GROUP BY user_id ORDER BY n DESC, id LIMIT 1`,
  ),
  reactsMostTo: db.prepare<[...UserRange, string], Ranked>(
    `SELECT message_author_id AS id, COUNT(*) AS n FROM reactions
     WHERE ${inRange} AND user_id = ? AND message_author_id IS NOT NULL AND message_author_id != ?
     GROUP BY message_author_id ORDER BY n DESC, id LIMIT 1`,
  ),
  topMessage: db.prepare<UserRange, { message_id: string; channel_id: string; n: number }>(
    `SELECT message_id, channel_id, COUNT(DISTINCT user_id) AS n FROM reactions
     WHERE ${inRange} AND message_author_id = ?
     GROUP BY message_id ORDER BY n DESC, COUNT(*) DESC LIMIT 1`,
  ),
};

function clipSessions(sessions: Session[], start: number, end: number) {
  return sessions
    .map((s) => ({
      channel: s.channel_id,
      user: s.user_id,
      from: Math.max(s.joined_at, start),
      to: Math.min(s.left_at ?? end, end),
    }))
    .filter((s) => s.to > s.from);
}

/** Total voice time per channel, longest first. */
function voiceByChannel(sessions: ReturnType<typeof clipSessions>) {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    totals.set(s.channel, (totals.get(s.channel) ?? 0) + (s.to - s.from));
  }
  return [...totals].map(([id, ms]) => ({ id, ms })).sort((a, b) => b.ms - a.ms);
}

/**
 * For one member: the longest stretch they spent in a channel with at least
 * one other person, and who they shared the most voice time with.
 */
export function personalVoice(
  sessions: ReturnType<typeof clipSessions>,
  userId: string,
) {
  const mine = sessions.filter((s) => s.user === userId);
  const others = sessions.filter((s) => s.user !== userId);
  let longestCall: { channelId: string; start: number; end: number } | undefined;
  const together = new Map<string, number>();

  for (const own of mine) {
    const overlapping = others.filter(
      (o) => o.channel === own.channel && o.from < own.to && o.to > own.from,
    );

    for (const o of overlapping) {
      const shared = Math.min(own.to, o.to) - Math.max(own.from, o.from);
      together.set(o.user, (together.get(o.user) ?? 0) + shared);
    }

    // Sweep how many others are present while this member is in the channel.
    const edges = overlapping.flatMap((o) => [
      { at: Math.max(o.from, own.from), delta: 1 },
      { at: Math.min(o.to, own.to), delta: -1 },
    ]);
    edges.sort((a, b) => a.at - b.at || a.delta - b.delta);

    let count = 0;
    let start: number | undefined;
    for (const edge of edges) {
      count += edge.delta;
      if (count >= 1 && start === undefined) start = edge.at;
      if (count === 0 && start !== undefined) {
        if (!longestCall || edge.at - start > longestCall.end - longestCall.start) {
          longestCall = { channelId: own.channel, start, end: edge.at };
        }
        start = undefined;
      }
    }
  }

  const buddy = [...together].sort((a, b) => b[1] - a[1])[0];
  return {
    voiceMs: mine.reduce((sum, s) => sum + (s.to - s.from), 0),
    longestCall,
    buddy: buddy ? { id: buddy[0], ms: buddy[1] } : undefined,
  };
}

export function getServerWrap(guildId: string, start: number, end: number) {
  const r: Range = [guildId, start, end];
  const sessions = clipSessions(server.sessions.all(guildId, end, start), start, end);
  const voice = summarizeVoice(
    sessions.map((s) => ({ channel_id: s.channel, user_id: s.user, joined_at: s.from, left_at: s.to })),
    start,
    end,
  );
  const active = new Set(server.activeIds.all(...r, ...r).map((row) => row.id));
  for (const s of sessions) active.add(s.user);

  return {
    messages: server.messages.get(...r)?.n ?? 0,
    reactions: server.reactions.get(...r)?.n ?? 0,
    activeMembers: active.size,
    voiceMs: sessions.reduce((sum, s) => sum + (s.to - s.from), 0),
    topSenders: server.senders.all(...r, 3),
    topReactors: server.reactors.all(...r, 3),
    topReceivers: server.receivers.all(...r, 3),
    topEmoji: server.emoji.all(...r, 3),
    busiestChannel: server.channels.all(...r, 1)[0],
    busiestMonth: server.months.all(...r, 1)[0],
    busiestWeekday: server.weekdays.all(...r, 1)[0],
    busiestHour: server.hours.all(...r, 1)[0],
    nightOwl: server.nightOwls.all(...r, 1)[0],
    mostConsistent: server.consistent.all(...r, 1)[0],
    topMessage: server.topMessage.get(...r),
    topVoice: voice.topVoice.slice(0, 3),
    longestCall: voice.longestCall,
    peak: voice.peak && voice.peak.count >= 2 ? voice.peak : undefined,
    topVoiceChannel: voiceByChannel(sessions)[0],
  };
}

export function getPersonalWrap(
  guildId: string,
  userId: string,
  start: number,
  end: number,
) {
  const r: Range = [guildId, start, end];
  const u: UserRange = [...r, userId];
  const sessions = clipSessions(server.sessions.all(guildId, end, start), start, end);
  const messages = person.messages.get(...u)?.n ?? 0;

  return {
    messages,
    rank: messages > 0 ? (person.ahead.get(...r, ...u)?.n ?? 0) + 1 : undefined,
    senders: person.senders.get(...r)?.n ?? 0,
    reactionsGiven: person.given.get(...u)?.n ?? 0,
    reactionsReceived: person.received.get(...u)?.n ?? 0,
    nightMessages: person.nightMessages.get(...u)?.n ?? 0,
    activeDays: person.activeDays.get(...u)?.n ?? 0,
    favouriteChannel: person.channel.get(...u),
    favouriteEmoji: person.emoji.get(...u),
    busiestWeekday: person.weekday.get(...u),
    biggestFan: person.biggestFan.get(...u, userId),
    reactsMostTo: person.reactsMostTo.get(...u, userId),
    topMessage: person.topMessage.get(...u),
    ...personalVoice(sessions, userId),
  };
}

export type ServerWrap = ReturnType<typeof getServerWrap>;
export type PersonalWrap = ReturnType<typeof getPersonalWrap>;
