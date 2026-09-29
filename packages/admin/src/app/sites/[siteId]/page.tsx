"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchJson, type Site } from "../../../lib/api";
import { UploadForm } from "../../../components/upload-form";
import { DocumentList } from "../../../components/document-list";
import { card, codeChip, colors, mutedText, pageHeading, sectionLabel } from "../../../lib/styles";

// No GET /internal/sites/:id endpoint exists (admin-UI-only change — no new
// API surface) — the site is looked up client-side from the same list
// endpoint the root page already uses.
export default function SiteDetailPage() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId;

  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchJson<Site[]>("/internal/sites")
      .then((sites) => setSite(sites.find((s) => s.id === siteId) ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load site"));
  }, [siteId]);

  return (
    <div>
      <Link href="/" style={{ fontSize: 13, color: colors.textMuted, textDecoration: "none" }}>
        ← All sites
      </Link>

      {error && <p style={{ color: colors.danger, marginTop: 16 }}>{error}</p>}
      {site === undefined && !error && <p style={{ ...mutedText, marginTop: 16 }}>Loading...</p>}
      {site === null && !error && (
        <p style={{ ...mutedText, marginTop: 16 }}>No site found with id {siteId}.</p>
      )}

      {site && (
        <>
          <div style={{ marginTop: 12, marginBottom: 24 }}>
            <h1 style={pageHeading}>{site.name}</h1>
            <code style={codeChip}>{site.id}</code>
            <p style={{ ...mutedText, margin: "8px 0 0" }}>
              Allowed origins:{" "}
              {site.allowedOrigins.length > 0 ? site.allowedOrigins.join(", ") : "none set"}
            </p>
          </div>

          <div style={card}>
            <p style={sectionLabel}>Documents</p>
            <UploadForm siteId={site.id} onUploaded={() => setRefreshKey((k) => k + 1)} />
            <div style={{ marginTop: 14 }}>
              <DocumentList siteId={site.id} refreshKey={refreshKey} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
