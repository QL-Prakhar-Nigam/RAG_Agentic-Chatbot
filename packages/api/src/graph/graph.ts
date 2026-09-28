import { END, START, StateGraph } from "@langchain/langgraph";
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { config } from "../config.js";
import { GraphAnnotation } from "./state.js";
import { retrieveNode } from "./nodes/retrieve.js";
import { respondNode } from "./nodes/respond.js";

// retrieve → respond only in Phase 1 — no medicalGuard, no navigateCandidates
// yet. See local/planning/03-langgraph-design.md and 06-phased-plan.md.
//
// Redis is the checkpointer (ephemeral, TTL-bound) — see 03-langgraph-design.md
// on why this is a deliberate v1 choice, not a corner cut, and why it's a
// single backend (Postgres's ConversationLog is a separate archive, not a
// second checkpointer — added when /chat writes conversation logs).
let graphPromise: ReturnType<typeof buildGraph> | undefined;

async function buildGraph() {
  const checkpointer = await RedisSaver.fromUrl(config.redisUrl);

  return new StateGraph(GraphAnnotation)
    .addNode("retrieve", retrieveNode)
    .addNode("respond", respondNode)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "respond")
    .addEdge("respond", END)
    .compile({ checkpointer });
}

export function getGraph() {
  if (!graphPromise) {
    graphPromise = buildGraph();
  }
  return graphPromise;
}
