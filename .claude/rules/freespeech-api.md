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
/project/*        - Project CRUD, blob sync, image optimization
/media/*          - Image search, upload, fetch
/text-to-speech/* - ElevenLabs TTS
```

## Data Model

- **User** - Auth, optional ElevenLabs API key
- **Project** - Board project with grid settings, `blob` JSON column (full source of truth for all pages/tiles)

All pages and tiles are stored as JSON in `Project.blob`. No separate tile/page tables.

## Structure

```
server/src/
├── routes/           # File-based routing
├── prisma/           # Schema
├── utils/            # project-blob.ts, env, token, etc.
├── scripts/          # One-time migration scripts
└── middleware/        # Auth, validation, error handling
```

## Path Alias

`@/*` → `src/*`
