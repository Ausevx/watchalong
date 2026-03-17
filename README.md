# WatchAlong

Synchronized watch-along platform — create rooms, invite friends, and watch videos together in perfect sync.

## Status

🟡 **Planning Phase** — No code yet. See `/docs/` for the full plan.

## Docs

- **[Implementation Plan](docs/features.md)** — Phased feature roadmap  
- **[Auth Blueprint](docs/auth_blueprint.md)** — Login/signup design (not yet implemented)

## Planned Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14+ (App Router) |
| Real-time | Socket.IO |
| Video | Video.js + hls.js / YouTube IFrame API |
| Processing | FFmpeg (fluent-ffmpeg) |
| Upload | tus (resumable chunked) |
| Database | SQLite → PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js / Auth.js (future) |

## Quick Start (coming soon)

```bash
npm install
npm run dev
```
