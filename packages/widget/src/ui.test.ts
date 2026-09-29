import { beforeEach, describe, expect, it } from "vitest";
import { createWidgetUI } from "./ui.js";

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("createWidgetUI message rendering", () => {
  it("renders assistant text as markdown (real anchor elements)", () => {
    const ui = createWidgetUI(() => {});
    ui.appendMessage("assistant", "See [the guide](https://example.com/guide).");

    const a = document.querySelector(".rcb-msg-assistant a.rcb-md-link");
    expect(a).not.toBeNull();
    expect(a!.getAttribute("href")).toBe("https://example.com/guide");
  });

  it("never renders user-typed text as markdown, even if it looks like markdown", () => {
    const ui = createWidgetUI(() => {});
    ui.appendMessage("user", "[click me](https://evil.example.com)");

    const userMsg = document.querySelector(".rcb-msg-user")!;
    expect(userMsg.querySelector("a")).toBeNull();
    expect(userMsg.textContent).toBe("[click me](https://evil.example.com)");
  });

  it("widens the bubble only when the rendered assistant message contains a table", () => {
    const ui = createWidgetUI(() => {});
    ui.appendMessage("assistant", "| A | B |\n|---|---|\n| 1 | 2 |");
    ui.appendMessage("assistant", "Just prose, no table.");

    const bubbles = document.querySelectorAll(".rcb-msg-assistant");
    expect(bubbles[0].classList.contains("rcb-msg-wide")).toBe(true);
    expect(bubbles[1].classList.contains("rcb-msg-wide")).toBe(false);
  });

  it("appendError still renders plain text, not markdown", () => {
    const ui = createWidgetUI(() => {});
    ui.appendError("**not bold** [not a link](https://example.com)");

    const errorMsg = document.querySelector(".rcb-msg-error")!;
    expect(errorMsg.querySelector("a")).toBeNull();
    expect(errorMsg.querySelector("strong")).toBeNull();
    expect(errorMsg.textContent).toBe("**not bold** [not a link](https://example.com)");
  });
});

describe("createWidgetUI panel open/close", () => {
  it("starts closed", () => {
    createWidgetUI(() => {});
    expect(document.querySelector(".rcb-panel")!.classList.contains("rcb-panel-open")).toBe(false);
  });

  it("toggles open and closed on repeated bubble clicks", () => {
    createWidgetUI(() => {});
    const toggle = document.querySelector(".rcb-toggle") as HTMLButtonElement;
    const panel = document.querySelector(".rcb-panel")!;

    toggle.click();
    expect(panel.classList.contains("rcb-panel-open")).toBe(true);
    toggle.click();
    expect(panel.classList.contains("rcb-panel-open")).toBe(false);
  });

  it("closes via the header close button", () => {
    createWidgetUI(() => {});
    const toggle = document.querySelector(".rcb-toggle") as HTMLButtonElement;
    const closeBtn = document.querySelector(".rcb-close") as HTMLButtonElement;
    const panel = document.querySelector(".rcb-panel")!;

    toggle.click();
    expect(panel.classList.contains("rcb-panel-open")).toBe(true);
    closeBtn.click();
    expect(panel.classList.contains("rcb-panel-open")).toBe(false);
  });
});

describe("createWidgetUI input", () => {
  it("sends on Enter but inserts a newline on Shift+Enter", () => {
    const sent: string[] = [];
    createWidgetUI((msg) => sent.push(msg));
    const input = document.querySelector(".rcb-input") as HTMLTextAreaElement;

    input.value = "line one";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, cancelable: true })
    );
    // Shift+Enter must not clear the input or send — a real newline is the
    // browser's own default keydown behavior, only suppressed for plain Enter.
    expect(sent).toEqual([]);
    expect(input.value).toBe("line one");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    expect(sent).toEqual(["line one"]);
    expect(input.value).toBe("");
  });
});
