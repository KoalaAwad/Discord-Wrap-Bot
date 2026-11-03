# Discord Wrap Bot

A self-hosted Discord bot that keeps opt-in activity stats for your server and turns them into a yearly wrap: a deck of image slides covering top senders and reactors, the most reacted messages, voice time, the longest call and more. You run the bot and its SQLite database yourself; your stats aren't sent anywhere else.

**Nothing is tracked without the member's own say-so.** Admins pick the channels with `/whitelist`, and each member who wants to be included runs `/optin` themselves. Message text is never read or stored, only who sent a message, where and when.

## Setup

You need Node.js 20 or newer.

1. **Create the bot.** Go to the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application**, then open **Bot** and click **Reset Token** to get your token. None of the privileged intents (Presence, Server Members, Message Content) are needed; leave them off.
2. **Invite it.** Replace `YOUR_CLIENT_ID` with your Application ID (on **General Information**) and open:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=101376
   ```

   That grants View Channels, Send Messages, Attach Files and Read Message History. The bot can only see voice and text channels it has View Channel on, and needs Attach Files wherever it auto-posts the wrap.
3. **Configure.** Copy `.env.example` to `.env` and fill it in. Keep the token in `.env` only; `.env.example` is committed and must stay blank.

   | Variable | Required | What it is |
   | --- | --- | --- |
   | `DISCORD_TOKEN` | yes | Bot token from step 1 |
   | `DISCORD_CLIENT_ID` | yes | Application ID |
   | `DISCORD_GUILD_ID` | no | A server ID. Registers commands to that one server instantly instead of globally (global can take up to an hour) |
   | `DB_PATH` | no | Where the database lives. Defaults to `data/wrapbot.db` |
   | `WRAP_START`, `WRAP_END` | no | Wrap week as `MM-DD`, inclusive, in the host's timezone. Defaults to `12-25` and `12-31` |

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
| `/whitelist add\|remove\|list` | Choose which channels (or categories) can be tracked. Members are only tracked after they `/optin` themselves; admins can't opt anyone in. `list` also shows how many members opted in. |
| `/tracking pause\|resume\|status` | Pause or resume all tracking in the server, or see what's set up. |
| `/purge-data user\|channel` | Delete everything stored for one member or one channel. |
| `/wrap-channel set\|clear\|show` | Post the server wrap in a channel automatically when wrap week opens. |
| `/silent` | Mute the bot's announcements, including the wrap auto-post. |
| `/wrap … preview:True` | Preview this year's wrap before wrap week. Only you see it. |

**For everyone:**

| Command | What it does |
| --- | --- |
| `/wrap server\|me\|member` | The year in slides: the server's, your own, or someone else's. Click through privately and share any slide to the channel. Available during wrap week; for the rest of the year it shows last year's wrap and a countdown to the next one. |
| `/stats` | Server stats, or one member's with `user:`. Choose a `period:`, and set `public:` to post the result in the channel. |
| `/optin` | Let the bot count your messages, reactions and voice time in whitelisted channels. Nothing about you is tracked until you do. |
| `/optout` | Stop being tracked here and delete your data. |

To limit who can use a command, or where, go to **Server Settings → Integrations → (the bot)**. Discord handles per-role and per-channel command permissions there.

## What's stored

Everything is in one SQLite file, separated by server:

- **Messages:** message ID, channel, author and time. Never the text.
- **Reactions:** who reacted, with which emoji, on which message, and whose message it was.
- **Voice sessions:** who was in which voice channel, from when to when.
- **Settings:** the channel whitelist, who opted in, and the pause state.

Deleted messages and removed reactions are deleted from the database too, as long as the bot is online when it happens. The bot ignores bots and the AFK channel.

When the bot is removed from a server, that server's data is deleted, including removals that happened while the bot was offline. Opt-ins are deleted too, so if the bot is added back, members choose again. **Don't point a different bot token at an existing database:** on startup, the new bot would treat every server it isn't in as one it was removed from and delete that data.

Back up the database by copying `data/wrapbot.db` while the bot is stopped.

## Credits

Wrap slides use [Inter](https://rsms.me/inter/) (SIL Open Font License, bundled in `assets/fonts`) and [Twemoji](https://github.com/jdecked/twemoji) emoji graphics (CC-BY 4.0), which are loaded from the jsDelivr CDN when a slide shows an emoji.
