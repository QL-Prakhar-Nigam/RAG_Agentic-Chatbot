"use client";

import { useEffect, useState, type FormEvent } from "react";

// Talks straight to the API server (cross-origin is fine — its CORS is wide
// open per local/planning/01-architecture.md). No auth on these endpoints
// yet — see local/planning/06-phased-plan.md's Phase 1.5 note.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

interface Site {
  id: string;
  name: string;
  allowedOrigins: string[];
  createdAt: string;
}

interface DocumentSummary {
  id: string;
  fileName: string;
  createdAt: string;
  chunkCount: number;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

async function uploadDocument(file: File, siteId: string | null): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file);
  if (siteId) {
    form.append("siteId", siteId);
  }
  return fetchJson<DocumentSummary>("/internal/documents", { method: "POST", body: form });
}

function UploadForm({ siteId, onUploaded }: { siteId: string | null; onUploaded: () => void }) {
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
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="file" name="file" required disabled={busy} />
      <button type="submit" disabled={busy}>
        {busy ? "Uploading..." : "Upload"}
      </button>
      {status && <span style={{ fontSize: 13, color: "#555" }}>{status}</span>}
    </form>
  );
}

function DocumentList({ siteId, refreshKey }: { siteId: string | null; refreshKey: number }) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
    fetchJson<DocumentSummary[]>(`/internal/documents${query}`)
      .then(setDocuments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"));
  }, [siteId, refreshKey]);

  if (error) return <p style={{ color: "#b00", fontSize: 13 }}>{error}</p>;
  if (!documents) return <p style={{ fontSize: 13, color: "#777" }}>Loading documents...</p>;
  if (documents.length === 0)
    return <p style={{ fontSize: 13, color: "#777" }}>No documents yet.</p>;

  return (
    <ul style={{ fontSize: 13, paddingLeft: 18 }}>
      {documents.map((doc) => (
        <li key={doc.id}>
          {doc.fileName} — {doc.chunkCount} chunks
        </li>
      ))}
    </ul>
  );
}

function SiteCard({ site }: { site: Site }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{site.name}</strong>
        <code style={{ fontSize: 12, background: "#f2f2f2", padding: "2px 6px", borderRadius: 4 }}>
          {site.id}
        </code>
      </div>
      <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>
        Allowed origins: {site.allowedOrigins.join(", ")}
      </p>
      <UploadForm siteId={site.id} onUploaded={() => setRefreshKey((k) => k + 1)} />
      <div style={{ marginTop: 8 }}>
        <DocumentList siteId={site.id} refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function CreateSiteForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const allowedOrigins = origins
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    setBusy(true);
    setError(null);
    try {
      await fetchJson("/internal/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, allowedOrigins }),
      });
      setName("");
      setOrigins("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
      <input
        placeholder="Site name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={busy}
      />
      <input
        placeholder="Allowed origins (comma-separated)"
        value={origins}
        onChange={(e) => setOrigins(e.target.value)}
        required
        disabled={busy}
        style={{ flex: 1 }}
      />
      <button type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create site"}
      </button>
      {error && <span style={{ color: "#b00", fontSize: 13 }}>{error}</span>}
    </form>
  );
}

export function SitesDashboard() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalRefreshKey, setGlobalRefreshKey] = useState(0);

  function reloadSites() {
    fetchJson<Site[]>("/internal/sites")
      .then(setSites)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sites"));
  }

  useEffect(reloadSites, []);

  return (
    <div
      style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}
    >
      <h1>RAG Chatbot Admin</h1>
      <p style={{ color: "#777", fontSize: 13 }}>
        Phase 1.5 slice — site creation + document upload only. No auth yet; route management and
        conversation logs land in Phase 5.
      </p>

      <h2>Create a site</h2>
      <CreateSiteForm onCreated={reloadSites} />

      <h2>Sites</h2>
      {error && <p style={{ color: "#b00" }}>{error}</p>}
      {!sites && !error && <p>Loading...</p>}
      {sites?.length === 0 && <p>No sites yet — create one above.</p>}
      {sites?.map((site) => (
        <SiteCard key={site.id} site={site} />
      ))}

      <h2>Global documents</h2>
      <p style={{ fontSize: 13, color: "#666" }}>
        Shared across every site's retrieval (uploaded with no site selected).
      </p>
      <UploadForm siteId={null} onUploaded={() => setGlobalRefreshKey((k) => k + 1)} />
      <div style={{ marginTop: 8 }}>
        <DocumentList siteId={null} refreshKey={globalRefreshKey} />
      </div>
    </div>
  );
}
