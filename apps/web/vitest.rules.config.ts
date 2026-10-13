import { defineConfig } from "vitest/config";

/**
 * The Firestore rules, tested against the emulator. Run with `pnpm test:rules`, which starts the emulator through
 * `firebase emulators:exec` (scripts/emulators.mjs) and sets FIRESTORE_EMULATOR_HOST for the tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["rules/**/*.test.ts"],
    // One emulator, one project: test files share it, so they run one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
