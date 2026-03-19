/**
 * Custom Node.js server: Next.js + Socket.IO + WebRTC signaling
 * Run via: node server/index.js  (or npm run dev)
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory room state
const rooms = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Serve internal CLI monitoring API
    if (req.url === '/api/cli/rooms') {
      const activeRooms = Array.from(rooms.entries()).map(([id, r]) => ({
        roomId: id,
        hostSocketIds: Array.from(r.hostSocketIds),
        videoSource: r.videoSource,
        currentTime: r.currentTime,
        isPlaying: r.isPlaying,
        participantCount: r.participants.size,
        participants: Array.from(r.participants.entries()).map(([pid, p]) => ({
          id: pid,
          name: p.name,
          isHost: r.hostSocketIds.has(pid),
        })),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ activeRooms: activeRooms.length, rooms: activeRooms }));
      return;
    }
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Join Room ───────────────────────────────────────────────────────────
    socket.on('room:join', ({ roomId, name }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name || 'Guest';

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          hostSocketIds: new Set([socket.id]),
          videoSource: null,
          videoUrl: null,
          magnetURI: null,
          currentTime: 0,
          isPlaying: false,
          participants: new Map(),
        });
      }

      const room = rooms.get(roomId);
      room.participants.set(socket.id, { name: socket.data.name, camOn: false, micOn: false });
      const isHost = room.hostSocketIds.has(socket.id);

      socket.emit('sync:init', {
        videoSource: room.videoSource,
        videoUrl: room.videoUrl,
        magnetURI: room.magnetURI,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
        isHost,
      });

      io.to(roomId).emit('participants:update', _participantList(room));
      console.log(`[room:join] ${socket.data.name} → ${roomId} (host: ${isHost})`);
    });

    // ── Sync State (host only) ──────────────────────────────────────────────
    socket.on('sync:state', (payload) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || !room.hostSocketIds.has(socket.id)) return;

      const { action, currentTime } = payload;
      room.currentTime = currentTime ?? room.currentTime;
      if (action === 'play') room.isPlaying = true;
      if (action === 'pause') room.isPlaying = false;

      socket.to(roomId).emit('sync:state', {
        action,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
        videoSource: room.videoSource,
        videoUrl: room.videoUrl,
        timestamp: Date.now(),
      });
    });

    // ── Host sets video source (YouTube) ─────────────────────────────────
    socket.on('video:set', (payload) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || !room.hostSocketIds.has(socket.id)) return;

      room.videoSource = payload.videoSource;
      room.videoUrl = payload.videoUrl || null;
      room.currentTime = 0;
      room.isPlaying = false;

      io.to(roomId).emit('video:set', {
        videoSource: room.videoSource,
        videoUrl: room.videoUrl,
        currentTime: 0,
        isPlaying: false,
      });
    });


    // ── Ping/Request (viewer → any host) ────────────────────────────────────
    socket.on('sync:request', (payload) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || room.hostSocketIds.has(socket.id)) return;
      
      // Notify all hosts
      room.hostSocketIds.forEach(hostId => {
        io.to(hostId).emit('sync:request', {
          from: socket.data.name,
          action: payload.action,
        });
      });
    });

    // WebRTC Signaling Relay
    socket.on('webrtc:signal', ({ target, signal }) => {
      io.to(target).emit('webrtc:signal', {
        sender: socket.id,
        signal
      });
    });

    // ── WebRTC State Sync (cam/mic status) ──────────────────────────────────
    socket.on('webrtc:state', ({ camOn, micOn }) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room) return;
      
      const p = room.participants.get(socket.id);
      if (p) {
        p.camOn = !!camOn;
        p.micOn = !!micOn;
        io.to(roomId).emit('participants:update', _participantList(room));
      }
    });

    // ── Host Toggle ────────────────────────────────────────────────────────
    socket.on('host:toggle', (payload) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || !room.hostSocketIds.has(socket.id)) return;

      const targetId = payload.targetId;
      if (room.participants.has(targetId)) {
        if (room.hostSocketIds.has(targetId)) {
          // Prevent removing the last host
          if (room.hostSocketIds.size > 1) {
            room.hostSocketIds.delete(targetId);
            io.to(targetId).emit('host:demoted', {});
          }
        } else {
          room.hostSocketIds.add(targetId);
          io.to(targetId).emit('host:promoted', {});
        }
        io.to(roomId).emit('participants:update', _participantList(room));
      }
    });

    // ── Chat ─────────────────────────────────────────────────────────────────
    socket.on('chat:message', ({ text }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      io.to(roomId).emit('chat:message', {
        from: socket.data.name || 'Guest',
        text: String(text).slice(0, 500),
        timestamp: Date.now(),
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      const wasHost = room.hostSocketIds.has(socket.id);
      room.participants.delete(socket.id);
      if (wasHost) {
        room.hostSocketIds.delete(socket.id);
      }

      if (room.hostSocketIds.size === 0) {
        const nextHost = room.participants.keys().next().value;
        if (nextHost) {
          room.hostSocketIds.add(nextHost);
          room.videoSource = null;
          room.videoUrl = null;
          io.to(nextHost).emit('host:promoted', {});
        } else {
          rooms.delete(roomId);
          return;
        }
      }

      io.to(roomId).emit('participants:update', _participantList(room));
      console.log(`[disconnect] ${socket.data.name} left ${roomId}`);
    });
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n  🎬 WatchAlong ready → http://localhost:${PORT}\n`);
  });
});

function _participantList(room) {
  return Array.from(room.participants.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    isHost: room.hostSocketIds.has(id),
    camOn: info.camOn,
    micOn: info.micOn,
  }));
}
