// Small set of shared style values — plain inline styles throughout this
// package (no Tailwind/icon library, matching the widget's own zero-new-
// dependency approach), so the handful of files that need consistent
// card/shadow/color treatment aren't each guessing their own values.
import type { CSSProperties } from "react";

export const colors = {
  accent: "#2563eb",
  accentMuted: "#eff6ff",
  text: "#1e293b",
  textMuted: "#64748b",
  textFaint: "#94a3b8",
  border: "#e2e8f0",
  bg: "#f8fafc",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
};

export const card: CSSProperties = {
  background: "#fff",
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
  padding: 20,
};

export const pageHeading: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: colors.text,
  letterSpacing: "-0.02em",
  margin: "0 0 4px",
};

export const sectionLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "0 0 12px",
};

export const mutedText: CSSProperties = {
  fontSize: 13,
  color: colors.textMuted,
};

export const codeChip: CSSProperties = {
  fontSize: 12,
  fontFamily: "monospace",
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  padding: "3px 8px",
  borderRadius: 6,
  color: colors.text,
};

export const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  borderRadius: 8,
  background: colors.accent,
  color: "#fff",
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export const buttonDisabled: CSSProperties = {
  ...button,
  opacity: 0.6,
  cursor: "default",
};

export const input: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontFamily: "inherit",
  color: colors.text,
};
