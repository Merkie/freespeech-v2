---
globs: freespeech-api/**/*
---

# Backend Rules (Express + Prisma)

## PRODUCTION - Be Careful

This is the production backend. Test changes thoroughly.

## Tech Stack

- Express.js + TypeScript
- PostgreSQL + Prisma ORM
- Cloudflare R2 for media storage
- ElevenLabs for premium TTS
- File-based routing (`express-file-routing`)
- Zod for validation

## Key Routes

```
/auth/*           - Login, register, OAuth
/project/*        - CRUD, import OBF/OBZ
/page/*           - TilePage CRUD
/tile/*           - Tile CRUD
/media/*          - Image search, upload, fetch
/text-to-speech/* - ElevenLabs TTS
```

## Data Model

- **User** - Auth, optional ElevenLabs API key
- **Project** - Board project with grid settings (rows/columns), `homePageId`
- **TilePage** - A page of tiles
- **TilePageInProject** - Join table (pages can be shared across projects)
- **Tile** - Position (x, y, page), text, colors, image URL, navigation link

## Structure

```
freespeech-api/src/
├── routes/           # File-based routing
├── prisma/           # Schema and migrations
└── lib/              # Utilities
```

## Path Alias

`@/*` → `src/*`

## Database Indexes

Performance-critical indexes on:
- `Tile.tilePageId`
- `TilePageInProject.tilePageId`
- `TilePageInProject.projectId`
