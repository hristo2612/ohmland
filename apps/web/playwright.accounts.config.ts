import { defineConfig, devices } from "@playwright/test";

/**
 * The account specs (e2e/accounts), against the Firebase Auth and Firestore emulators. Run with `pnpm e2e:accounts`:
 * scripts/emulators.mjs starts the emulators on their own ports and sets PUBLIC_OHMLAND_EMULATORS, so the build below
 * talks to them (apps/web/dist-emulators, never the production dist). One worker: the specs share one emulator.
 */
const PORT = Number(process.env.OHMLAND_ACCOUNTS_PORT ?? 4339);

if (!process.env.PUBLIC_OHMLAND_EMULATORS) throw new Error("Run the account specs with `pnpm e2e:accounts` (the emulators must be up).");

export default defineConfig({
  testDir: "e2e/accounts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx astro build --outDir dist-emulators && npx astro preview --outDir dist-emulators --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
