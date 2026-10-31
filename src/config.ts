import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DB_PATH } =
  process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error(
    "Missing environment variables: DISCORD_TOKEN or DISCORD_CLIENT_ID",
  );
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  // `||` so an empty `DB_PATH=` line falls back too; SQLite treats "" as a
  // throwaway temp database.
  DB_PATH: DB_PATH || "data/wrapbot.db",
};
