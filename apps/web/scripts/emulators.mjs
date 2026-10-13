// Runs one command inside the Firebase Auth and Firestore emulators, then tears them down (`firebase emulators:exec`).
//
//   node scripts/emulators.mjs firestore -- vitest run --config vitest.rules.config.ts      (pnpm test:rules)
//   node scripts/emulators.mjs auth,firestore -- playwright test --config playwright.accounts.config.ts   (pnpm e2e:accounts)
//
// The emulators get their own ports (OHMLAND_EMULATOR_PORT, default 9180: Auth there, Firestore one above, then the
// Firestore websocket, the hub and logging), so a run never collides with `pnpm emulators` on the default ports or with
// another worktree's run. The command gets PUBLIC_OHMLAND_EMULATORS ("auth=127.0.0.1:9180,firestore=127.0.0.1:9181"),
// which an emulator build reads (src/account/config.ts), plus emulators:exec's FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST, which the rules tests and the end-to-end helpers read. The project is `ohmland` in
// single-project mode, as in firebase.json; the emulators never reach the live project.
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const web = fileURLToPath(new URL("..", import.meta.url));
const PROJECT = "ohmland";

const free = (port) =>
  new Promise((resolve) => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });

async function main() {
  const argv = process.argv.slice(2);
  const sep = argv.indexOf("--");
  const only = argv[0];
  const cmd = sep < 0 ? [] : argv.slice(sep + 1);
  if (sep !== 1 || !/^(auth,)?firestore$/.test(only ?? "") || !cmd.length)
    throw new Error("usage: node scripts/emulators.mjs <auth,firestore|firestore> -- <command...>");

  const base = Number(process.env.OHMLAND_EMULATOR_PORT) || 9180;
  const ports = { auth: base, firestore: base + 1, firestoreWs: base + 2, hub: base + 3, logging: base + 4 };
  const taken = [];
  for (const [name, port] of Object.entries(ports)) if (!(await free(port))) taken.push(`${name} ${port}`);
  if (taken.length) throw new Error(`ports in use (another run, or set OHMLAND_EMULATOR_PORT): ${taken.join(", ")}`);

  // The config sits next to firebase.json so `firestore.rules` resolves the same way; it is git-ignored and removed after.
  const config = join(repo, `firebase.emulators-${base}.json`);
  writeFileSync(
    config,
    JSON.stringify(
      {
        firestore: { rules: "firestore.rules" },
        emulators: {
          auth: { host: "127.0.0.1", port: ports.auth },
          firestore: { host: "127.0.0.1", port: ports.firestore, websocketPort: ports.firestoreWs },
          hub: { host: "127.0.0.1", port: ports.hub },
          logging: { host: "127.0.0.1", port: ports.logging },
          ui: { enabled: false },
          singleProjectMode: true,
        },
      },
      null,
      2,
    ),
  );
  const cleanup = () => rmSync(config, { force: true });
  let child;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      child?.kill(signal);
      cleanup();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });

  const hosts = [only.includes("auth") ? `auth=127.0.0.1:${ports.auth}` : "", `firestore=127.0.0.1:${ports.firestore}`].filter(Boolean).join(",");
  const firebase = join(web, "node_modules", ".bin", "firebase");
  // Arguments with spaces or shell characters (a --grep pattern) stay one argument.
  const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replaceAll("'", `'\\''`)}'`);
  try {
    const code = await new Promise((resolve) => {
      // The command runs in apps/web, as a shell string (that is what emulators:exec takes).
      child = spawn(firebase, ["emulators:exec", "--config", config, "--project", PROJECT, "--only", only, `cd "${web}" && ${cmd.map(quote).join(" ")}`], {
        cwd: repo,
        stdio: "inherit",
        env: { ...process.env, PUBLIC_OHMLAND_EMULATORS: hosts },
      });
      child.on("exit", (c) => resolve(c ?? 1));
    });
    process.exitCode = code;
  } finally {
    cleanup();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
