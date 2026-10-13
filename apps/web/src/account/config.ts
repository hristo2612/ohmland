/**
 * The web app's Firebase config (project `ohmland`). These are public client identifiers, not secrets: every browser
 * that opens the site receives them. What a signed-in learner may read or write is decided by firestore.rules.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCYXt3PaAaCBaM_uWNCvWl3o_QyCaF7CJo",
  authDomain: "ohmland.firebaseapp.com",
  projectId: "ohmland",
  storageBucket: "ohmland.firebasestorage.app",
  messagingSenderId: "284646822017",
  appId: "1:284646822017:web:239a670aaa9a4cf4607d80",
} as const;

export type EmulatorHosts = Partial<Record<"auth" | "firestore", { host: string; port: number }>>;

/**
 * The emulators an emulator build talks to, from PUBLIC_OHMLAND_EMULATORS: "1" for the defaults in firebase.json (Auth
 * on 9099, Firestore on 8080, as `pnpm emulators` starts them), or a list such as
 * "auth=127.0.0.1:9180,firestore=127.0.0.1:9181" (scripts/emulators.mjs, which picks its own ports). Null when unset,
 * which is every production build.
 */
export function emulatorHosts(value: string | undefined): EmulatorHosts | null {
  if (!value) return null;
  if (value === "1") return { auth: { host: "127.0.0.1", port: 9099 }, firestore: { host: "127.0.0.1", port: 8080 } };
  const out: EmulatorHosts = {};
  for (const part of value.split(",")) {
    const match = /^(auth|firestore)=([\w.-]+):(\d+)$/.exec(part.trim());
    if (match) out[match[1] as keyof EmulatorHosts] = { host: match[2] as string, port: Number(match[3]) };
  }
  return out;
}
