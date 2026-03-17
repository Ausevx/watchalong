/**
 * Custom Node.js server: Next.js + Socket.IO + static HLS serving
 * Run via: node server/index.js  (or npm run dev)
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory room state
const rooms = new Map();

// Safe static file server for /hls-output
function serveStatic(req, res, baseDir, prefix) {
  const relPath = decodeURIComponent(req.url.slice(prefix.length).split('?')[0]);
  const segments = relPath.split('/').filter(s => s && s !== '..' && s !== '.');
  const safePath = path.join(baseDir, ...segments);

  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }

  const ext = path.extname(safePath);
  const mime = {
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts':   'video/mp2t',
    '.mp4':  'video/mp4',
    '.mkv':  'video/x-matroska',
  };
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  fs.createReadStream(safePath).pipe(res);
}

app.prepare().then(() => {
  const hlsOutputDir = path.join(process.cwd(), 'hls-output');
  fs.mkdirSync(hlsOutputDir, { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'uploads'), { recursive: true });

  const httpServer = createServer((req, res) => {
    // Serve HLS segments and manifests directly
    if (req.url && req.url.startsWith('/hls-output/')) {
      serveStatic(req, res, hlsOutputDir, '/hls-output');
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
          hostSocketId: socket.id,
          videoSource: null,
          videoUrl: null,
          currentTime: 0,
          isPlaying: false,
          participants: new Map(),
        });
      }

      const room = rooms.get(roomId);
      room.participants.set(socket.id, { name: socket.data.name });
      const isHost = room.hostSocketId === socket.id;

      socket.emit('sync:init', {
        videoSource: room.videoSource,
        videoUrl: room.videoUrl,
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
      if (!room || room.hostSocketId !== socket.id) return;

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

    // ── Host sets video source ──────────────────────────────────────────────
    socket.on('video:set', (payload) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || room.hostSocketId !== socket.id) return;

      room.videoSource = payload.videoSource;
      room.videoUrl = payload.videoUrl;
      room.currentTime = 0;
      room.isPlaying = false;

      io.to(roomId).emit('video:set', {
        videoSource: room.videoSource,
        videoUrl: room.videoUrl,
        currentTime: 0,
        isPlaying: false,
      });
    });

    // ── Chat ────────────────────────────────────────────────────────────────
    socket.on('chat:message', ({ text }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      io.to(roomId).emit('chat:message', {
        from: socket.data.name || 'Guest',
        text: String(text).slice(0, 500),
        timestamp: Date.now(),
      });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      room.participants.delete(socket.id);

      if (room.hostSocketId === socket.id) {
        const nextHost = room.participants.keys().next().value;
        if (nextHost) {
          room.hostSocketId = nextHost;
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
    isHost: id === room.hostSocketId,
  }));
}
