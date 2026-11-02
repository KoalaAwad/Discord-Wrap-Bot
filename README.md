# Discord Wrap Bot

A self-hosted Discord bot that keeps opt-in activity stats for your server: top senders and reactors, most reacted messages, voice time, the longest call and the busiest voice moment. You run the bot and its SQLite database yourself; nothing is sent anywhere else.

**Nothing is tracked until an admin whitelists it.** Message text is never read or stored, only who sent a message, where and when.

## Setup

You need Node.js 20 or newer.

1. **Create the bot.** Go to the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application**, then open **Bot** and click **Reset Token** to get your token. None of the privileged intents (Presence, Server Members, Message Content) are needed; leave them off.
2. **Invite it.** Replace `YOUR_CLIENT_ID` with your Application ID (on **General Information**) and open:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=68608
   ```

   That grants View Channels, Send Messages and Read Message History. The bot can only see voice and text channels it has View Channel on.
3. **Configure.** Copy `.env.example` to `.env` and fill it in. Keep the token in `.env` only; `.env.example` is committed and must stay blank.

   | Variable | Required | What it is |
   | --- | --- | --- |
   | `DISCORD_TOKEN` | yes | Bot token from step 1 |
   | `DISCORD_CLIENT_ID` | yes | Application ID |
   | `DISCORD_GUILD_ID` | no | A server ID. Registers commands to that one server instantly instead of globally (global can take up to an hour) |
   | `DB_PATH` | no | Where the database lives. Defaults to `data/wrapbot.db` |

4. **Install, register commands, run.**

   ```bash
   npm install
   npm run deploy
   npm run dev
   ```

   Run `npm run deploy` again whenever commands are added or changed. For a long-running setup, use `npm run build` then `npm start` under a process manager such as pm2 or systemd.

## Commands

**For admins** (members with Manage Server):

| Command | What it does |
| --- | --- |
| `/whitelist add\|remove\|list` | Choose which channels (or categories) and which members (by user or role) can be tracked. Both a channel and a member must be whitelisted. Whitelist `@everyone` to include every member. |
| `/tracking pause\|resume\|status` | Pause or resume all tracking in the server, or see what's set up. |
| `/purge-data user\|channel` | Delete everything stored for one member or one channel. |
| `/silent` | Mute the bot's announcements. (Nothing announces yet; milestones will.) |

**For everyone:**

| Command | What it does |
| --- | --- |
| `/stats` | Server stats, or one member's with `user:`. Choose a `period:`, and set `public:` to post the result in the channel. |
| `/optout` | Stop being tracked here and delete your data. This overrides the whitelist. |
| `/optin` | Undo `/optout`. |

To limit who can use a command, or where, go to **Server Settings → Integrations → (the bot)**. Discord handles per-role and per-channel command permissions there.

## What's stored

Everything is in one SQLite file, separated by server:

- **Messages:** message ID, channel, author and time. Never the text.
- **Reactions:** who reacted, with which emoji, on which message, and whose message it was.
- **Voice sessions:** who was in which voice channel, from when to when.
- **Settings:** the whitelist, opt-outs and the pause state.

Deleted messages and removed reactions are deleted from the database too, as long as the bot is online when it happens. The bot ignores bots and the AFK channel.

When the bot is removed from a server, that server's data is deleted, including removals that happened while the bot was offline. Opt-outs are kept, so members who opted out stay opted out if the bot is added back. **Don't point a different bot token at an existing database:** on startup, the new bot would treat every server it isn't in as one it was removed from and delete that data.

Back up the database by copying `data/wrapbot.db` while the bot is stopped.
