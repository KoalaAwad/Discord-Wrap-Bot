import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config";

// Each entry runs once, in order. Never edit a shipped migration; append a new one.
const migrations: string[] = [
  `
  CREATE TABLE guild_settings (
    guild_id   TEXT PRIMARY KEY,
    silent     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE whitelist (
    guild_id  TEXT NOT NULL,
    kind      TEXT NOT NULL CHECK (kind IN ('channel', 'user', 'role')),
    target_id TEXT NOT NULL,
    added_by  TEXT NOT NULL,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (guild_id, kind, target_id)
  );

  CREATE TABLE messages (
    message_id TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_id  TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX messages_guild_time ON messages (guild_id, created_at);

  CREATE TABLE reactions (
    message_id        TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    emoji             TEXT NOT NULL,
    guild_id          TEXT NOT NULL,
    channel_id        TEXT NOT NULL,
    message_author_id TEXT,
    created_at        INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
  );
  CREATE INDEX reactions_guild_time ON reactions (guild_id, created_at);
  `,
  `
  -- left_at is NULL while the member is still in the channel.
  CREATE TABLE voice_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    joined_at  INTEGER NOT NULL,
    left_at    INTEGER
  );
  CREATE INDEX voice_sessions_guild_time ON voice_sessions (guild_id, joined_at);
  CREATE UNIQUE INDEX voice_sessions_one_open
    ON voice_sessions (guild_id, user_id) WHERE left_at IS NULL;

  -- Small key/value store for bot state, e.g. the last heartbeat.
  CREATE TABLE bot_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

fs.mkdirSync(path.dirname(path.resolve(config.DB_PATH)), { recursive: true });

export const db: Database.Database = new Database(config.DB_PATH);
db.pragma("journal_mode = WAL");

function migrate() {
  const current = db.pragma("user_version", { simple: true }) as number;

  for (let version = current; version < migrations.length; version++) {
    db.transaction(() => {
      db.exec(migrations[version]!);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

migrate();
