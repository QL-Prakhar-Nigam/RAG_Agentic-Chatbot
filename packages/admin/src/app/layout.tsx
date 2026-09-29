import type { ReactNode } from "react";
import { Sidebar } from "../components/sidebar";

export const metadata = {
  title: "RAG Chatbot Admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: 32 }}>
            <div style={{ maxWidth: 840, margin: "0 auto" }}>{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
