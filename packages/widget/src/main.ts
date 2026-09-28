import { installDefaultBridge } from "./agent-bridge.js";
import { createWidgetUI } from "./ui.js";
import { sendChatMessage } from "./api.js";

const SESSION_STORAGE_KEY = "rag_chatbot_session_id";

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

// Dev-only last resort, mirroring Navigator's own widget.js fallback
// (http://localhost:8000 there) — matches this repo's default API dev port.
// Only reached when the script has neither an explicit data-api-base nor a
// src the browser resolved to something (e.g. a truly inline script tag).
const FALLBACK_API_BASE = "http://localhost:4001";

function boot(): void {
  installDefaultBridge();

  const scriptEl = document.querySelector("script[data-site-id]") as HTMLScriptElement | null;
  const siteIdAttr = scriptEl?.getAttribute("data-site-id");

  if (!siteIdAttr) {
    console.error("rag-chatbot widget: missing data-site-id on its <script> tag — not starting.");
    return;
  }
  // Reassigned to a definitely-string binding — TS's narrowing of siteIdAttr
  // above doesn't reliably survive into the nested handleSend closure below.
  const siteId: string = siteIdAttr;

  // Explicit attribute wins; otherwise read the API's own origin off the
  // script tag's resolved `src` (the API now serves this file itself at
  // /widget.js — see packages/api/src/index.ts) — the same detection
  // Navigator's widget.js uses. `.src` is the DOM *property*, not
  // getAttribute("src") — the browser resolves it to an absolute URL
  // automatically, so `new URL()` needs no second base argument.
  const apiBase =
    scriptEl?.getAttribute("data-api-base") ??
    (scriptEl?.src ? new URL(scriptEl.src).origin : FALLBACK_API_BASE);

  const sessionId = getOrCreateSessionId();

  async function handleSend(message: string): Promise<void> {
    ui.appendMessage("user", message);
    ui.setLoading(true);
    try {
      // clientActions is always [] today — nothing to render yet (Phase 3 adds `navigate`).
      const response = await sendChatMessage({ apiBase, siteId, sessionId, message });
      ui.appendMessage("assistant", response.responseText);
    } catch (err) {
      ui.appendError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      ui.setLoading(false);
    }
  }

  const ui = createWidgetUI(handleSend);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
