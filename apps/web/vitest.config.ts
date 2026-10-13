import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Labs import their API as "@ohmland/lab" (the same alias as astro.config.mjs).
    alias: { "@ohmland/lab": fileURLToPath(new URL("./src/lab/define.ts", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
