# FreeSpeech

AAC (Augmentative and Alternative Communication) web app. SolidJS + Express + Prisma + offline-first blob sync + PWA.

## Commands

```bash
# Client
cd client && npm install && npm run dev  # Port 5173

# Server (uses Bun)
cd server && npm install && npx prisma generate && bun --watch src/index.ts

# Build client
cd client && npm run build   # tsc -b && vite build
```

## Architecture

All project data (pages, tiles, templates) lives in a single `Project.blob` JSON column. The client downloads the full blob, edits locally via `mutateBlob()`, and debounce-syncs back to the server. Page navigation is instant (signal swap, zero network calls).

```
Browser (SolidJS)              Express Server              External
┌──────────────────┐          ┌──────────────┐           ┌─────────────┐
│ IndexedDB cache  │◀────────▶│ Prisma + PG  │──────────▶│ Cloudflare  │
│ projectBlob sig  │  blob    │ Project.blob │           │ R2, OAuth,  │
│ mutateBlob()     │  sync    │ Zod validate │           │ ElevenLabs, │
│ Background Sync  │          │ app-version  │           │ FAL.ai      │
└──────────────────┘          └──────────────┘           └─────────────┘
```

### Sync flow

```
GET /project/:id/blob → IndexedDB → projectBlob signal
  ↓ mutateBlob() — structuredClone → mutate → setProjectBlob
IndexedDB (dirty: true) → debounce 2s → POST /project/:id/sync
  ↓ server validates lastEditedAt → 200 OK or 409 conflict
IndexedDB (dirty: false)
  ↓ on 409: conflict modal → keep local (force sync) or use server version
  ↓ on offline: Background Sync API registers retry (Chrome)
```

## Data Model

```prisma
User     // id, email, name, password (hashed), profileImgUrl, elevenLabsApiKey (encrypted)
Project  // id, userId, name, description, imageUrl, columns, rows, homePageId,
         // isPublic, isFavorite, blob (JSON — full ProjectBlob), lastEditedAt
```

Everything else is in the blob:

```typescript
type TileBlob = {
  x: number; y: number; page: number; text: string;
  displayText?: string; backgroundColor?: string;
  borderColor?: string; image?: string; navigation?: string;
};

type PageBlob = {
  id: string; name: string; tiles: TileBlob[];
  isTemplate?: boolean; templatePageId?: string;
};

type ProjectBlob = {
  id: string; name: string; description: string | null;
  imageUrl: string | null; columns: number; rows: number;
  homePageId: string | null; lastEditedAt: string;
  pages: PageBlob[];
};
```

- Tile identity: position `(x, y, page)` — no tile IDs
- Page IDs: client-generated `crypto.randomUUID()`
- Templates: pages with `isTemplate: true`, linked via `templatePageId`
- Default colors: `#fafafa` (bg), `#71717a` (border) — stripped from wire format

## Structure

```
client/src/
  lib/
    state.ts              # All signals + derived blob helpers
    blob-sync.ts          # Core sync engine (load, mutate, sync, flush, conflict resolution)
    blob-actions.ts       # Mutation helpers (tiles, pages, templates)
    page-actions.ts       # loadProject(), navigateToPageInProject()
    types.ts              # TypeScript types (blob types, Tile, Project, etc.)
    constants.ts          # MODAL_ID enum
    toast.ts              # Signal-based toast store (showToast)
    speak.ts              # TTS (ElevenLabs + Web Speech API fallback)
    sw-update.ts          # Service worker update prompt (workbox-window)
    version-check.ts      # API version mismatch detection
    api/endpoints/        # project.ts, media.ts, tts.ts, auth.ts, user.ts
    api/util.ts           # fetchFromAPI + OfflineError + version header check
    cache/db.ts           # IndexedDB schema (projectBlobs + meta stores)
    cache/blob-cache.ts   # Blob CRUD helpers
    cache/meta-cache.ts   # Auth token cache (for SW background sync)
  components/
    Modal/                # Modal system (registry pattern)
    ToastContainer.tsx    # Toast notifications (bottom of screen)
    UpdateBanner.tsx      # SW update / API version mismatch banner
    OfflineBanner.tsx     # Offline/reconnect status banner
    InstallPrompt.tsx     # PWA install prompt
  hooks/                  # useNetworkStatus, useOutsideClick, useTooltip
  routes/app/
    dashboard/            # Projects list, templates, settings, profile
    project/[project_id]/ # Main project page + components

server/src/
  routes/                 # File-based routing (express-file-routing)
    auth/                 # Login, register, OAuth
    project/              # list, create, [id]/{blob, sync, sync-check, optimize-images, update-thumbnail, favorite}
    media/                # Image search, upload, fetch, background removal
    text-to-speech/       # ElevenLabs TTS
  middleware/             # authenticate-request, validate-schema, handle-error, log-request, app-version
  utils/project-blob.ts   # buildProjectBlob(), applyProjectBlob(), Zod schema
  prisma/schema.prisma
```

## Key Patterns

### Blob mutations

All edits go through `mutateBlob()` → structuredClone → mutate → update signal + IndexedDB → debounced POST.

```typescript
// blob-actions.ts has helpers for everything:
blobCreateTile(pageId, position, data?)
blobUpdateTile(pageId, position, updates)
blobDeleteTiles(pageId, positions[])
blobCreatePage(name)  / blobRenamePage() / blobDeletePage()
blobCreateTemplate(name, tiles) / blobDeleteTemplate(templateId)
blobLinkTemplate(pageId, templatePageId) / blobUnlinkTemplate(pageId)
blobUpdateProject(updates)
```

### Derived state helpers (call within tracking scopes)

```typescript
getPageFromBlob(pageId)                  // Find page by ID
getCurrentPageTiles()                    // Expanded tiles for current page
getCurrentPageTemplateTilesFromBlob()    // Template tiles (resolved from blob)
getProjectPagesFromBlob()               // Non-template pages
getTemplatePagesFromBlob()              // Template pages
getTemplateForPage(pageId)              // Linked template or null
```

### Modal system

1. Add ID to `lib/constants.ts` > `MODAL_ID`
2. Create component in `components/Modal/_modal_inners/`
3. Register in `modal-registry.tsx`
4. Open: `setActiveModalId(MODAL_ID.YOUR_MODAL)`

### Toast notifications

```typescript
import { showToast } from '@/lib/toast';
showToast('Message', 'info' | 'success' | 'error');  // auto-dismiss 4s
```

### Offline awareness

`fetchFromAPI()` throws `OfflineError` when `navigator.onLine` is false. Catch it in UI code to show user-friendly toasts. TTS auto-falls back to Web Speech API offline.

### File-based routing (server)

```typescript
// routes/project/[id]/blob.ts → /project/:id/blob
export const GET = [
  authenticateRequest(),
  async (req: Request, res: Response) => { ... }
];
```

## SolidJS Gotchas

1. **Signals need `()`**: `isLoading()` not `isLoading`
2. **Use `<Show>` and `<For>`**: Not `&&` or `.map()`
3. **Use `class=`**: Not `className=`
4. **Don't destructure props**: Use `props.title` directly

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | Single `Project.blob` JSON column | All data in one place, simple sync |
| Sync | Full blob replacement + `lastEditedAt` guard | Blob is small (~83KB compressed for 6K tiles) |
| Conflict | 409 → modal (keep local or use server) | User chooses, no silent data loss |
| Tile identity | Position `(x,y,page)` | No IDs needed, saves wire size |
| Templates | `isTemplate` flag on pages in blob | No separate tables, all through blob sync |
| Path alias | `@/*` → `src/*` | Both client and server |
| PWA | Prompt-mode SW + Background Sync API | User controls updates; offline edits survive tab close |
| API versioning | `x-app-version` header + client check | Detects stale clients, shows update banner |
