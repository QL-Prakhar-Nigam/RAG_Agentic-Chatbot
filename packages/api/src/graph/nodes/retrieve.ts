import { searchKb } from "../../retrieval/kb-search.js";
import { expandChunks } from "../../retrieval/expand.js";
import { buildTurnContext } from "../../retrieval/context-builder.js";
import { maybeRewriteQuery } from "../../retrieval/query-rewrite.js";
import type { GraphStateType } from "../state.js";

export async function retrieveNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const retrievalQuery = await maybeRewriteQuery(state.message, state.history);
  const kbResults = await searchKb(state.siteId, retrievalQuery);
  const expanded = await expandChunks(kbResults);
  const contextChunks = buildTurnContext(expanded);
  return { kbResults, contextChunks };
}
