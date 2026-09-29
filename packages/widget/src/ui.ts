// Pure DOM construction, zero framework/dependency — matches
// local/planning/01-architecture.md's "vanilla JS IIFE" widget model.
//
// One scoped <style> tag with a class prefix (rcb- = rag-chatbot-bubble) so
// this can't collide with whatever CSS the host page already has. No runtime
// branding yet (Phase 4) — colors here are a fixed placeholder palette, not
// configuration.
//
// Visual design matches a prior system's widget shell (verified against its
// actual source), deliberately scoped down: no welcome message (one of our
// own architecture docs' own rules is that status/loading copy must come
// from Site.personality, never be hardcoded — we have no site-config wiring
// yet), no dynamic title/branding, and none of that system's forms/
// file-upload/branch-button/CTA chrome — those belong to features (Phase
// 3/8) this widget doesn't have.

import { renderMarkdown } from "./markdown.js";

const STYLE_ID = "rcb-styles";

// Standard outline-icon shapes (chat bubble / close / send / bot), not
// proprietary assets — static markup, never interpolated with dynamic data.
const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SEND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const BOT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="3" x2="12" y2="7"/></svg>';

const STYLES = `
.rcb-toggle {
  position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
  width: 56px; height: 56px; border-radius: 50%; border: none; padding: 0;
  background: #2563eb; cursor: pointer;
  box-shadow: 0 4px 16px rgba(37,99,235,.4);
  display: flex; align-items: center; justify-content: center;
  transition: transform .15s, box-shadow .15s;
}
.rcb-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(37,99,235,.4); }
.rcb-toggle svg { color: #fff; width: 26px; height: 26px; }

.rcb-panel {
  position: fixed; bottom: 92px; right: 24px; z-index: 2147483647;
  width: 380px; height: 680px; max-height: calc(100vh - 116px);
  background: #fff; border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
  display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px; line-height: 1.5; color: #1e293b;
  transform-origin: bottom right;
  transition: opacity .2s, transform .2s;
  opacity: 0; transform: scale(.95); pointer-events: none;
}
.rcb-panel-open { opacity: 1; transform: scale(1); pointer-events: auto; }

.rcb-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: #2563eb; color: #fff; flex-shrink: 0;
}
.rcb-header-left { display: flex; align-items: center; gap: 10px; }
.rcb-avatar {
  width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rcb-avatar svg { color: #fff; width: 18px; height: 18px; }
.rcb-title { font-weight: 600; font-size: 15px; }
.rcb-close {
  background: none; border: none; color: #fff; cursor: pointer;
  padding: 6px; border-radius: 8px; opacity: .8; line-height: 0;
  transition: opacity .1s, background .1s;
}
.rcb-close:hover { opacity: 1; background: rgba(255,255,255,.15); }
.rcb-close svg { width: 18px; height: 18px; }

.rcb-messages {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
  background: #f8fafc; scroll-behavior: smooth;
}
.rcb-messages::-webkit-scrollbar { width: 4px; }
.rcb-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

.rcb-msg {
  max-width: 82%; padding: 10px 14px; border-radius: 16px;
  word-break: break-word; white-space: pre-wrap; font-size: 14px;
}
.rcb-msg-user {
  align-self: flex-end; background: #2563eb; color: #fff;
  border-bottom-right-radius: 4px;
}
.rcb-msg-assistant {
  align-self: flex-start; background: #fff; color: #1e293b;
  border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08);
  white-space: normal;
}
.rcb-msg-assistant p { margin: 0 0 6px; }
.rcb-msg-assistant p:last-child { margin-bottom: 0; }
.rcb-msg-error {
  align-self: flex-start; background: #fef2f2; color: #dc2626;
  border-bottom-left-radius: 4px; font-size: 13px;
}

/* Rendered markdown inside an assistant bubble (markdown.ts). */
.rcb-md-ul, .rcb-md-ol { margin: 4px 0 6px; padding-left: 18px; }
.rcb-md-ul:last-child, .rcb-md-ol:last-child { margin-bottom: 0; }
.rcb-md-ul li, .rcb-md-ol li { margin-bottom: 2px; }
.rcb-md-h1 { font-weight: 700; font-size: 15px; margin: 0 0 4px; }
.rcb-md-h2 { font-weight: 700; font-size: 14px; margin: 0 0 4px; }
.rcb-md-h3 { font-weight: 600; font-size: 13px; margin: 0 0 3px; }
.rcb-code { background: #e2e8f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; font-family: monospace; }
.rcb-md-link { color: #2563eb; text-decoration: underline; word-break: break-word; }
.rcb-md-link:hover { filter: brightness(.85); }

/* Tables scroll inside their own container — the panel body must never
   scroll horizontally, and a wide table won't fit the panel width. */
.rcb-table-wrap { overflow-x: auto; margin: 4px 0 6px; -webkit-overflow-scrolling: touch; }
.rcb-table-wrap:last-child { margin-bottom: 0; }
.rcb-table { border-collapse: collapse; font-size: 12.5px; }
.rcb-table th, .rcb-table td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
.rcb-table th { background: #e2e8f0; font-weight: 600; }
.rcb-table tbody tr:nth-child(even) td { background: #f8fafc; }
/* A bubble holding a table gets more of the panel width than prose does. */
.rcb-msg-wide { max-width: 96%; }

.rcb-loading {
  display: none; align-items: center; gap: 6px;
  padding: 4px 16px 10px; background: #f8fafc; flex-shrink: 0;
}
.rcb-loading-visible { display: flex; }
.rcb-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;
  animation: rcb-bounce .9s infinite ease-in-out;
}
.rcb-dot:nth-child(2) { animation-delay: .15s; }
.rcb-dot:nth-child(3) { animation-delay: .3s; }
@keyframes rcb-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: .4; }
  40% { transform: translateY(-5px); opacity: 1; }
}

.rcb-footer {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 12px; border-top: 1px solid #e2e8f0; background: #fff; flex-shrink: 0;
}
.rcb-input {
  flex: 1; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 10px 14px; font-size: 14px; font-family: inherit;
  resize: none; outline: none; height: 42px; max-height: 120px;
  overflow-y: auto; line-height: 1.4; color: #1e293b; background: #f8fafc;
  transition: border-color .15s, background .15s; box-sizing: border-box;
}
.rcb-input:focus { border-color: #93c5fd; background: #fff; }
.rcb-input::placeholder { color: #94a3b8; }
.rcb-input:disabled { opacity: .6; cursor: not-allowed; }

.rcb-send {
  width: 42px; height: 42px; border-radius: 10px; background: #2563eb;
  border: none; cursor: pointer; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0; transition: filter .15s; padding: 0;
}
.rcb-send:hover:not(:disabled) { filter: brightness(.92); }
.rcb-send:disabled { opacity: .5; cursor: not-allowed; }
.rcb-send svg { color: #fff; width: 18px; height: 18px; }

@media (max-width: 440px) {
  .rcb-panel { width: 100vw; height: 100dvh; bottom: 0; right: 0; border-radius: 0; }
  .rcb-toggle { bottom: 16px; right: 16px; }
}
`;

function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export interface WidgetUIHandle {
  appendMessage(role: "user" | "assistant", text: string): void;
  appendError(text: string): void;
  setLoading(loading: boolean): void;
}

export function createWidgetUI(onSend: (message: string) => void): WidgetUIHandle {
  injectStylesOnce();

  const toggle = document.createElement("button");
  toggle.className = "rcb-toggle";
  toggle.setAttribute("aria-label", "Open chat");
  toggle.innerHTML = CHAT_ICON;

  const panel = document.createElement("div");
  panel.className = "rcb-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat");

  const header = document.createElement("div");
  header.className = "rcb-header";
  header.innerHTML = `
    <div class="rcb-header-left">
      <div class="rcb-avatar">${BOT_ICON}</div>
      <div class="rcb-title">Chat</div>
    </div>
    <button class="rcb-close" aria-label="Close chat">${CLOSE_ICON}</button>
  `;

  const messages = document.createElement("div");
  messages.className = "rcb-messages";
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");

  const loading = document.createElement("div");
  loading.className = "rcb-loading";
  loading.innerHTML =
    '<div class="rcb-dot"></div><div class="rcb-dot"></div><div class="rcb-dot"></div>';

  const footer = document.createElement("div");
  footer.className = "rcb-footer";

  const input = document.createElement("textarea");
  input.className = "rcb-input";
  input.placeholder = "Ask a question...";
  input.rows = 1;
  input.setAttribute("aria-label", "Message");

  const sendButton = document.createElement("button");
  sendButton.className = "rcb-send";
  sendButton.setAttribute("aria-label", "Send");
  sendButton.innerHTML = SEND_ICON;

  footer.append(input, sendButton);
  panel.append(header, messages, loading, footer);

  function setOpen(open: boolean): void {
    panel.classList.toggle("rcb-panel-open", open);
  }

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("rcb-panel-open")));
  header.querySelector(".rcb-close")!.addEventListener("click", () => setOpen(false));

  function appendMessage(role: "user" | "assistant", text: string): void {
    const el = document.createElement("div");
    el.className = `rcb-msg rcb-msg-${role}`;
    if (role === "assistant") {
      // Only the model's own text is markdown-rendered — user input stays
      // plain textContent, never parsed as markup. See markdown.ts.
      const html = renderMarkdown(text);
      el.innerHTML = html;
      el.classList.toggle("rcb-msg-wide", html.includes("rcb-table-wrap"));
    } else {
      el.textContent = text;
    }
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendError(text: string): void {
    const el = document.createElement("div");
    el.className = "rcb-msg rcb-msg-error";
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function setLoading(isLoading: boolean): void {
    input.disabled = isLoading;
    sendButton.disabled = isLoading;
    loading.classList.toggle("rcb-loading-visible", isLoading);
    if (isLoading) messages.scrollTop = messages.scrollHeight;
  }

  function handleSend(): void {
    const value = input.value.trim();
    if (!value || input.disabled) return;
    input.value = "";
    input.style.height = "42px";
    onSend(value);
  }

  sendButton.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    // Shift+Enter inserts a newline (a real textarea can hold one); plain
    // Enter sends — matches the prior system's own input this was modeled on.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "42px";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  document.body.append(toggle, panel);

  return { appendMessage, appendError, setLoading };
}
