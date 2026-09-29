"use client";

import { useState } from "react";
import { UploadForm } from "../../components/upload-form";
import { DocumentList } from "../../components/document-list";
import { card, mutedText, pageHeading, sectionLabel } from "../../lib/styles";

export default function GlobalDocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h1 style={pageHeading}>Global Documents</h1>
      <p style={{ ...mutedText, margin: "0 0 24px" }}>
        Shared across every site&rsquo;s retrieval — uploaded with no site selected.
      </p>

      <div style={card}>
        <p style={sectionLabel}>Documents</p>
        <UploadForm siteId={null} onUploaded={() => setRefreshKey((k) => k + 1)} />
        <div style={{ marginTop: 14 }}>
          <DocumentList siteId={null} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
