/// <reference types="node" />
import { defineConfig } from "@playwright/test";

// The solder station in both views. Headless Chromium renders WebGL through Metal on macOS; elsewhere SwiftShader.
const gl = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const port = Number(process.env.BENCH_PORT ?? 5323);

export default defineConfig({
  testDir: ".",
  testMatch: "solder.e2e.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, headless: true, launchOptions: { args: gl } },
  webServer: {
    command: `pnpm exec vite playground --port ${port} --strictPort`,
    cwd: "..",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
