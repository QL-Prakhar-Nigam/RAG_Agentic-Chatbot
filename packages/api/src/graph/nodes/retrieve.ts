import { searchKb } from "../../retrieval/kb-search.js";
import type { GraphStateType } from "../state.js";

export async function retrieveNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const kbResults = await searchKb(state.siteId, state.message);
  return { kbResults };
}
