"use client";

import { useState, type FormEvent } from "react";
import { uploadDocument } from "../lib/api";
import { button, buttonDisabled, colors } from "../lib/styles";

export function UploadForm({
  siteId,
  onUploaded,
}: {
  siteId: string | null;
  onUploaded: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(null);
    try {
      const result = await uploadDocument(file, siteId);
      setStatus(`Ingested ${result.chunkCount} chunks.`);
      input.value = "";
      onUploaded();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input type="file" name="file" required disabled={busy} style={{ fontSize: 13 }} />
      <button type="submit" disabled={busy} style={busy ? buttonDisabled : button}>
        {busy ? "Uploading..." : "Upload"}
      </button>
      {status && <span style={{ fontSize: 13, color: colors.textMuted }}>{status}</span>}
    </form>
  );
}
