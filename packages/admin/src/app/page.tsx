"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { fetchJson, type Site } from "../lib/api";
import {
  button,
  buttonDisabled,
  card,
  codeChip,
  colors,
  input,
  mutedText,
  pageHeading,
  sectionLabel,
} from "../lib/styles";

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
    <form onSubmit={handleSubmit} style={{ ...card, display: "flex", gap: 10, marginBottom: 28 }}>
      <input
        placeholder="Site name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={busy}
        style={input}
      />
      <input
        placeholder="Allowed origins (comma-separated)"
        value={origins}
        onChange={(e) => setOrigins(e.target.value)}
        required
        disabled={busy}
        style={{ ...input, flex: 1 }}
      />
      <button type="submit" disabled={busy} style={busy ? buttonDisabled : button}>
        {busy ? "Creating..." : "Create site"}
      </button>
      {error && (
        <span style={{ color: colors.danger, fontSize: 13, alignSelf: "center" }}>{error}</span>
      )}
    </form>
  );
}

function SiteCard({ site }: { site: Site }) {
  return (
    <Link
      href={`/sites/${site.id}`}
      style={{
        ...card,
        display: "block",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow .15s, border-color .15s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <strong style={{ fontSize: 15, color: colors.text }}>{site.name}</strong>
        <span style={{ fontSize: 14, color: colors.textFaint }}>→</span>
      </div>
      <code style={codeChip}>{site.id}</code>
      <p style={{ ...mutedText, margin: "8px 0 0" }}>
        {site.allowedOrigins.length > 0 ? site.allowedOrigins.join(", ") : "No allowed origins set"}
      </p>
    </Link>
  );
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reloadSites() {
    fetchJson<Site[]>("/internal/sites")
      .then(setSites)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sites"));
  }

  useEffect(reloadSites, []);

  return (
    <div>
      <h1 style={pageHeading}>Sites</h1>
      <p style={{ ...mutedText, margin: "0 0 24px" }}>
        Create and manage the client&rsquo;s properties. No auth yet — see{" "}
        <code style={{ fontSize: 12 }}>local/planning/06-phased-plan.md</code>.
      </p>

      <CreateSiteForm onCreated={reloadSites} />

      <p style={sectionLabel}>
        {sites?.length ?? 0} site{sites?.length === 1 ? "" : "s"}
      </p>
      {error && <p style={{ color: colors.danger }}>{error}</p>}
      {!sites && !error && <p style={mutedText}>Loading...</p>}
      {sites?.length === 0 && <p style={mutedText}>No sites yet — create one above.</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {sites?.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
      </div>
    </div>
  );
}
