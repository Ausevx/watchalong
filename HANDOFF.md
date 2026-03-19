# WatchAlong — WebRTC Transition Handoff

**Context for the next AI Agent:**
The user has requested a major architectural shift. We are removing the server-side FFmpeg transcoding pipeline (which converts uploaded MP4/MKV files to HLS) because it is too CPU-intensive for their free hosting setup. 

Instead, we are pivoting to **WebRTC Peer-to-Peer** video streaming.

**Your Goal:**
Execute the "WebRTC Transition" checklist found in `<appDataDir>/brain/<conversation-id>/task.md`. You must safely rip out the old FFmpeg/tus infrastructure and replace it with direct browser-to-browser WebRTC streaming.

---

## 🗑️ Step 1: Rip Out the Old Transcoding Pipeline
You must aggressively prune the codebase of the old FFmpeg logic.

1. **Remove Packages:**
   - Run `npm uninstall fluent-ffmpeg ffmpeg-static tus-js-client @tus/server @tus/file-store hls.js`

2. **Delete Unused Files:**
   - `src/lib/ffmpeg.js` (The entire transcoding logic)
   - `src/app/api/upload/route.js` (The tus server endpoint)
   - `src/app/api/videos/[id]/route.js` (The transcode polling endpoint)
   - Delete the `uploads/` and `hls-output/` directories in the root.

3. **Clean up `server/index.js`:**
   - Remove the `express.static` route serving `/hls-output`.
   - Remove Socket.IO logic related to `video:transcode:progress` or `video:ready`.

4. **Clean up Prisma Schema:**
   - In `prisma/schema.prisma`, you can remove the `Video` model entirely, or simplify it. We no longer need to track `hlsUrl`, `transcodeStatus`, or `progress`.

---

## 📡 Step 2: Implement WebRTC Signaling in `server/index.js`
WebRTC requires a "Signaling Server" to establish the P2P connection before video can flow. We will use our existing Socket.IO server for this.

**Modify `server/index.js` to handle these events:**
```javascript
// Viewer asks the Host for a stream
socket.on('webrtc:request-stream', (roomId) => {
    // find the host's socket ID for this room, and emit:
    hostSocket.emit('webrtc:peer-joined', { viewerId: socket.id });
});

// Host sends SDP Offer to a specific Viewer
socket.on('webrtc:offer', ({ viewerId, offer }) => {
    io.to(viewerId).emit('webrtc:offer', { hostId: socket.id, offer });
});

// Viewer replies with SDP Answer to the Host
socket.on('webrtc:answer', ({ hostId, answer }) => {
    io.to(hostId).emit('webrtc:answer', { viewerId: socket.id, answer });
});

// Both sides route ICE Candidates to each other
socket.on('webrtc:ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc:ice-candidate', { senderId: socket.id, candidate });
});
```

---

## 📤 Step 3: Create `WebRTCVideoSender.js` (For the Host)
Replace `VideoUpload.js` with a new component for the Host. 
1. The Host clicks "Select Local File" (using a standard `<input type="file" accept="video/*">`).
2. We create a hidden `<video>` element locally, set its `src = URL.createObjectURL(file)`.
3. We capture the stream: `const stream = videoElement.captureStream()`.
4. The Host creates a new `RTCPeerConnection` **for every viewer** in the room.
5. The Host calls `peerConnection.addTrack(track, stream)` for audio and video.
6. The Host creates an SDP Offer and sends it via Socket.IO.

*Note: Since the Host is playing the local file, they are the source of truth. Play/pause events still need to be broadcast via `sync:state` as they were before.*

---

## 📥 Step 4: Create `WebRTCVideoReceiver.js` (For the Viewers)
Replace `VideoPlayer.js` (the HLS player) with a WebRTC receiver.
1. When the Viewer joins, they emit `webrtc:request-stream`.
2. They receive an SDP Offer from the Host.
3. They create an `RTCPeerConnection`, `setRemoteDescription`, create an SDP Answer, and send it back.
4. They listen for `peerConnection.ontrack = (event) => { ... }`.
5. They attach `event.streams[0]` directly to a standard `<video>` element `srcObject`.

---

## ⚠️ Important Considerations
- **No Writing Code Now:** As requested by the user, **DO NOT write this code during the current AI session**. This file exists solely for the *next* agent that the user talks to.
- **Styling:** Keep the stark, bold, Neopragmatism aesthetic (magenta `#E6007E`, pure black, Syne font) that was established in the `globals.css` and CSS modules. Do not break the UI when replacing the upload/player components.
- **Syncing:** `YouTubePlayer.js` stays untouched. The WebRTC player should hook into the exact same Socket.IO `sync:state` and `getCurrentTime()` logic that the HLS player previously used.
