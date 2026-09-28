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

const defaultBridge: AgentBridge = {
  getCurrentPage: () => window.location.pathname,
  navigateTo: (path) => {
    window.location.href = path;
  },
  // Trivial stub, not Navigator's page-text-capture logic — nothing calls
  // this yet (see the note above), so there's nothing for a richer default
  // to actually serve.
  getPageContext: () => ({}),
  getUserToken: () => null,
};

// Fills in any method the host page didn't implement, rather than requiring
// a host page to provide the whole contract or none of it.
export function installDefaultBridge(): void {
  if (!window.agentBridge) {
    window.agentBridge = { ...defaultBridge };
    return;
  }
  for (const key of Object.keys(defaultBridge) as (keyof AgentBridge)[]) {
    if (typeof window.agentBridge[key] !== "function") {
      (window.agentBridge as Record<keyof AgentBridge, unknown>)[key] = defaultBridge[key];
    }
  }
}
