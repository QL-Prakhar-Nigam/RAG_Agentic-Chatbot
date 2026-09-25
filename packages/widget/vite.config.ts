import { defineConfig } from "vite";

// Single-file, zero-dependency IIFE output — embedded via one <script> tag on
// the host page. See local/planning/01-architecture.md's "Widget / embed model".
export default defineConfig({
  build: {
    lib: {
      entry: "src/main.ts",
      name: "RagChatbotWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
