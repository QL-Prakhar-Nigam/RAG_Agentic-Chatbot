// Per-tab conversation transcript, persisted so a page refresh doesn't blank
// the chat window — the backend's own memory (Redis-checkpointed, keyed by
// sessionId) was never the problem; only the *rendered* messages had nowhere
// to survive a reload. Same sessionStorage-replay pattern as a prior system's
// widget, verified against its actual source, scoped down for what we
// actually have: only plain {role, content} turns. That system also allowed
// replaying certain structured "blocks" (rendered client actions) — we have
// none yet (clientActions is always [] today). When Phase 3/6 add real ones
// (navigate, render_items), replaying a stored entry blindly stops being safe
// — sessionStorage is writable by any script on the host page's origin, so a
// stored action is a claim, not a fact. Apply that system's fix then: an
// explicit allowlist of which action types are safe to replay, not "replay
// whatever's stored."

const STORAGE_KEY = "rag_chatbot_messages";

export interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
}

function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

/** Defensive by construction: sessionStorage is writable by any script on the
 * host page's origin, so its contents are a claim, not a fact — malformed or
 * tampered data degrades to an empty transcript rather than throwing. */
export function loadTranscript(): TranscriptEntry[] {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTranscriptEntry) : [];
  } catch {
    return [];
  }
}

export function appendToTranscript(entry: TranscriptEntry): void {
  const current = loadTranscript();
  current.push(entry);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Quota exceeded or storage unavailable — the live UI still works,
    // just without persistence for this (or any later) turn.
  }
}
