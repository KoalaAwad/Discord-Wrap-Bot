// import { Events, type Client } from "discord.js";

// type BatchMessage = {
//   authorId: string;
//   createdAt: number;
//   channelId: string;
// };

// const messageBatch: BatchMessage[] = [];

// export function registerMessageBatch(client: Client) {
//   client.on(Events.MessageCreate, async (message) => {
//     if (message.author.bot || !message.guild) return;

//     messageBatch.push({
//       authorId: message.author.id,
//       createdAt: message.createdTimestamp,
//       channelId: message.channelId,
//     });

//     if (messageBatch.length < 5) return;

//     const batch = messageBatch.splice(0, 5);
//     const counts = new Map<string, number>();

//     for (const item of batch) {
//       counts.set(item.authorId, (counts.get(item.authorId) ?? 0) + 1);
//     }

//     let topUserId: string | undefined;
//     let topCount = 0;

//     for (const [userId, count] of counts) {
//       if (count > topCount) {
//         topUserId = userId;
//         topCount = count;
//       }
//     }

//     if (!topUserId) return;

//     await message.channel.send(
//       `Batch complete! <@${topUserId}> sent the most messages (${topCount}/5).`,
//     );
//   });
// }
