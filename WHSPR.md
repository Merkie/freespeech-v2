# FreeSpeech Vocabulary Reference

## Project Names
- FreeSpeech
- FreeSpeech AAC
- freespeech-mono
- freespeech-server
- freespeech-client

## Domain Terms (AAC)
- AAC (Augmentative and Alternative Communication)
- OBF (Open Board Format)
- OBZ (zipped OBF)
- communication board
- tile
- tile page
- sentence builder
- text-to-speech
- TTS
- speak on tap

## Database Models
- User
- Project
- TilePage
- TilePageInProject
- Tile
- PageTemplateLink

## Database Fields
- userId
- projectId
- tilePageId
- templatePageId
- homePageId
- backgroundColor
- borderColor
- displayText
- imageOptimized
- imageThumbnail
- elevenLabsApiKey
- usePersonalElevenLabsKey
- profileImgUrl
- isPublic
- isTemplate
- createdAt
- updatedAt

## API Routes
- /auth/me
- /auth/login
- /auth/register
- /auth/oauth/google
- /auth/oauth-urls
- /project/list
- /project/create
- /project/view
- /project/update
- /project/delete
- /project/optimize-images
- /project/import/obf
- /project/import/obz
- /page/create
- /page/update
- /page/delete
- /tile/create
- /tile/edit
- /tile/delete
- /media/search/google
- /media/search/open-symbols
- /media/upload/presign
- /media/fetch-from-url
- /media/remove-background
- /text-to-speech/elevenlabs/list-voices
- /text-to-speech/elevenlabs/speak
- /health

## Client Pages & Routes
- HomePage
- LoginPage
- RegisterPage
- DashboardLayout
- AppLayout
- ProjectsPage
- TemplatesPage
- SettingsPage
- VoiceSettingsPage
- AppProjectPage
- /app/dashboard/projects
- /app/dashboard/templates
- /app/dashboard/settings
- /app/dashboard/settings/voice
- /app/project

## Components
- Tile
- SentenceBuilder
- ProjectHeader
- ProjectContent
- TileSubpages
- AddTileButton
- EditTilePanel
- OnlineImageSearchPanel
- Modal

## State Signals
- project
- currentPage
- currentPageId
- projectHomePageId
- currentPageTemplate
- currentPageTemplateTiles
- editingTemplate
- editingTiles
- editingTileIds
- pendingTileEdits
- multiSelectMode
- editingPages
- editingProjects
- addingPage
- addingProject
- enableThirdPartyVoiceProviders
- elevenLabsVoiceId
- offlineVoiceUri
- isSynthesizingSpeech
- voiceEngineStatus
- speakingTileId
- sentence
- activeModalId
- unsavedChanges
- loading
- projectLoading
- pageLoading
- localSettings

## Local Settings Keys
- offlineVoice
- elevenLabsVoice
- voiceGenerator
- speakOnTap
- sentenceBuilder
- skinTone
- lastVisitedProjectId
- lastVisitedPageId

## External Services
- ElevenLabs
- Eleven Labs
- Google OAuth
- Google Images
- Open Symbols
- OpenSymbols
- ARASAAC
- Cloudflare R2
- R2
- FAL.ai
- FAL
- BrightData
- Bright Data
- PostgreSQL
- Postgres

## Libraries & Frameworks
- SolidJS
- Solid JS
- SolidRouter
- @solidjs/router
- Vite
- TailwindCSS
- Tailwind
- Workbox
- Howler
- Howler.js
- Fuse.js
- IndexedDB
- idb
- Express
- express-file-routing
- Prisma
- Sharp
- tsup
- tsx
- bcrypt
- bcryptjs
- jsonwebtoken
- JWT
- Zod
- Puppeteer
- node-cron
- Cryptr

## File Names
- App.tsx
- state.ts
- types.ts
- constants.ts
- api.ts
- cached-fetch.ts
- schema.prisma
- tsup.config.ts
- tsconfig.json
- start-server.ts
- index.ts
- sw.ts (service worker)
- prisma.ts
- s3.ts
- cache.ts
- token.ts
- env.ts
- decrypt-key.ts
- slugify.ts

## Directories
- client
- server
- routes
- middleware
- resources
- utils
- components
- pages
- lib
- prisma
- dist
- node_modules

## Environment Variables
- VITE_API_URL
- VITE_R2_URL
- DATABASE_URL
- JWT_SECRET
- SITE_SECRET
- CLIENT_HOST
- PORT
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- R2_ACCOUNT_ID
- R2_ACCESS_KEY
- R2_SECRET_KEY
- R2_BUCKET
- ELEVEN_LABS_KEY
- FAL_KEY
- BRIGHT_DATA_PROXY_URL

## Technical Terms
- presigned URL
- presign
- WebP
- OAuth
- OAuth callback
- service worker
- PWA (Progressive Web App)
- stale-while-revalidate
- cache-first
- network-first
- middleware
- file-based routing
- signal (SolidJS reactive primitive)
- store (SolidJS reactive store)
- junction table
- ORM (Object-Relational Mapping)
- CDN
- CORS
- CRUD

## UI/UX Terms
- glassmorphic
- backdrop blur
- multi-select
- long-press
- grid layout
- columns
- rows
- navigation link
- home page
- template
- thumbnail

## Commands
- npm run dev
- npm run build
- npm run start
- prisma generate
- prisma db push
- prisma studio
- db:generate
- db:push
- db:studio
