/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Emulator builds only: where the Firebase emulators run (src/account/config.ts). Unset in production. */
  readonly PUBLIC_OHMLAND_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
