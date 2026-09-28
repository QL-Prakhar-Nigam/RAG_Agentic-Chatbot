// Pure DOM construction, zero framework/dependency — matches
// local/planning/01-architecture.md's "vanilla JS IIFE" widget model.
//
// One scoped <style> tag with a class prefix (rcb- = rag-chatbot-bubble) so
// this can't collide with whatever CSS the host page already has. No runtime
// branding yet (Phase 4) — colors here are a fixed placeholder palette, not
// configuration.

const STYLE_ID = "rcb-styles";

const STYLES = `
.rcb-toggle {
  position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: #2563eb; color: #fff; font-size: 24px; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.rcb-panel {
  position: fixed; bottom: 88px; right: 20px; z-index: 2147483000;
  width: 320px; height: 420px; display: flex; flex-direction: column;
  background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  font-family: system-ui, sans-serif; overflow: hidden;
}
.rcb-panel[hidden] { display: none; }
.rcb-header {
  padding: 12px 16px; background: #2563eb; color: #fff; font-weight: 600; font-size: 14px;
}
.rcb-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.rcb-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; white-space: pre-wrap; }
.rcb-msg-user { align-self: flex-end; background: #2563eb; color: #fff; }
.rcb-msg-assistant { align-self: flex-start; background: #f1f1f1; color: #111; }
.rcb-msg-error { align-self: flex-start; background: #fde8e8; color: #b91c1c; }
.rcb-msg-loading { align-self: flex-start; background: #f1f1f1; color: #888; font-style: italic; }
.rcb-input-row { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; }
.rcb-input { flex: 1; padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }
.rcb-send { padding: 8px 14px; border: none; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; font-size: 13px; }
.rcb-send:disabled, .rcb-input:disabled { opacity: 0.6; cursor: default; }
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
  toggle.textContent = "💬";

  const panel = document.createElement("div");
  panel.className = "rcb-panel";
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "rcb-header";
  header.textContent = "Chat";

  const messages = document.createElement("div");
  messages.className = "rcb-messages";

  const inputRow = document.createElement("div");
  inputRow.className = "rcb-input-row";

  const input = document.createElement("input");
  input.className = "rcb-input";
  input.type = "text";
  input.placeholder = "Ask a question...";

  const sendButton = document.createElement("button");
  sendButton.className = "rcb-send";
  sendButton.textContent = "Send";

  inputRow.append(input, sendButton);
  panel.append(header, messages, inputRow);

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  let loadingEl: HTMLElement | null = null;

  function appendMessage(role: "user" | "assistant", text: string): void {
    const el = document.createElement("div");
    el.className = `rcb-msg rcb-msg-${role}`;
    el.textContent = text;
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

  function setLoading(loading: boolean): void {
    input.disabled = loading;
    sendButton.disabled = loading;
    if (loading) {
      loadingEl = document.createElement("div");
      loadingEl.className = "rcb-msg rcb-msg-loading";
      loadingEl.textContent = "Thinking...";
      messages.appendChild(loadingEl);
      messages.scrollTop = messages.scrollHeight;
    } else if (loadingEl) {
      loadingEl.remove();
      loadingEl = null;
    }
  }

  function handleSend(): void {
    const value = input.value.trim();
    if (!value || input.disabled) return;
    input.value = "";
    onSend(value);
  }

  sendButton.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  });

  document.body.append(toggle, panel);

  return { appendMessage, appendError, setLoading };
}
