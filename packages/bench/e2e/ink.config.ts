/// <reference types="node" />
import { defineConfig } from "@playwright/test";

// The ink view is plain SVG: no WebGL flags needed. Its own port, so it never reuses another playground's server.
const port = 5317;

export default defineConfig({
  testDir: ".",
  testMatch: "ink.e2e.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, headless: true },
  webServer: {
    command: `pnpm exec vite playground --port ${port} --strictPort`,
    cwd: "..",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
