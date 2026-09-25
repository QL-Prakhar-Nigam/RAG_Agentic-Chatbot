// See local/planning/07-api-contracts.md.
//
// `path` on a `navigate` action always comes from a `SiteRoute` row's own `path`
// column — never text the model composes freely. This is a load-bearing invariant,
// not an implementation detail.
export type ClientAction = { type: "navigate"; path: string; label: string };

// Phase 6, reserved — not implemented, not sent, not read by the widget yet:
// | { type: "render_items"; layout: "list" | "cards" | "table"; items: RenderItem[] };
