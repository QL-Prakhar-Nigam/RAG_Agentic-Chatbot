"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "../lib/styles";

const SIDEBAR_WIDTH = 220;

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "9px 14px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        textDecoration: "none",
        color: active ? colors.accent : colors.text,
        background: active ? colors.accentMuted : "transparent",
        marginBottom: 2,
      }}
    >
      {label}
    </Link>
  );
}

// Not a real link — Routes (Phase 3) and Conversation Logs (Phase 5) don't
// exist yet. Shown so the shell has visible room for them, not to imply
// they're clickable.
function NavPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 14px",
        borderRadius: 8,
        fontSize: 14,
        color: colors.textFaint,
        marginBottom: 2,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.textFaint,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: "2px 7px",
          letterSpacing: "0.02em",
        }}
      >
        SOON
      </span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const sitesActive = pathname === "/" || pathname.startsWith("/sites");
  const globalDocsActive = pathname === "/global-documents";

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: "#fff",
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "0 6px", marginBottom: 24 }}>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: colors.text, letterSpacing: "-0.01em" }}
        >
          RAG Chatbot
        </div>
        <div style={{ fontSize: 12, color: colors.textFaint }}>Admin</div>
      </div>

      <nav>
        <NavLink href="/" label="Sites" active={sitesActive} />
        <NavLink href="/global-documents" label="Global Documents" active={globalDocsActive} />
        <NavPlaceholder label="Routes" />
        <NavPlaceholder label="Conversation Logs" />
      </nav>
    </aside>
  );
}
