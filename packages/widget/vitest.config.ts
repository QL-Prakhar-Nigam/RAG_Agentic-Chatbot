import { defineConfig } from "vitest/config";

// Separate from vite.config.ts deliberately — that file's `build.lib` config
// is for the real IIFE bundle, unrelated to how tests run.
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
