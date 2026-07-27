# FreeSpeech

AAC (Augmentative and Alternative Communication) web app. SolidJS + Express + Prisma + offline-first blob sync + PWA.

## Hosting

- **Client**: static hosting (CDN/edge).
- **API (Express)**: self-hosted on the user's personal Linux server as a **systemd service** — not Render, not Fly, not any managed platform. CPU and bandwidth on this box are the user's own, so image processing (sharp resize/WebP) runs "for free" but should stay fast. Prefer client-side work when it meaningfully reduces server load (e.g., resize huge uploads before they hit the API).
- **Media CDN**: Cloudflare R2 at `https://media.freespeechaac.com/{key}`.

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

### Image uploads

All uploads (device picker + online image search) funnel through `uploadFile()` in `client/src/lib/presigned-uploads.ts`, which runs `compressImage()` first (`client/src/lib/image-compress.ts`) before presigning.

- **Client-side compression**: resize to **512px longest side**, encode as **WebP @ 0.85** (fallback: JPEG @ 0.85 on old Safari where `canvas.toBlob('image/webp')` returns null). Uses `createImageBitmap` + `OffscreenCanvas` when available, with `HTMLImageElement` + `HTMLCanvasElement` fallback for broad device support.
- **Naming scheme**: compressed uploads get a `-512.{webp|jpg}` suffix so future variants (e.g. `-original.*`) can be added without ambiguity.
- **Size limit**: 2MB cap enforced client-side (toast on reject) and server-side via Zod in `server/src/routes/media/upload/presign.ts`. After 512px WebP compression, real uploads are typically 20–100KB — the cap exists as a guardrail, not the common path.
- **Passthrough**: SVG/GIF skip compression (vector / animated). Decode errors pass through to preserve originals.
- **Templates share URLs**: template pages reference the same R2 URLs — no image duplication when a template is linked to another page.

### Starter templates (OBF/OBZ)

Pre-built vocabulary sets (CommuniKate, Quick Core, Vocal Flair, Sequoia, Project Core) defined in `server/src/data/templates.ts`. Each has a `sourceObjectKey` (pre-existing `.obz`/`.obf` at `r2://template-projects/`) plus a `sourceThumbnailUrl` (external image).

**One-time seeding** via `cd server && npm run seed:templates`:
- Parses each `.obz` (JSZip) — walks every tile image (URL, zip-internal path, or `data:` URL).
- Dedupes by source bytes → `sha256`. Uploads to `r2://template-assets/{hash}.{webp|svg|gif}` (SVG/GIF passthrough, raster → 512px WebP @ 85). Idempotent (HEAD-checks before upload).
- Rehosts card thumbnail → `r2://template-thumbnails/{slug}.{webp|svg}` (raster resized to 400px).
- Builds a complete `ProjectBlob` with new page UUIDs and rehosted image URLs; writes to `r2://template-blobs/{slug}.json`.

**User import** via `POST /project/import-template { slug }`:
- Fetches `template-blobs/{slug}.json` from R2.
- Generates new page UUIDs and rewrites tile `navigation` fields to match.
- Creates a `Project` row owned by the requesting user.
- **No image copying** — every imported project references the same shared `template-assets/{hash}` URLs.

**Shared-asset guardrail**: `update-thumbnail.ts` skips R2 deletion when `project.imageUrl` starts with `/template-`, so regenerating a thumbnail for a template-imported project doesn't blow away the shared template thumbnail.

**Discoverability**: `/app/dashboard/templates` (real browser, not a redirect) + "Starter Templates" nav link in `DashboardHeader`.

### Offline awareness

`fetchFromAPI()` throws `OfflineError` when `navigator.onLine` is false. Catch it in UI code to show user-friendly toasts. TTS auto-falls back to Web Speech API offline.

Cold offline launches keep a stored session unless `/auth/me` returns a definitive 401/403/404; transport failures never delete the token. A safe subset of the last authenticated user is cached in IndexedDB so the app shell can render without the API. The projects dashboard falls back to summaries built from `projectBlobs`, so it shows only boards that can actually open offline rather than a stale full server list or an indefinite loading state.

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
