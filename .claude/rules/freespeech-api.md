---
globs: server/**/*
---

# Backend Rules (Express + Prisma)

## PRODUCTION - Be Careful

This is the production backend. Test changes thoroughly.

## Tech Stack

- Express.js + TypeScript (runs with Bun)
- PostgreSQL + Prisma ORM
- Cloudflare R2 for media storage
- ElevenLabs for premium TTS
- File-based routing (`express-file-routing`)
- Zod for validation

## Key Routes

```
/auth/*           - Login, register, OAuth (Google)
/project/*        - Project CRUD, blob sync, image optimization, favorites
/media/*          - Image search, upload, fetch, background removal
/text-to-speech/* - ElevenLabs TTS
```

## Middleware

- `authenticate-request.ts` — JWT auth guard
- `validate-schema.ts` — Zod request validation
- `app-version.ts` — Sets `x-app-version` response header
- `log-request.ts` — Request logging
- `handle-error.ts` — Global error handler

## Data Model

- **User** — Auth, optional ElevenLabs API key, `usePersonalElevenLabsKey` flag
- **Project** — Board with grid settings, `isFavorite`, `blob` JSON column (full source of truth)

All pages and tiles are stored as JSON in `Project.blob`. No separate tile/page tables.

## Structure

```
server/src/
├── routes/           # File-based routing
├── middleware/        # Auth, validation, versioning, error handling
├── utils/            # project-blob.ts, env, token, etc.
└── prisma/           # Schema (in server/prisma/)
```

## Path Alias

`@/*` → `src/*`
