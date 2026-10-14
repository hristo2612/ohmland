/// <reference types="node" />
import { defineConfig } from "@playwright/test";

// The microcontroller board in both views. Its own port and its own server, so it never shows another checkout's
// playground.
const gl = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const port = Number(process.env.BENCH_PORT ?? 5363);

export default defineConfig({
  testDir: ".",
  testMatch: "mcu.e2e.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, headless: true, launchOptions: { args: gl } },
  webServer: {
    command: `pnpm exec vite playground --port ${port} --strictPort`,
    cwd: "..",
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
