import path from "node:path";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { Icon, Slide } from "./slides";

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 90;
const ICON = 76;

// Inter ships in assets/fonts so cards look the same on every host. The
// latin-ext files cover accented names; anything else falls back to system fonts.
const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
for (const weight of [500, 600, 700, 800]) {
  GlobalFonts.registerFromPath(path.join(FONT_DIR, `inter-latin-${weight}.ttf`), "Inter");
  GlobalFonts.registerFromPath(path.join(FONT_DIR, `inter-latin-ext-${weight}.ttf`), "Inter Ext");
}
const FONT = "Inter, 'Inter Ext', 'DejaVu Sans', sans-serif";

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

const TWEMOJI = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72";

/** Image URL for a stored emoji: Discord's CDN for custom ones, Twemoji otherwise. */
export function emojiUrl(raw: string) {
  const custom = /^<a?:\w+:(\d+)>$/.exec(raw);
  if (custom) return `https://cdn.discordapp.com/emojis/${custom[1]}.png?size=128`;

  const points = [...raw].map((char) => char.codePointAt(0)!);
  // Twemoji file names drop the variation selector unless it's a ZWJ sequence.
  const keepVs = points.includes(0x200d);
  const hex = points
    .filter((point) => keepVs || point !== 0xfe0f)
    .map((point) => point.toString(16))
    .join("-");
  return `${TWEMOJI}/${hex}.png`;
}

// Avatars and emoji are fetched once per process; failures are remembered too
// so a missing image doesn't slow every slide down.
const images = new Map<string, Promise<Image | null>>();
function image(url: string) {
  let cached = images.get(url);
  if (!cached) {
    cached = loadImage(url).catch(() => null);
    images.set(url, cached);
  }
  return cached;
}

function iconUrl(icon: Icon) {
  return icon.kind === "avatar" ? icon.url : emojiUrl(icon.raw);
}

/** Splits text into lines that fit `maxWidth` at the current font. */
function wrap(g: SKRSContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest size up to `max` at which `text` fits on one line. */
function fitSize(g: SKRSContext2D, text: string, weight: number, max: number) {
  let size = max;
  g.font = font(weight, size);
  while (size > 56 && g.measureText(text).width > WIDTH - PAD * 2) {
    size -= 6;
    g.font = font(weight, size);
  }
  return size;
}

/** Trims text with an ellipsis so it fits on one line. */
function ellipsize(g: SKRSContext2D, text: string, maxWidth: number) {
  if (g.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && g.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

function drawRound(g: SKRSContext2D, img: Image, x: number, y: number, size: number) {
  g.save();
  g.beginPath();
  g.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  g.clip();
  g.drawImage(img, x, y, size, size);
  g.restore();
}

/** Draws a slide as a PNG. */
export async function imageCard(slide: Slide, index: number, total: number, footer: string) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const g = canvas.getContext("2d");

  // Start every download at once instead of one after another.
  const [hero, ...rowIcons] = await Promise.all([
    slide.hero ? image(slide.hero) : null,
    ...slide.rows.map((row) => (row.icon ? image(iconUrl(row.icon)) : null)),
  ]);

  // Background: diagonal gradient plus two soft circles for depth.
  const bg = g.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, slide.palette[0]);
  bg.addColorStop(1, slide.palette[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  g.globalAlpha = 0.14;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(WIDTH - 60, 260, 380, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(80, HEIGHT - 120, 260, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;

  // Story-style progress segments across the top.
  const gap = 14;
  const segment = (WIDTH - PAD * 2 - gap * (total - 1)) / total;
  g.fillStyle = slide.ink;
  for (let i = 0; i < total; i++) {
    g.globalAlpha = i <= index ? 0.95 : 0.3;
    g.beginPath();
    g.roundRect(PAD + i * (segment + gap), 60, segment, 10, 5);
    g.fill();
  }
  g.globalAlpha = 1;

  g.font = font(500, 42);
  const caption = wrap(g, slide.caption, WIDTH - PAD * 2).slice(0, 3);

  // Pick the biggest hero image that still leaves every row enough height:
  // the hero shrinks, then disappears, before the rows get cramped.
  const layout = (heroSize: number) => {
    const headlineSize = fitSize(g, slide.headline, 800, heroSize > 0 ? 150 : 210);
    const heroBlock = heroSize > 0 ? 60 + heroSize : 0;
    // The gap under the headline scales with it, so descenders like the
    // comma in "4,812" or the "p" in "people" never touch the caption.
    const rowsTop =
      190 + heroBlock + 70 + headlineSize + headlineSize * 0.22 + caption.length * 58 + 50;
    return { heroSize, headlineSize, rowsTop };
  };
  const footerTop = HEIGHT - 140;
  const rows = Math.max(slide.rows.length, 1);
  const sizes = hero ? [slide.rows.length > 2 ? 200 : 280, 140, 0] : [0];
  const chosen =
    sizes.map(layout).find((option) => (footerTop - option.rowsTop) / rows >= 125) ??
    layout(0);

  let y = 190;
  g.font = font(700, 32);
  g.letterSpacing = "6px";
  g.fillText(ellipsize(g, slide.kicker, WIDTH - PAD * 2), PAD, y);
  g.letterSpacing = "0px";

  if (hero && chosen.heroSize > 0) {
    drawRound(g, hero, PAD, y + 60, chosen.heroSize);
    y += 60 + chosen.heroSize;
  }

  // Headline: as big as fits, then the caption under it.
  y += 70 + chosen.headlineSize;
  g.font = font(800, chosen.headlineSize);
  g.fillText(ellipsize(g, slide.headline, WIDTH - PAD * 2), PAD, y);

  y += chosen.headlineSize * 0.22;
  g.font = font(500, 42);
  for (const line of caption) {
    y += 58;
    g.fillText(line, PAD, y);
  }

  // Stat rows share whatever height is left above the footer.
  y += 50;
  const rowHeight = Math.min(150, (footerTop - y) / rows);
  slide.rows.forEach((row, i) => {
    const icon = rowIcons[i];
    const textX = icon ? PAD + ICON + 28 : PAD;
    const maxText = WIDTH - PAD - textX;

    g.globalAlpha = 0.25;
    g.fillRect(PAD, y, WIDTH - PAD * 2, 2);
    if (icon) {
      g.globalAlpha = 1;
      const iconY = y + (rowHeight - ICON) / 2 + 4;
      if (row.icon?.kind === "avatar") drawRound(g, icon, PAD, iconY, ICON);
      else g.drawImage(icon, PAD, iconY, ICON, ICON);
    }
    g.globalAlpha = 0.75;
    g.font = font(600, 26);
    g.fillText(ellipsize(g, row.label.toUpperCase(), maxText), textX, y + rowHeight * 0.4);
    g.globalAlpha = 1;
    g.font = font(700, 40);
    g.fillText(ellipsize(g, row.value, maxText), textX, y + rowHeight * 0.78);
    y += rowHeight;
  });

  g.globalAlpha = 0.7;
  g.font = font(600, 26);
  g.fillText(ellipsize(g, footer.toUpperCase(), WIDTH - PAD * 2 - 120), PAD, HEIGHT - 70);
  g.textAlign = "right";
  g.fillText(`${index + 1} / ${total}`, WIDTH - PAD, HEIGHT - 70);

  return canvas.encode("png");
}
