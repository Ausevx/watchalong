# WatchAlong

WatchAlong is a specialized platform designed for high-performance synchronized media consumption and real-time communication. It provides a seamless environment for users to coordinate video playback and engage in low-latency video discourse.

## Core Capabilities

### Synchronized Playback
The platform utilizes the YouTube IFrame API to provide zero-latency synchronization across all participants in a room. Playback actions including play, pause, and seek are propagated instantly via a dedicated Socket.IO signaling layer. Please note that the system is currently optimized exclusively for YouTube content.

### Real-time Communication
Integrated WebRTC mesh networking enables high-definition, peer-to-peer webcam communication. This architecture ensures that video data is encrypted end-to-end and transmitted directly between browsers, minimizing server load and latency.

### Design System
The interface follows a digital brutalist aesthetic, characterized by high-contrast typography, a minimalist color palette, and a focus on functional clarity.

### Infrastructure and Privacy
Security and privacy are foundational. The application requires no user accounts and maintains ephemeral sessions. The infrastructure is designed to be fully containerized for simplified deployment.

## Technical Architecture

| Component | Technology |
|---|---|
| Frontend Framework | Next.js 14+ (App Router) |
| Layout and Styles | Vanilla CSS with Modern Variables |
| Signaling Layer | Socket.IO |
| Communication | Peer-to-Peer WebRTC |
| Persistence | Prisma (SQLite) |

## Deployment

### Docker Environment
Deployment via Docker remains the recommended method for both development and production environments.

```bash
git clone https://github.com/Ausevx/watchalong.git
cd watchalong
docker compose up -d --build
```

### Manual Installation
For environments where Docker is unavailable:

1. Install dependencies: `npm install`
2. Initialize database: `npx prisma db push`
3. Launch service: `npm run dev`

### Production Access
The project includes support for Cloudflare Tunnels to provide secure external access to the local instance without the need for port forwarding. Configure the tunnel token within the project environment to establish a secure connection to the Cloudflare network.

