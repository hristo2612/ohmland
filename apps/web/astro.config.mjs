// Ohmland web app: static Astro site with React islands. See docs/ARCHITECTURE.md.
import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

const contentDir = fileURLToPath(new URL("../../content", import.meta.url));
const labApi = fileURLToPath(new URL("./src/lab/define.ts", import.meta.url));

/** Reloads the dev server's pages when a course file changes, since the loader reads them with fs. */
function watchContent() {
  return {
    name: "ohmland-watch-content",
    configureServer(server) {
      server.watcher.add(contentDir);
      server.watcher.on("change", (file) => {
        if (file.startsWith(contentDir) && !file.endsWith(".ts")) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

export default defineConfig({
  output: "static",
  site: "https://ohmland.web.app",
  trailingSlash: "ignore",
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [watchContent()],
    resolve: {
      alias: { "@ohmland/lab": labApi },
      // The bench package resolves these from its own folder; keep one copy of each.
      dedupe: ["react", "react-dom", "three", "zustand"],
    },
    server: {
      fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
    },
  },
});
