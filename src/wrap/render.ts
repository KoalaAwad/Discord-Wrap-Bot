import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  TextDisplayBuilder,
  type Guild,
} from "discord.js";
import { getPersonalWrap, getServerWrap } from "../services/wrap";
import { personalDeck, personalPeople, serverDeck, serverPeople, type DeckInfo } from "./decks";
import { imageCard } from "./imageCard";
import { channelName, lookupPeople } from "./names";
import type { Slide } from "./slides";
import { yearRange } from "./window";

export type DeckKey = {
  kind: "server" | "user";
  /** The member for a personal wrap; the guild id for a server wrap. */
  targetId: string;
  year: number;
  preview: boolean;
};

/**
 * private: the viewer's own copy with Back/Next/Share.
 * public: a shared slide with a button that opens a private copy.
 */
export type Mode = "private" | "public";

type Deck = { slides: Slide[]; empty: boolean };

// Paging re-renders one slide per click; the numbers behind the deck are
// cached briefly so the yearly queries and name lookups run once per viewing.
const CACHE_MS = 5 * 60 * 1000;
const decks = new Map<string, { deck: Promise<Deck>; at: number }>();

async function buildDeck(guild: Guild, key: DeckKey): Promise<Deck> {
  const range = yearRange(key.year);
  const end = Math.min(range.end, Date.now());

  const data =
    key.kind === "server"
      ? getServerWrap(guild.id, range.start, end)
      : getPersonalWrap(guild.id, key.targetId, range.start, end);
  const people = await lookupPeople(
    guild,
    key.kind === "server"
      ? serverPeople(data as ReturnType<typeof getServerWrap>)
      : personalPeople(data as ReturnType<typeof getPersonalWrap>, key.targetId),
  );

  const info: DeckInfo = {
    year: key.year,
    serverName: guild.name,
    serverIcon: guild.iconURL({ extension: "png", size: 256 }) ?? undefined,
    guildId: guild.id,
    preview: key.preview,
    person: (id) =>
      people.get(id) ?? { name: "someone", avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png" },
    channel: (id) => channelName(guild, id),
  };

  const slides =
    key.kind === "server"
      ? serverDeck(data as ReturnType<typeof getServerWrap>, info)
      : personalDeck(data as ReturnType<typeof getPersonalWrap>, key.targetId, info);
  return { slides, empty: slides.length <= 2 };
}

/** `fresh` rebuilds the deck, so a new /wrap always sees the latest activity. */
export function loadDeck(guild: Guild, key: DeckKey, fresh = false) {
  const id = `${guild.id}:${key.kind}:${key.targetId}:${key.year}:${key.preview}`;
  const now = Date.now();
  for (const [cacheKey, entry] of decks) {
    if (now - entry.at > CACHE_MS) decks.delete(cacheKey);
  }
  let entry = decks.get(id);
  if (!entry || fresh) {
    entry = { deck: buildDeck(guild, key), at: now };
    entry.deck.catch(() => decks.delete(id));
    decks.set(id, entry);
  }
  return entry.deck;
}

/** Packs a deck key and page into a button id: wrap:<action>:<s|u>:<target>:<year>:<0|1>:<page>. */
export function buttonId(action: "nav" | "share" | "view", key: DeckKey, page: number) {
  return ["wrap", action, key.kind === "server" ? "s" : "u", key.targetId, key.year, key.preview ? 1 : 0, page].join(":");
}

export function parseButtonId(customId: string) {
  const [, action, kind, targetId, year, preview, page] = customId.split(":");
  return {
    action: action as "nav" | "share" | "view",
    key: {
      kind: kind === "s" ? "server" : "user",
      targetId: targetId ?? "",
      year: Number(year),
      preview: preview === "1",
    } satisfies DeckKey as DeckKey,
    page: Number(page) || 0,
  };
}

function buttons(key: DeckKey, page: number, total: number, mode: Mode) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (mode === "public") {
    return row.addComponents(
      new ButtonBuilder()
        .setCustomId(buttonId("view", key, 0))
        .setLabel("View the full wrap")
        .setStyle(ButtonStyle.Primary),
    );
  }
  return row.addComponents(
    new ButtonBuilder()
      .setCustomId(buttonId("nav", key, page - 1))
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(buttonId("nav", key, page + 1))
      .setLabel("Next")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === total - 1),
    new ButtonBuilder()
      .setCustomId(buttonId("share", key, page))
      .setLabel(key.preview ? "Share (after wrap opens)" : "Share this slide")
      .setStyle(ButtonStyle.Success)
      .setDisabled(key.preview),
  );
}

/** Builds a message showing one slide; `note` adds a line above the buttons. */
export async function wrapMessage(
  guild: Guild,
  key: DeckKey,
  page: number,
  mode: Mode,
  note?: string,
) {
  const { slides } = await loadDeck(guild, key);
  const index = Math.min(Math.max(page, 0), slides.length - 1);
  const slide = slides[index]!;
  const png = await imageCard(slide, index, slides.length, `${guild.name} · ${key.year}`);

  const container = new ContainerBuilder()
    .setAccentColor(Number.parseInt(slide.palette[0].slice(1), 16))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems((item) =>
        item.setURL("attachment://wrap.png").setDescription(`${slide.kicker}: ${slide.headline}. ${slide.caption}`),
      ),
    );

  const lines = [
    slide.link && `[${slide.link.label}](${slide.link.url})`,
    note,
  ].filter(Boolean);
  if (lines.length > 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
  }
  container.addActionRowComponents(buttons(key, index, slides.length, mode));

  return {
    components: [container],
    files: [new AttachmentBuilder(png, { name: "wrap.png" })],
  };
}
