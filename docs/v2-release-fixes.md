# V2 reliability and startup changes — September 8, 2026

Implementation is on `codex/v2-offline-startup-fixes`, based on `910790625b4e`. The application changes have not been deployed. The separate server backup correction described below is already applied.

## Returning to a saved board

The account profile and editing controls are restored from IndexedDB. The communication board becomes usable as soon as its saved JSON is read; neither account validation nor a board request blocks that render. The normal launch restores the last valid page, sentence, and scroll position. Explicit legacy page links take precedence, with Home as the fallback for deleted pages. Every launch starts in communication mode; missing access controls keep editing disabled.

Account validation and conditional board GETs run afterward. The server checks access and lightweight version metadata before answering `304 Not Modified`, without fetching the JSON column. Changed boards arrive in the same request. ETags are separate cache metadata; no database migration or content-hashing job is required. Existing clients can still use `/sync-check` and unconditional `/blob`.

Noncritical routes, dialogs, and editor panels load separately. Service-worker precaches retain the releases used by live windows, so a newly activated worker can still serve an older page's deferred editor chunks. Static chunks for the installed release are precached for offline use.

## Editing and data protection

- Set as Home is available in Manage Pages. Rename/delete behavior uses the actual Home ID, and deleting a page removes its dangling navigation links.
- Unfinished edits persist as a separate draft. Opening the app shows the committed board; entering the gated editor recovers the draft. Save commits it; Discard removes it. Background sync sends only committed copies.
- Local writes are ordered, and revision reconciliation preserves edits made during an in-flight save. Delayed loads/revalidation cannot replace a different board or new local edits.
- PostgreSQL row locks cover the version check and write. Concurrent full-board saves have one winner and one explicit conflict. Timestamps advance even within the same millisecond or after clock rollback.
- Image optimization applies URL replacements to the latest locked board, preserving edits made during image processing.
- Signing out removes device boards, drafts, resume state, and private image caches. Clearing the download cache retains drafts and unsynced changes. Storage failures are surfaced without turning successful online image responses into broken images.
- Dialog timers no longer dismiss a newly opened dialog. Status banners occupy layout space instead of intercepting board controls.

## Offline images

Every saved board's tile images download in the background into a dedicated cache, without the old shared 200-image cap. Downloads use three concurrent requests and CORS responses to avoid opaque-response storage padding. The header reports progress or incomplete downloads and supports retry. Existing images stay usable when quota is exhausted. V2's real media host already permits CORS GETs; no bucket configuration was changed.

This is subject to available device storage and browser eviction. Imported third-party image hosts that do not allow CORS remain usable online but may not complete the offline download. Installed-device testing should include any such boards.

## Backups already applied

On `ssh archer`, `/usr/local/bin/pg-backup.sh` now includes `freespeech_v2` in the existing daily 09:00 UTC job. A pre-change copy is at `/usr/local/bin/pg-backup.sh.before-v2-20260908`. The existing rotation policy is unchanged.

A fresh `/var/backups/postgresql/freespeech_v2_2026-09-08.dump` was restored successfully into a temporary database; all 11 boards were present. The temporary database was removed. `/root/AGENTS.md` records the new coverage. No original-app data was migrated or altered.

## Verification and release

Run `bun run test:client` and `bun test server/src/utils/prepare-speech-text.test.ts` for the unit tests. Run `bun run test:e2e` for production-build browser tests with synthetic accounts and a local fixture API. The test build uses `client/dist-e2e` so the regular production build stays separate. Install test browsers with `bunx playwright install chromium webkit` first.

The integration test intentionally refuses non-local or non-test databases. Provision a local PostgreSQL database named `freespeech_v2_test`, push the existing Prisma schema to that database, and run:

```sh
DATABASE_URL=postgresql://postgres@127.0.0.1:55436/freespeech_v2_test JWT_SECRET=local-test-only bun run test:sync
```

Verification: 36 unit tests and 4 PostgreSQL integration tests pass. Browser verification passes 18 cases, with two Chromium-only service-worker cases skipped in WebKit. Client production build and server `tsc --noEmit` checks pass. Biome reports existing accessibility warnings in touched legacy UI; no errors. Browser tests exercise held API responses, saved page/sentence/scroll restoration, deep links, draft recovery, Home selection, storage quota failures, 230 offline images, and older deferred chunks. Full service-worker offline navigation and takeover tests run in Chromium: [Playwright supports service-worker automation only in Chromium](https://playwright.dev/docs/service-workers).

On this Mac, a synthetic cached 230-page board appeared in tens of milliseconds while all API responses were held. This establishes that the API is no longer on the critical path; it is not a physical iPad launch-time measurement.

Before deploying, use the test iPad to check an installed launch after force-quit, airplane-mode speech and images on an unvisited page, resumed scroll/sentence, PIN entry, drag/drop, recovered draft Save/Discard, and an app update with an open editor. Deploy application changes using the repository's `deploy.sh` after they are merged to main. There are no schema changes in this branch.

This pass covers the V2 web release. Native packaging, Apple sign-in, account deletion including shared-media cleanup, final store privacy disclosures, store enrollment, and original-to-V2 migration remain separate release work. The privacy/terms routes now provide working links to the existing published policies and explain V2's local storage behavior; they are not a replacement for updated store policies.
