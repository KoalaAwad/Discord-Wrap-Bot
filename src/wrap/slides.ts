export type Icon =
  | { kind: "avatar"; url: string }
  /** Raw emoji as stored: "🔥" or a custom "<:name:id>". */
  | { kind: "emoji"; raw: string };

export type Row = { label: string; value: string; icon?: Icon };

/** One wrap slide, drawn as an image card. */
export type Slide = {
  kicker: string;
  headline: string;
  caption: string;
  rows: Row[];
  /** Gradient start/end; the first doubles as the message's accent colour. */
  palette: [string, string];
  /** Text colour, picked for contrast with the palette. */
  ink: string;
  /** Large round image above the headline (avatar or server icon). */
  hero?: string | undefined;
  /** Shown as a clickable line under the image, since images can't link. */
  link?: { label: string; url: string };
};

export const palettes: { palette: [string, string]; ink: string }[] = [
  { palette: ["#ff7a59", "#ffd166"], ink: "#22101a" },
  { palette: ["#243b6b", "#5b3f8c"], ink: "#ffffff" },
  { palette: ["#0f5f56", "#1f9d63"], ink: "#ffffff" },
  { palette: ["#6a1fd1", "#c2348f"], ink: "#ffffff" },
  { palette: ["#b3261e", "#ef6c3a"], ink: "#ffffff" },
  { palette: ["#0b4a8b", "#1aa3c9"], ink: "#ffffff" },
  { palette: ["#1d1b26", "#3b3550"], ink: "#ffffff" },
];
