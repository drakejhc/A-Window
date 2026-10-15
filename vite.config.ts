import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so the same build runs from a web server, a published page or the desktop app.
  base: "./",
  plugins: [react()],
  // Modern targets (Electron, current Chrome and Safari), so the CSS minifier keeps the unprefixed
  // backdrop-filter instead of rewriting it to the -webkit- form that Chrome ignores.
  build: { cssTarget: ["chrome120", "safari18", "firefox128"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
