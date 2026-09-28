import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function addScriptTag(attrs: Record<string, string>) {
  const script = document.createElement("script");
  for (const [key, value] of Object.entries(attrs)) {
    script.setAttribute(key, value);
  }
  document.body.appendChild(script);
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function bootWidget(
  attrs: Record<string, string> = { "data-site-id": "site-1", "data-api-base": "http://api.test" }
) {
  addScriptTag(attrs);
  await import("./main.js");
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  sessionStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("widget boot + send flow", () => {
  it("sends a message to /chat and renders the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "Hello from KB", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();

    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "What are your hours?";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    const assistantMessages = document.querySelectorAll(".rcb-msg-assistant");
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].textContent).toBe("Hello from KB");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/chat",
      expect.objectContaining({ method: "POST" })
    );
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(requestInit.body as string);
    expect(body).toEqual({
      message: "What are your hours?",
      siteId: "site-1",
      sessionId: expect.any(String),
    });
  });

  it("reuses the same sessionId across multiple messages in one session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "ok", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    const sendBtn = document.querySelector(".rcb-send") as HTMLButtonElement;

    input.value = "first";
    sendBtn.click();
    await flushPromises();

    input.value = "second";
    sendBtn.click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sessionId1 = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    ).sessionId;
    const sessionId2 = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string
    ).sessionId;
    expect(sessionId1).toBe(sessionId2);
  });

  it("shows an inline error when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "boom" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "hi";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    const error = document.querySelector(".rcb-msg-error");
    expect(error?.textContent).toBe("boom");
  });

  it("resolves apiBase from the script tag's own src origin when data-api-base is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "ok", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // No data-api-base — matches the API now serving this file itself at /widget.js.
    await bootWidget({ "data-site-id": "site-1", src: "http://widget-host.test/widget.js" });
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "hi";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://widget-host.test/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("prefers an explicit data-api-base over the script's src origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "ok", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget({
      "data-site-id": "site-1",
      "data-api-base": "http://explicit-override.test",
      src: "http://widget-host.test/widget.js",
    });
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "hi";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://explicit-override.test/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to the hardcoded dev default when neither data-api-base nor src is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "ok", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget({ "data-site-id": "site-1" }); // no src, no data-api-base
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "hi";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4001/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("still does not boot when data-site-id is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    addScriptTag({ "data-api-base": "http://api.test" }); // no data-site-id
    await import("./main.js");

    expect(document.querySelector(".rcb-toggle")).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("widget transcript persistence (survives a reload)", () => {
  it("persists both sides of a turn to sessionStorage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "Hello from KB", clientActions: [], sessionId: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "What are your hours?";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    expect(JSON.parse(sessionStorage.getItem("rag_chatbot_messages")!)).toEqual([
      { role: "user", content: "What are your hours?" },
      { role: "assistant", content: "Hello from KB" },
    ]);
  });

  it("does not persist a failed turn's error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "boom" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "hi";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    // The user's half of the turn is still real and worth keeping; only the
    // failed assistant side (which errored, not answered) is absent.
    expect(JSON.parse(sessionStorage.getItem("rag_chatbot_messages")!)).toEqual([
      { role: "user", content: "hi" },
    ]);
  });

  it("replays a prior transcript into the DOM on a fresh boot (simulated reload)", async () => {
    sessionStorage.setItem(
      "rag_chatbot_messages",
      JSON.stringify([
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
      ])
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ responseText: "", clientActions: [] }),
        })
    );

    await bootWidget();

    const userMsgs = document.querySelectorAll(".rcb-msg-user");
    const assistantMsgs = document.querySelectorAll(".rcb-msg-assistant");
    expect(userMsgs).toHaveLength(1);
    expect(userMsgs[0].textContent).toBe("first question");
    expect(assistantMsgs).toHaveLength(1);
    expect(assistantMsgs[0].textContent).toBe("first answer");
  });

  it("still reuses the same sessionId across a reload, independent of the transcript", async () => {
    sessionStorage.setItem("rag_chatbot_session_id", "existing-session");
    sessionStorage.setItem(
      "rag_chatbot_messages",
      JSON.stringify([{ role: "user", content: "earlier" }])
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseText: "ok", clientActions: [], sessionId: "existing-session" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootWidget();
    (document.querySelector(".rcb-toggle") as HTMLButtonElement).click();
    const input = document.querySelector(".rcb-input") as HTMLInputElement;
    input.value = "second message";
    (document.querySelector(".rcb-send") as HTMLButtonElement).click();
    await flushPromises();

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sessionId).toBe("existing-session");
  });
});
