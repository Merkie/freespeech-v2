# FreeSpeech

AAC (Augmentative and Alternative Communication) web app. SolidJS + Express + Prisma + offline-first blob sync.

## Commands

```bash
# Client
cd client && npm install && npm run dev  # Port 5173

# Server
cd server && npm install && npx prisma generate && npm run dev  # Port 3000

# Build
cd client && npm run build   # Vite
cd server && npm run build   # tsup
```

## Architecture

All project data (pages, tiles, templates) lives in a single `Project.blob` JSON column. The client downloads the full blob, edits locally via `mutateBlob()`, and debounce-syncs back to the server. Page navigation is instant (signal swap, zero network calls).

```
Browser (SolidJS)              Express Server              External
┌──────────────────┐          ┌──────────────┐           ┌─────────────┐
│ IndexedDB cache  │◀────────▶│ Prisma + PG  │──────────▶│ Cloudflare  │
│ projectBlob sig  │  blob    │ Project.blob │           │ R2, OAuth,  │
│ mutateBlob()     │  sync    │ Zod validate │           │ ElevenLabs, │
└──────────────────┘          └──────────────┘           │ FAL.ai      │
                                                         └─────────────┘
```

### Sync flow

```
GET /project/:id/blob → IndexedDB → projectBlob signal
  ↓ mutateBlob() — structuredClone → mutate → setProjectBlob
IndexedDB (dirty: true) → debounce 2s → POST /project/:id/sync
  ↓ server validates lastEditedAt → 200 OK or 409 conflict
IndexedDB (dirty: false)
```

## Data Model

```prisma
User     // id, email, name, password (hashed), profileImgUrl, elevenLabsApiKey (encrypted)
Project  // id, userId, name, description, imageUrl, columns, rows, homePageId,
         // isPublic, blob (JSON — full ProjectBlob), lastEditedAt
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
- Template tiles resolved client-side from the blob's pages array
- Default colors: `#fafafa` (bg), `#71717a` (border) — stripped from wire format

## Structure

```
client/src/
  lib/
    state.ts              # All signals + derived blob helpers
    blob-sync.ts          # Core sync engine (load, mutate, sync, flush)
    blob-actions.ts       # Mutation helpers (tiles, pages, templates)
    page-actions.ts       # loadProject(), navigateToPageInProject()
    types.ts              # TypeScript types (blob types, Tile, Project, etc.)
    api/endpoints/        # project.ts (blob sync), media.ts, tts.ts, auth.ts, user.ts
    cache/                # IndexedDB schema + blob cache helpers
    speak.ts              # TTS (ElevenLabs + Web Speech API)
  components/Modal/       # Modal system (registry pattern)
  routes/app/
    dashboard/            # Projects list, templates, settings
    project/[project_id]/ # Main project page + components

server/src/
  routes/                 # File-based routing (express-file-routing)
    auth/                 # Login, register, OAuth
    project/              # list, create, [id]/{blob, sync, sync-check, optimize-images, update-thumbnail}
    media/                # Image search, upload, fetch, background removal
    text-to-speech/       # ElevenLabs TTS
  utils/project-blob.ts   # buildProjectBlob(), applyProjectBlob(), Zod schema
  scripts/                # One-time migration scripts
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
| Conflict | Last-write-wins + 409 if server newer | Single-user AAC boards |
| Tile identity | Position `(x,y,page)` | No IDs needed, saves wire size |
| Templates | `isTemplate` flag on pages in blob | No separate tables, all through blob sync |
| Path alias | `@/*` → `src/*` | Both client and server |
