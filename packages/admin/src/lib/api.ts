// Talks straight to the API server (cross-origin is fine — its CORS is wide
// open per local/planning/01-architecture.md). No auth on these endpoints
// yet — see local/planning/06-phased-plan.md's Phase 1.5 note.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export interface Site {
  id: string;
  name: string;
  allowedOrigins: string[];
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  createdAt: string;
  chunkCount: number;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function uploadDocument(file: File, siteId: string | null): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file);
  if (siteId) {
    form.append("siteId", siteId);
  }
  return fetchJson<DocumentSummary>("/internal/documents", { method: "POST", body: form });
}
