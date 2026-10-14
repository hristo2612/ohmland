/// <reference types="node" />
import { defineConfig } from "@playwright/test";

// Headless Chromium renders WebGL through Metal on macOS; elsewhere use SwiftShader.
const gl = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
// BENCH_PORT picks another port when several checkouts run their shots at once.
const port = Number(process.env.BENCH_PORT ?? 5299);

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
