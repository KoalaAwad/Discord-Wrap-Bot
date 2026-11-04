import dotenv from "dotenv";

dotenv.config();

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  DB_PATH,
  WRAP_START,
  WRAP_END,
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error(
    "Missing environment variables: DISCORD_TOKEN or DISCORD_CLIENT_ID",
  );
}

export type MonthDay = { month: number; day: number };

/** Parses "MM-DD" (e.g. "12-25"); empty falls back to `fallback`. */
function monthDay(name: string, value: string | undefined, fallback: string) {
  const raw = value || fallback;
  const match = /^(\d{2})-(\d{2})$/.exec(raw);
  const month = Number(match?.[1]);
  const day = Number(match?.[2]);
  const valid =
    match !== null &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(2024, month, 0).getDate(); // 2024 is a leap year
  if (!valid) throw new Error(`${name} must look like MM-DD, got "${raw}"`);
  return { month, day };
}

const wrapStart = monthDay("WRAP_START", WRAP_START, "12-25");
const wrapEnd = monthDay("WRAP_END", WRAP_END, "12-31");
const order = (d: MonthDay) => d.month * 100 + d.day;
if (order(wrapStart) > order(wrapEnd)) {
  throw new Error("WRAP_START must be on or before WRAP_END in the same year");
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  // `||` so an empty `DB_PATH=` line falls back too; SQLite treats "" as a
  // throwaway temp database.
  DB_PATH: DB_PATH || "data/wrapbot.db",
  /** Wrap week, inclusive, in the host's local time. */
  WRAP_START: wrapStart,
  WRAP_END: wrapEnd,
};
