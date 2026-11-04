import type { PersonalWrap, ServerWrap } from "../services/wrap";
import type { Person } from "./names";
import { palettes, type Row, type Slide } from "./slides";

/** What a deck needs besides the numbers; kept apart from discord.js for testing. */
export type DeckInfo = {
  year: number;
  serverName: string;
  serverIcon?: string | undefined;
  guildId: string;
  /** Year still in progress, viewed outside wrap week. */
  preview: boolean;
  person: (id: string) => Person;
  channel: (id: string | undefined) => string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays",
  "Fridays", "Saturdays"];

const num = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const people = (n: number) => `${num(n)} ${n === 1 ? "person" : "people"}`;

export function duration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes}m` : `${num(hours)}h ${minutes % 60}m`;
}

function day(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hour(h: string) {
  const n = Number(h);
  return `${n % 12 === 0 ? 12 : n % 12} ${n < 12 ? "AM" : "PM"}`;
}

function messageUrl(guildId: string, channelId: string, messageId: string) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/** Colours cycle through the palette list so every slide looks distinct. */
function slide(index: number, content: Omit<Slide, "palette" | "ink">): Slide {
  return { ...palettes[index % palettes.length]!, ...content };
}

/** Drops missing rows and keeps at most 4, which is what fits on a card. */
function compact(rows: (Row | false | undefined)[]) {
  return rows.filter((row): row is Row => Boolean(row)).slice(0, 4);
}

function kickerYear(info: DeckInfo) {
  return info.preview ? `${info.year} SO FAR · PREVIEW` : `SERVER WRAPPED · ${info.year}`;
}

function outro(index: number, info: DeckInfo, caption: string) {
  return slide(index, {
    kicker: "THAT'S A WRAP",
    headline: info.preview ? "More to come" : `See you in ${info.year + 1}`,
    caption,
    rows: [],
  });
}

export function serverDeck(data: ServerWrap, info: DeckInfo): Slide[] {
  const slides: Slide[] = [
    slide(0, {
      kicker: kickerYear(info),
      headline: info.serverName,
      caption: info.preview
        ? `How ${info.year} is going so far.`
        : `Here's how ${info.year} went, from everyone who opted in.`,
      rows: [],
      hero: info.serverIcon,
    }),
  ];

  if (data.messages === 0 && data.reactions === 0 && data.voiceMs === 0) {
    slides.push(slide(6, {
      kicker: "HMM",
      headline: "Quiet year",
      caption: "Nothing was tracked. Admins pick channels with /whitelist, and members join with /optin.",
      rows: [],
    }));
    return slides;
  }

  slides.push(slide(1, {
    kicker: "THE YEAR IN NUMBERS",
    headline: num(data.messages),
    caption: `messages sent by ${people(data.activeMembers)}`,
    rows: compact([
      { label: "Reactions", value: num(data.reactions) },
      data.voiceMs > 0 && { label: "Time in voice", value: duration(data.voiceMs) },
      data.busiestChannel && {
        label: "Busiest channel",
        value: `${info.channel(data.busiestChannel.id)}, ${plural(data.busiestChannel.n, "message")}`,
      },
    ]),
  }));

  const [first, ...rest] = data.topSenders;
  if (first) {
    const reactor = data.topReactors[0];
    slides.push(slide(2, {
      kicker: "THE REGULARS",
      headline: info.person(first.id).name,
      caption: `sent the most messages: ${num(first.n)}`,
      hero: info.person(first.id).avatarUrl,
      rows: compact([
        ...rest.map((row, i) => ({
          label: `#${i + 2}`,
          value: `${info.person(row.id).name}, ${num(row.n)}`,
          icon: { kind: "avatar" as const, url: info.person(row.id).avatarUrl },
        })),
        reactor && {
          label: "Top reactor",
          value: `${info.person(reactor.id).name}, ${num(reactor.n)}`,
          icon: { kind: "avatar", url: info.person(reactor.id).avatarUrl },
        },
      ]),
    }));
  }

  if (data.busiestMonth) {
    slides.push(slide(3, {
      kicker: "WHEN IT HAPPENED",
      headline: MONTHS[Number(data.busiestMonth.id) - 1]!,
      caption: `was the busiest month, with ${plural(data.busiestMonth.n, "message")}`,
      rows: compact([
        data.busiestWeekday && { label: "Busiest day", value: WEEKDAYS[Number(data.busiestWeekday.id)]! },
        data.busiestHour && { label: "Peak hour", value: hour(data.busiestHour.id) },
        data.nightOwl && {
          label: "Night owl",
          value: `${info.person(data.nightOwl.id).name}, ${num(data.nightOwl.n)} after midnight`,
          icon: { kind: "avatar", url: info.person(data.nightOwl.id).avatarUrl },
        },
        data.mostConsistent && {
          label: "Most consistent",
          value: `${info.person(data.mostConsistent.id).name}, active ${plural(data.mostConsistent.n, "day")}`,
          icon: { kind: "avatar", url: info.person(data.mostConsistent.id).avatarUrl },
        },
      ]),
    }));
  }

  const top = data.topMessage;
  const magnet = data.topReceivers[0];
  const emoji = data.topEmoji[0];
  if (top || magnet || emoji) {
    slides.push(slide(4, {
      kicker: "HALL OF FAME",
      headline: top ? people(top.n) : "Reactions",
      caption: top
        ? `reacted to one message by ${info.person(top.author_id).name} in ${info.channel(top.channel_id)}`
        : "kept this place lively",
      rows: compact([
        magnet && {
          label: "Reaction magnet",
          value: `${info.person(magnet.id).name}, ${plural(magnet.n, "reaction")} received`,
          icon: { kind: "avatar", url: info.person(magnet.id).avatarUrl },
        },
        emoji && { label: "Favourite emoji", value: `used ${plural(emoji.n, "time")}`, icon: { kind: "emoji", raw: emoji.id } },
      ]),
      ...(top && {
        link: { label: "Jump to the most reacted message", url: messageUrl(info.guildId, top.channel_id, top.message_id) },
      }),
    }));
  }

  if (data.voiceMs > 0) {
    const call = data.longestCall;
    const loved = data.topVoiceChannel;
    const talker = data.topVoice[0];
    slides.push(slide(5, {
      kicker: "IN VOICE",
      headline: duration(data.voiceMs),
      caption: "spent in voice channels together",
      rows: compact([
        call && { label: "Longest call", value: `${duration(call.end - call.start)} in ${info.channel(call.channelId)}, ${day(call.start)}` },
        data.peak && { label: "Busiest moment", value: `${data.peak.count} people in ${info.channel(data.peak.channelId)}, ${day(data.peak.at)}` },
        loved && { label: "Most-loved VC", value: `${info.channel(loved.id)}, ${duration(loved.ms)}` },
        talker && {
          label: "Most time in voice",
          value: `${info.person(talker.id).name}, ${duration(talker.ms)}`,
          icon: { kind: "avatar", url: info.person(talker.id).avatarUrl },
        },
      ]),
    }));
  }

  slides.push(outro(6, info, "Run /wrap me to see your own year."));
  return slides;
}

export function personalDeck(data: PersonalWrap, userId: string, info: DeckInfo): Slide[] {
  const me = info.person(userId);
  const slides: Slide[] = [
    slide(0, {
      kicker: kickerYear(info),
      headline: `${me.name}'s year`,
      caption: `A look back at ${info.year} in ${info.serverName}.`,
      rows: [],
      hero: me.avatarUrl,
    }),
  ];

  if (data.messages === 0 && data.reactionsGiven === 0 && data.voiceMs === 0) {
    slides.push(slide(6, {
      kicker: "HMM",
      headline: "Nothing yet",
      caption: `Nothing was tracked for ${me.name} in ${info.year}. Members are only tracked after they run /optin.`,
      rows: [],
    }));
    return slides;
  }

  slides.push(slide(1, {
    kicker: "YOUR YEAR IN NUMBERS",
    headline: num(data.messages),
    caption: data.rank
      ? `messages sent, #${data.rank} of ${data.senders} in the server`
      : "messages sent",
    rows: compact([
      data.favouriteChannel && { label: "Favourite channel", value: info.channel(data.favouriteChannel.id) },
      data.activeDays > 0 && { label: "Active on", value: plural(data.activeDays, "day") },
      data.busiestWeekday && { label: "Busiest day", value: WEEKDAYS[Number(data.busiestWeekday.id)]! },
      data.nightMessages > 0 && { label: "Night owl", value: `${plural(data.nightMessages, "message")} after midnight` },
    ]),
  }));

  const fan = data.biggestFan;
  const crush = data.reactsMostTo;
  const top = data.topMessage;
  slides.push(slide(2, {
    kicker: "YOUR PEOPLE",
    headline: fan ? info.person(fan.id).name : num(data.reactionsReceived),
    caption: fan
      ? `is your biggest fan, with ${plural(fan.n, "reaction")} on your messages`
      : "reactions on your messages",
    ...(fan && { hero: info.person(fan.id).avatarUrl }),
    rows: compact([
      crush && {
        label: "You react most to",
        value: `${info.person(crush.id).name}, ${plural(crush.n, "time")}`,
        icon: { kind: "avatar", url: info.person(crush.id).avatarUrl },
      },
      { label: "Reactions given · received", value: `${num(data.reactionsGiven)} · ${num(data.reactionsReceived)}` },
      data.favouriteEmoji && {
        label: "Favourite emoji",
        value: `used ${plural(data.favouriteEmoji.n, "time")}`,
        icon: { kind: "emoji", raw: data.favouriteEmoji.id },
      },
      top && { label: "Your most reacted message", value: people(top.n) },
    ]),
    ...(top && {
      link: { label: "Jump to your most reacted message", url: messageUrl(info.guildId, top.channel_id, top.message_id) },
    }),
  }));

  if (data.voiceMs > 0) {
    const call = data.longestCall;
    const buddy = data.buddy;
    slides.push(slide(5, {
      kicker: "IN VOICE",
      headline: duration(data.voiceMs),
      caption: "spent in voice channels",
      rows: compact([
        call && { label: "Longest call", value: `${duration(call.end - call.start)} in ${info.channel(call.channelId)}, ${day(call.start)}` },
        buddy && {
          label: "Call buddy",
          value: `${info.person(buddy.id).name}, ${duration(buddy.ms)} together`,
          icon: { kind: "avatar", url: info.person(buddy.id).avatarUrl },
        },
      ]),
    }));
  }

  slides.push(outro(6, info, `Thanks for being part of ${info.serverName}.`));
  return slides;
}

/** Every user id a wrap mentions, so names can be fetched in one go. */
export function serverPeople(data: ServerWrap) {
  return [
    ...data.topSenders, ...data.topReactors, ...data.topReceivers, ...data.topVoice,
    data.nightOwl, data.mostConsistent,
    data.topMessage && { id: data.topMessage.author_id },
  ].flatMap((row) => (row ? [row.id] : []));
}

export function personalPeople(data: PersonalWrap, userId: string) {
  return [userId, data.biggestFan?.id, data.reactsMostTo?.id, data.buddy?.id]
    .filter((id): id is string => Boolean(id));
}
