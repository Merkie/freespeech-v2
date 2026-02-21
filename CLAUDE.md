# FreeSpeech - Development Guide

## Project Overview

FreeSpeech is a web-based AAC (Augmentative and Alternative Communication) application that enables users to create interactive communication boards with customizable tiles. Features include text-to-speech synthesis, image search, tile navigation, template pages, and Open Board Format (OBF/OBZ) imports.

---

## Architecture Summary

```
User Device (Browser)      Express Server           External Services
┌─────────────────┐       ┌──────────────┐         ┌─────────────────┐
│ SolidJS Client  │──────▶│ File Router  │────────▶│ Google OAuth    │
│ PWA + Workbox   │       │ Prisma ORM   │         │ Cloudflare R2   │
│ SolidRouter     │       │ PostgreSQL   │────────▶│ ElevenLabs TTS  │
└─────────────────┘       └──────────────┘         │ FAL.ai          │
                                                   │ BrightData      │
                                                   └─────────────────┘
```

**Core Flow:** Create Project → Add Pages → Add Tiles → Configure (text, image, navigation, colors) → Speak tiles via TTS

---

## Tech Stack

### Client (`/client`)
- **SolidJS** with **@solidjs/router** for SPA routing
- **Vite 7** with TypeScript
- **TailwindCSS v4** (Vite plugin)
- **Workbox** for PWA/service worker caching
- **Howler.js** for audio playback
- **Fuse.js** for fuzzy search
- **IndexedDB** (via `idb`) for offline caching

### Server (`/server`)
- **Express** with file-based routing (`express-file-routing`)
- **Prisma** ORM with PostgreSQL
- **@aws-sdk/client-s3** for R2 storage
- **Sharp** for image optimization
- **ElevenLabs SDK** for text-to-speech
- **FAL.ai** for background removal
- **bcryptjs** for password hashing
- **jsonwebtoken** for auth

---

## Database Schema

```prisma
User              // id, email, name, password (hashed), profileImgUrl, elevenLabsApiKey (encrypted)
Project           // id, userId, name, columns, rows, homePageId, isPublic
TilePage          // id, userId, name, isTemplate, isPublic, tiles[]
TilePageInProject // Junction table linking pages to projects
Tile              // id, tilePageId, x, y, text, backgroundColor, borderColor, image, navigation
PageTemplateLink  // Links pages to template pages for inherited styling
```

---

## API Routes

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/me` | Get current user |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/register` | Create account |
| POST | `/auth/oauth/google` | Google OAuth callback |
| POST | `/auth/oauth-urls` | Get OAuth provider URLs |

### Projects
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/project/list` | List user's projects |
| POST | `/project/create` | Create project (creates home page) |
| GET | `/project/:id/view` | Get project with pages |
| POST | `/project/:id/update` | Edit project settings |
| DELETE | `/project/:id/delete` | Delete project |
| POST | `/project/:id/optimize-images` | Optimize tile images to WebP |
| POST | `/project/import/obf` | Import OBF file |
| POST | `/project/import/obz` | Import OBZ archive |

### Pages
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/page/create` | Create new page |
| POST | `/page/:id/update` | Update page name |
| DELETE | `/page/:id/delete` | Delete page |

### Tiles
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/tile/create` | Create tile at (x,y) |
| POST | `/tile/:id/edit` | Edit tile properties |
| DELETE | `/tile/:id/delete` | Delete tile |

### Media
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/media/search/google` | Search Google Images via proxy |
| GET | `/media/search/open-symbols` | Search Open Symbols library |
| POST | `/media/upload/presign` | Get presigned R2 upload URL |
| GET | `/media/fetch-from-url` | Fetch image from external URL |
| POST | `/media/remove-background` | AI background removal |

### Text-to-Speech
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/text-to-speech/elevenlabs/list-voices` | List ElevenLabs voices |
| POST | `/text-to-speech/elevenlabs/speak` | Generate speech audio |

### Templates (`/v2`)
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/v2/template/*` | Template CRUD operations |
| POST | `/v2/template/:id/tile/*` | Template tile management |

---

## Client Structure

### Router
```
/                           - Landing page
/login, /register           - Auth pages (email + OAuth)
/oauth/google               - OAuth callback
/app                        - Protected routes
  /dashboard/projects       - Project list
  /dashboard/templates      - Template gallery
  /dashboard/settings       - User settings
  /dashboard/settings/voice - Voice configuration
  /project/:project_id      - Project viewer/editor
```

### Components
```
client/src/
├── App.tsx                 # Router setup
├── pages/
│   ├── auth/               # Login, Register, OAuth
│   ├── dashboard/          # Projects, Settings, Templates
│   └── project/            # Main board editor
├── components/
│   ├── Tile.tsx            # Interactive tile
│   ├── SentenceBuilder.tsx # Build sentences from tiles
│   ├── EditTilePanel.tsx   # Tile property editor
│   └── Modal/              # Modal system
└── lib/
    ├── state.ts            # SolidJS signals
    ├── api/                # API client modules
    ├── types.ts            # TypeScript types
    └── constants.ts        # App constants
```

### State Management (`lib/state.ts`)
```typescript
// Project state
project: Signal<Project>
currentPage: Signal<TilePageInProject>
currentPageId: Signal<string>

// Editing state
editingTiles: Signal<boolean>
editingTileIds: Signal<string[]>
pendingTileEdits: Signal<Partial<Tile>>

// TTS state
elevenLabsVoiceId: Signal<string | null>
offlineVoiceUri: Signal<string | null>
sentence: Signal<Tile[]>                    // Sentence builder

// Local settings (localStorage)
localSettings: {
  voiceGenerator: 'elevenlabs' | 'offline'
  speakOnTap: boolean
  sentenceBuilder: boolean
  skinTone: string
}
```

---

## Environment Variables

### Server (`/server/.env`)
```env
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=xxx
SITE_SECRET=xxx                    # For encrypting user API keys
CLIENT_HOST=http://localhost:5173
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET=freespeechaac
ELEVEN_LABS_KEY=xxx                # Default TTS key
FAL_KEY=xxx                        # For background removal
BRIGHT_DATA_PROXY_URL=xxx          # For Google image search
```

### Client (`/client/.env`)
```env
VITE_API_URL=http://localhost:3000
VITE_R2_URL=https://media.freespeechaac.com
```

---

## Folder Structure

```
freespeech-mono/
├── CLAUDE.md
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   │       ├── state.ts
│   │       ├── api/
│   │       ├── types.ts
│   │       └── constants.ts
│   ├── public/
│   └── package.json
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/              # File-based routing
│   │   │   ├── auth/
│   │   │   ├── project/
│   │   │   ├── page/
│   │   │   ├── tile/
│   │   │   ├── media/
│   │   │   ├── text-to-speech/
│   │   │   └── v2/
│   │   ├── middleware/
│   │   ├── resources/
│   │   │   ├── prisma.ts
│   │   │   ├── s3.ts
│   │   │   └── cache.ts
│   │   └── utils/
│   ├── tsup.config.ts
│   └── package.json
└── solidjs-docs/                 # Reference documentation
```

---

## Key Features

### Communication Board
- Configurable grid (rows × columns per project)
- Tiles with text, images, colors, and navigation links
- Sentence builder: tap tiles to build sentences, then speak
- Navigate between pages via tile links

### Text-to-Speech
- **ElevenLabs**: Premium voices (supports personal API keys)
- **Browser TTS**: Fallback using Web Speech API
- Configurable per-user in settings

### Image Management
- Google Images search via BrightData proxy
- Open Symbols library search
- AI background removal (FAL.ai)
- Server-side optimization (Sharp → WebP, 250x250px)
- R2 storage with presigned uploads

### Templates
- Create template pages with predefined layouts
- Link pages to templates for inherited styling
- Template tiles shown as overlay on linked pages

### Import/Export
- OBF (Open Board Format) file import
- OBZ (zipped OBF) archive import

### PWA
- Service worker with Workbox caching
- Offline-first with IndexedDB
- Installable to home screen

---

## Commands

```bash
# Client
cd client && npm install && npm run dev  # Port 5173

# Server
cd server && npm install
npx prisma generate
npx prisma db push
npm run dev                              # Port 3000

# Build
cd server && npm run build               # Uses tsup
cd client && npm run build               # Vite production build
```

---

## File-Based Routing Pattern

Routes are defined by file structure in `/server/src/routes/`:

```typescript
// routes/project/list.ts
import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';

export const get = [
  authenticateRequest,
  async (req: Request, res: Response) => {
    // Handler logic
    res.json({ projects: [...] });
  }
];
```

- Export HTTP methods as arrays: `get`, `post`, `put`, `delete`
- Arrays contain middleware chain + final handler
- File path = route path (`/routes/project/list.ts` → `/project/list`)

---

## Important Notes

- Auth uses JWT stored in localStorage (30-day expiration)
- Passwords hashed with bcrypt
- User ElevenLabs keys encrypted with SITE_SECRET
- Current page tracked via signal, not URL (only project ID in URL)
- Grid positions: tiles have (x, y) coordinates within pages
- Template system: pages can link to template pages for shared styling
- Image optimization: Sharp converts to WebP at 250x250px, quality 80
- Cache: Server-side TTL cache with 30-minute cleanup cron

---

## R2 Storage

Media stored in Cloudflare R2:
- **Upload**: Presigned URLs for client-side uploads
- **Access**: Public bucket at `VITE_R2_URL`
- **Paths**: `tiles/{userId}/{uuid}.webp`

---

## External Integrations

| Service | Purpose |
|---------|---------|
| Google OAuth | User authentication |
| Google Images | Image search (via BrightData proxy) |
| Open Symbols | AAC symbol library |
| ElevenLabs | Premium text-to-speech |
| Cloudflare R2 | Media storage |
| FAL.ai | AI background removal |
| PostgreSQL | Database |
