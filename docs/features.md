# WatchAlong — Features List

> Synced copy of the features from the implementation plan.  
> **Mark with ✅ when implemented, ❌ to remove from scope.**

---

## Phase 1 — Core MVP (includes upload + streaming)
- [ ] Room Creation (shareable room code/link)
- [ ] Room Joining (code entry or link click)
- [ ] YouTube Link Sync (paste URL → synced embed)
- [ ] File Upload & Streaming (MP4, MKV, AVI, MOV, WebM → HLS transcode → stream to all)
- [ ] Playback Sync — all sources (host play/pause/seek → all clients)
- [ ] FFmpeg Transcoding (multi-bitrate HLS: 360p, 720p, 1080p)
- [ ] HLS Playback (Video.js + hls.js, adaptive bitrate)
- [ ] Real-time Chat (Socket.IO text chat in sidebar)
- [ ] Participant List (online/offline indicators)
- [ ] Host Controls (only host controls playback)

## Phase 2 — Video Library & Polish
- [ ] Video Library (pick from previously uploaded videos)
- [ ] Emoji Reactions (floating overlay on video)
- [ ] Queue / Playlist (multiple videos)
- [ ] Room Customization (name, description, thumbnail, max participants)
- [ ] Presence Indicators ("buffering…", "X seconds behind")
- [ ] Latency Compensation (drift correction)

## Phase 3 — Auth & Accounts (Blueprint Only)
- [ ] User Registration (email/password + bcrypt)
- [ ] OAuth Login (Google, GitHub, Discord)
- [ ] JWT Sessions (short-lived + refresh tokens)
- [ ] Room Ownership (rooms tied to accounts)
- [ ] User Profiles (display name, avatar, watch history)

## Phase 4 — Advanced (Nice-to-have)
- [ ] Screen Share (WebRTC)
- [ ] Voice Chat (WebRTC)
- [ ] Mobile Responsive (PWA)
- [ ] Room Invites / Links (shareable with optional expiry)
- [ ] Admin Dashboard (stats, users, content management)
