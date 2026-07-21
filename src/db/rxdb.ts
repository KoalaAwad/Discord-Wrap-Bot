import { createRxDatabase, type RxCollection, type RxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";

export type StatsDoc = {
  id: string;
  payload: Record<string, unknown>;
  updatedAt: number;
};

const statsSchema = {
  title: "stats",
  version: 0,
  type: "object",
  primaryKey: "id",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    payload: {
      type: "object",
      additionalProperties: true,
    },
    updatedAt: {
      type: "number",
    },
  },
  required: ["id", "payload", "updatedAt"],
} as const;

export type StatsCollection = RxCollection<StatsDoc>;

export async function createDatabase(): Promise<
  RxDatabase<{ stats: StatsCollection }>
> {
  const db = await createRxDatabase({
    name: "wrapbot",
    storage: getRxStorageMemory(),
  });

  await db.addCollections({
    stats: {
      schema: statsSchema,
    },
  });

  return db;
}
