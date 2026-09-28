import { createClient } from "redis";
import { config } from "../config.js";

// Separate from the LangGraph checkpointer's own Redis connection
// (graph/graph.ts) — this is the plain client used for cheap ancillary
// lookups like rate-limit counters (see 04-database-schema.md's Redis key
// namespace).
let client: ReturnType<typeof createClient> | undefined;
let connectPromise: Promise<unknown> | undefined;

export async function getRedisClient() {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on("error", (err) => console.error("Redis client error", err));
  }
  if (!connectPromise) {
    connectPromise = client.connect();
  }
  await connectPromise;
  return client;
}
