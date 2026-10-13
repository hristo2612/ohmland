/// <reference types="node" />
import { defineConfig } from "@playwright/test";

// Headless Chromium renders WebGL through Metal on macOS; elsewhere use SwiftShader.
const gl = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const port = 5299;

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    launchOptions: { args: gl },
  },
  webServer: {
    command: `pnpm exec vite playground --port ${port} --strictPort`,
    cwd: "..",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
