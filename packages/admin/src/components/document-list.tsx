"use client";

import { useEffect, useState } from "react";
import { fetchJson, type DocumentSummary } from "../lib/api";
import { colors } from "../lib/styles";

export function DocumentList({
  siteId,
  refreshKey,
}: {
  siteId: string | null;
  refreshKey: number;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
    fetchJson<DocumentSummary[]>(`/internal/documents${query}`)
      .then(setDocuments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"));
  }, [siteId, refreshKey]);

  if (error) return <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>;
  if (!documents)
    return <p style={{ fontSize: 13, color: colors.textFaint }}>Loading documents...</p>;
  if (documents.length === 0) {
    return <p style={{ fontSize: 13, color: colors.textFaint }}>No documents yet.</p>;
  }

  return (
    <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0, color: colors.text }}>
      {documents.map((doc) => (
        <li key={doc.id} style={{ marginBottom: 4 }}>
          {doc.fileName} <span style={{ color: colors.textFaint }}>— {doc.chunkCount} chunks</span>
        </li>
      ))}
    </ul>
  );
}
