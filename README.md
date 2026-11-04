# Discord Wrap Bot

A self-hosted Discord bot that keeps opt-in activity stats for your server and turns them into a yearly wrap: a deck of image slides covering top senders and reactors, the most reacted messages, voice time, the longest call and more. You run the bot and its SQLite database yourself; your stats aren't sent anywhere else.

**Nothing is tracked without the member's own say-so.** Admins pick the channels with `/whitelist`, and each member who wants to be included runs `/optin` themselves. Message text is never read or stored, only who sent a message, where and when.

Command guide: **[wrap.koala.rip](https://wrap.koala.rip)**

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

**For everyone:**

| Command | Options | What it does |
| --- | --- | --- |
| `/optin` | | Let the bot count your messages, reactions and voice time in whitelisted channels. Nothing about you is tracked until you do. |
| `/optout` | | Stop being tracked here and delete your data, after a confirmation. |
| `/stats` | `user`, `period`, `public` | Server leaderboards, or one member's numbers with `user`. `period` is Last 7 days, Last 30 days, This year or All time (default). `public:True` posts it in the channel; otherwise only you see it. |
| `/wrap server` | `preview` | The server's year as image slides. |
| `/wrap me` | `preview` | Your own year. |
| `/wrap member` | `user`, `preview` | Someone else's year, if they opted in. |

The wrap opens during wrap week (Dec 25–31 by default). Click through it privately and share any slide to the channel. The rest of the year it shows last year's wrap and a countdown. `preview:True` is for admins: it shows this year so far, privately, at any time.

**For admins** (members with Manage Server):

| Command | Options | What it does |
| --- | --- | --- |
| `/whitelist add` | `channel` | Count opted-in members in this channel or category (covers its threads and a voice channel's chat). |
| `/whitelist remove` | `channel` | Stop counting there. Stored data stays until purged. |
| `/whitelist list` | | Whitelisted channels and how many members opted in (not who). |
| `/tracking pause\|resume` | | Stop or restart recording in the whole server. |
| `/tracking status` | | Whether tracking is on, channel and opt-in counts. |
| `/purge-data user` | `user` | Delete one member's stored data. Doesn't stop future tracking if they're opted in. |
| `/purge-data channel` | `channel` | Delete one channel's or thread's stored data. |
| `/wrap-channel set` | `channel` | Post the server wrap there once when wrap week opens. Needs Send Messages and Attach Files. |
| `/wrap-channel clear\|show` | | Turn the auto-post off, or show the current channel. |
| `/silent` | `enabled` | `True` mutes announcements, including the wrap post. |

Admins can't opt anyone in, by name or by role.

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
