// Contract with the host page. See local/planning/01-architecture.md.
//
// `getPageContext()` is part of the contract but unused in v1 — nothing calls
// it yet. When it is wired in, apply the lessons noted there (opt-in per site,
// a hard size cap, an optional CSS-selector scope) rather than an uncapped
// whole-page dump.
export interface AgentBridge {
  getCurrentPage: () => string;
  navigateTo: (path: string) => void;
  getPageContext: () => Record<string, unknown>;
  getUserToken: () => string | null;
}

declare global {
  interface Window {
    agentBridge?: AgentBridge;
  }
}
