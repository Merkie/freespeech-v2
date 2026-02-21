---
globs: freespeech/**/*
---

# Old Frontend Rules (SvelteKit)

## PRODUCTION - Being Replaced

This is the production frontend but is being migrated to SolidJS. Use as reference for the new client but avoid major changes.

## Tech Stack

- SvelteKit (Svelte 4) with SSR
- TailwindCSS v3
- Vite

## Structure

```
freespeech/src/
├── components/          # Svelte components
│   ├── app/             # Tile, TilePage, SentenceBuilder
│   ├── common/          # Loader, BottomNavigation
│   └── modals/          # EditTilePanel, EditPagesModal
├── routes/              # SvelteKit file-based routes
│   └── app/
│       ├── dashboard/   # Projects list, settings, profile
│       └── project/     # Project viewer/editor
└── ts/
    ├── client/
    │   ├── api/         # API client (fetchFromAPI)
    │   └── stores.ts    # Svelte stores (global state)
    └── common/
        └── types.ts     # Shared TypeScript types
```

## Path Aliases

- `$ts/*` → `src/ts/*`
- `$components/*` → `src/components/*`

## Svelte Patterns

```typescript
// Stores
import { writable } from 'svelte/store';
export const EditingTiles = writable(false);
// Usage: $EditingTiles (auto-subscribed in templates)
```

## Commands

```bash
npm run dev      # Development
npm run build    # Production build
npm run check    # Type check
npm run lint     # Prettier + ESLint
npm run format   # Auto-format
```
