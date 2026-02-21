---
globs: new-alpha-solidjs-client/**/*
---

# New Frontend Rules (SolidJS)

## IN DEVELOPMENT - Primary Focus

This is the new SolidJS frontend replacing the SvelteKit version.

## Tech Stack

- SolidJS 1.9+
- @solidjs/router (client-side routing, no SSR)
- TailwindCSS v4
- Vite 7

## SolidJS Gotchas

1. **Call signals as functions**: `isLoading()` not `isLoading`
2. **Use `<Show>` and `<For>`**: Not `&&` or `.map()`
3. **Use `class` not `className`**
4. **Don't destructure props**: Use `props.title` directly
5. **Stores don't need calls**: `store.id` not `store().id`

```typescript
// Signals - MUST call as function
const [count, setCount] = createSignal(0);
count();  // ✅ read value
count;    // ❌ wrong - returns getter function

// Stores - direct access
const [chat, setChat] = createStore({ id: '', title: '' });
chat.id;  // ✅ read value
```

## Structure

```
new-alpha-solidjs-client/src/
├── index.tsx            # Entry point, router config
├── index.css            # Global styles, Tailwind
├── components/          # Reusable components
│   └── Modal/           # Modal system (registry pattern)
├── lib/
│   ├── api/             # API client (mirrors old structure)
│   ├── state.ts         # Global signals
│   ├── types.ts         # TypeScript types
│   ├── speak.ts         # TTS logic
│   └── presigned-uploads.ts
├── hooks/               # Custom hooks
└── routes/              # Page components
    └── app/
        ├── dashboard/
        └── project/
```

## Key State (state.ts)

- `user` - Current authenticated user
- `project` / `currentPage` / `currentPageId` - Active project and page
- `projectHomePageId` - Cached home page ID
- `editingTiles` / `tileBeingEdited` - Edit mode state
- `sentence` - Tiles in sentence builder
- `localSettings` - Persisted user preferences

## URL Structure

- URLs only contain project ID: `/app/project/:project_id`
- Current page is managed via `currentPageId` signal (not in URL)
- Legacy URLs with page_id auto-redirect

## Modal System

1. Add ID to `lib/constants.ts`
2. Create component in `Modal/_modal_inners/`
3. Register in `modal-registry.tsx`
4. Open: `setActiveModalId(MODAL_ID.YOUR_MODAL)`

## Path Alias

`@/*` → `src/*`

## What's Working

- Auth (login, Google OAuth)
- Project list and navigation
- Tile rendering and state-based page navigation
- Settings pages
- Sentence Builder (hidden in edit mode)
- TTS playback (ElevenLabs + Web Speech API)
- Edit mode with tile editor panel
- Modal system
- Image search (Google + Open Symbols)
- Tile creation and subpage support

## What's Missing

- Animations and polish
