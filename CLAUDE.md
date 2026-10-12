# Ohmland: notes for coding agents

Read `docs/ARCHITECTURE.md` (contracts) and `docs/CONTENT.md` (writing and copyright rules) before changing anything.

- `.private/` holds book-derived research notes. It is git-ignored. Never commit it, never copy text from it into
  the repo. Use it only to understand topics, then write original material.
- No em dashes anywhere (code comments, UI, content, docs, commit messages). Run `pnpm lint:copy`.
- Commit messages: plain, imperative, no AI or co-author attribution lines.
- Pin exact dependency versions. Use pnpm. Node 24 (`.nvmrc`).
- UI strings go in `apps/web/src/i18n/en.ts`; raw colours, sizes and durations only in `apps/web/src/styles/tokens.css`.
- Keep tests lean: cover pure logic that is easy to get wrong (simulator, netlists, XP, merge, island determinism)
  and a few end-to-end paths. Do not write tests for trivial UI.
- Heavy modules (three.js, the simulator worker, Firebase) must stay out of the first load of lesson pages.
