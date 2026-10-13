# Accounts and cloud sync

Accounts are optional. A guest keeps everything on the device; signing in with Google or GitHub syncs the learner record
to one Firestore document so progress follows the learner across devices. This file covers the one-time console setup
(the parts the Firebase CLI cannot do), local development with the emulators, and how the pieces fit.

Firebase project: `ohmland` (`.firebaserc`). The web app's config in `apps/web/src/account/config.ts` is public by
design; what a signed-in learner may read or write is decided by `firestore.rules`.

## One-time setup in the Firebase console (owner)

Already done from the CLI: the Firestore database `(default)` in `eur3` (Europe), and the security rules
(`firestore.rules`) deployed. Everything below has to be done by hand once.

### 1. Turn on Google sign-in

1. Open <https://console.firebase.google.com/project/ohmland/authentication>. If Authentication was never opened, click
   **Get started**.
2. **Sign-in method** tab, **Add new provider**, **Google**.
3. Switch **Enable** on, pick the project support email, **Save**.

### 2. Turn on GitHub sign-in

1. On GitHub, open <https://github.com/settings/developers> (or the organisation's settings, Developer settings),
   **OAuth Apps**, **New OAuth App**:
   - Application name: `Ohmland`
   - Homepage URL: `https://ohmland.web.app`
   - Authorization callback URL: `https://ohmland.firebaseapp.com/__/auth/handler`
2. **Register application**. Copy the **Client ID**, then **Generate a new client secret** and copy it (GitHub shows it
   once).
3. Back in Firebase, **Authentication**, **Sign-in method**, **Add new provider**, **GitHub**. Switch **Enable** on,
   paste the Client ID and the Client secret, check that the callback URL Firebase shows is the one above, **Save**.

### 3. Authorized domains

**Authentication**, **Settings**, **Authorized domains**. The list must hold:

- `localhost` (local development; there by default)
- `ohmland.firebaseapp.com` and `ohmland.web.app` (there by default)
- later, the custom domain, when there is one (and see "Redirect sign-in" under Known gaps).

### 4. Leave account linking on its default

**Authentication**, **Settings**, **User account linking**: keep **Link accounts that use the same email**. When someone
who signed up with Google tries GitHub with the same email, the app explains it, asks them to continue with Google, and
links GitHub to that account in the same visit.

### 5. Optional hardening

- Google Cloud console, **APIs and services**, **Credentials**: restrict the browser API key to the HTTP referrers
  `https://ohmland.web.app/*`, `https://ohmland.firebaseapp.com/*` and `http://localhost/*` (add the custom domain later).
- If the project moves to the Blaze plan, add a budget alert. The rules already cap what one account can store (below).

Until steps 1 and 2 are done, the sign-in buttons say that the provider "is not switched on yet"; nothing else breaks.

## Redeploying the rules

```sh
pnpm --filter @ohmland/web test:rules      # first: the rules tests on the emulator
pnpm --filter @ohmland/web deploy:rules    # firebase deploy --only firestore:rules --project ohmland
```

The Firebase CLI is a pinned dev dependency of `apps/web` (`firebase-tools`), so these use that version, not a global
one. Log in once with `pnpm --filter @ohmland/web exec firebase login`. Hosting is not deployed from here yet.

## Local development with the emulators

Needs Java 21 or newer (`java -version`) for the Auth and Firestore emulators.

```sh
pnpm emulators                                        # Auth 9099, Firestore 8080, Hosting 5002 (firebase.json)
PUBLIC_OHMLAND_EMULATORS=1 pnpm dev                   # in another terminal: the dev site talks to the emulators
```

With `PUBLIC_OHMLAND_EMULATORS` set, the app connects Auth and Firestore to the emulators (`src/account/config.ts`;
`1` means the default ports above, or give hosts: `auth=127.0.0.1:9180,firestore=127.0.0.1:9181`). The buttons then
open the Auth emulator's sign-in page, where you add a fake Google or GitHub user. Without the variable, a build always
talks to the live project, including one served by the Hosting emulator, so build with the variable before serving
`apps/web/dist` from it.

Tests that use the emulators start their own, on separate ports (9180 and up, `OHMLAND_EMULATOR_PORT` to move them), so
they can run next to `pnpm emulators`:

```sh
pnpm test:rules      # firestore.rules on the Firestore emulator (apps/web/rules)
pnpm e2e:accounts    # emulator build in apps/web/dist-emulators, then the account specs (apps/web/e2e/accounts)
OHMLAND_SHOTS=/tmp/shots pnpm e2e:accounts --grep screenshots   # /account signed out, asked, signed in
```

The account specs need the internet: the Auth emulator's sign-in page loads its styles from unpkg.com and Google's
iframe library from apis.google.com.

## How it works

- **Loading.** Firebase (Auth and Firestore Lite, about 56 KB gzipped) is a dynamic import. It loads on `/account`, and
  on any page of a device that is signed in: `src/account/boot.ts` runs on every page and checks one localStorage key
  (`ohmland:signed-in`) before importing anything, then waits for the page to be idle. A guest never downloads it.
- **Signing in.** A popup; when the browser blocks it, or in an iOS home-screen app, a redirect instead. After sign-in
  the cloud copy is read once. If the device holds progress that may not be this account's (it was last joined to
  another account, or it holds guest progress and the account already has its own), the learner is asked: add it to
  the account, or use the account's progress. A guest signing in to a new account is not asked. Closing the question
  signs out and changes nothing.
- **Syncing.** `src/account/sync.ts` implements `ProgressSync` (`src/progress/sync.ts`). Changes go out once they pause
  for about two seconds; each write reads the cloud copy and merges it in (`mergeLearners`, in a transaction), so
  nothing another device added is lost, and what the cloud had that the device lacked comes back to the device.
  Offline, changes wait and go when the browser is back (failed writes retry after 5 s, 20 s, 1 min, then every 5 min).
  A page that is hidden sends what waits at once; a page that is closing sends it with a keepalive request.
- **Signing out** keeps the device's progress. **Delete account** deletes the cloud document and the Firebase user
  (confirming with the provider first when the last sign-in is more than a few minutes old) and keeps the device's
  progress. **Export progress** downloads the device's record, which includes everything the account holds.

### The document: `learners/{uid}`

```
v             1
lessons       { "<lessonId>": "<at>|<version>|<firstTry>|<items>|<task>,<task>" }   at most 2000, 256,000 characters
achievements  { "<achievementId>": "<at>" }                                         at most 500
fried         [ "<at>|<kind>|<lessonId or empty>|<label>" ]                         at most 500, label at most 80
sandbox       { "<saveId>": "<one line of JSON: { name, at, bench }>" }             at most 50, 256,000 characters
settings      { muted: bool, reducedMotion: "system"|"on"|"off", theme: "system"|"light"|"dark" }
updatedAt     "<at>"
```

Times are ISO strings as `Date#toISOString` writes them. Entries are packed into strings because Firestore rules cannot
loop over a map or a list: the rules join a collection's strings and match them all at once, so every byte is checked.
`inProgress` (half-done lessons) never leaves the device: it changes on every step, holds arbitrary answer values the
rules could not check, and resuming a ten-minute lesson elsewhere is worth little. Anything that does not fit an id
pattern or a cap stays on the device rather than failing the write. `apps/web/src/account/remote.ts` packs and unpacks.

### The rules, in short

- Only `learners/{uid}` exists. Its owner may get, create, update and delete it; nobody may list the collection or touch
  anything else. The account must be a Google or GitHub one (an anonymous or email account, if those were ever turned
  on, gets nothing).
- A write must have exactly the keys above, `v == 1`, ISO times, kebab-case lesson and achievement ids (at most 80
  characters), known settings values, and every collection within its caps. The biggest document the app can write is
  well under Firestore's 1 MiB, so one free account cannot use the database as storage.
- `apps/web/rules/learners.rules.test.ts` holds each bound; its valid documents come from the app's own packer.

## Known gaps

- **Deleting progress is not a tombstone.** "Delete all progress" while signed in clears this device and the cloud copy,
  but another signed-in device that still holds the progress adds it back the next time it syncs. Deleting the account
  is final.
- **Settings follow the most recently active device** (the merge takes the settings of the newer record).
- **Redirect sign-in across domains.** The fallback redirect uses `ohmland.firebaseapp.com` while the app runs on
  `ohmland.web.app`; browsers that block third-party storage (Safari, Firefox strict mode) can lose the result. Popups
  are the main path and work everywhere. With a custom domain on Firebase Hosting, set `authDomain` to it and add
  `https://<domain>/__/auth/handler` as an OAuth callback (Google OAuth client; and the GitHub OAuth App's callback URL).
- **Linking a second provider** happens only in the visit where the "other provider" message appeared.
- **Account deletion is client-side.** If the Firebase user cannot be deleted after the document was (a network
  failure), the page says so and the learner can try again.

## The web API key

The Firebase web config in `apps/web/src/account/config.ts` includes an API key. It is public by design: every Firebase
web app ships it to the browser, and access is enforced by the Firestore rules and Auth's authorized domains, not by the
key. GitHub secret scanning flags it anyway; that alert was reviewed and closed.

The key is still restricted in Google Cloud (APIs and Services, Credentials, "Browser key (auto created by Firebase)"):

- Websites: `https://ohmland.web.app/*`, `https://ohmland.firebaseapp.com/*`, `http://localhost:4321/*`,
  `http://localhost:4322/*`, `http://localhost:5002/*`, `http://127.0.0.1:4321/*`, plus each preview channel host
  that needs sign-in (for example `https://ohmland--milestone-1-wgev2cm6.web.app/*`).
- APIs: Identity Toolkit, Token Service, Cloud Firestore, Firebase Installations, Firebase App Check.

When you deploy a new preview channel or add a custom domain, add its host to the key's website list and to Auth's
authorized domains, or sign-in will fail there.
