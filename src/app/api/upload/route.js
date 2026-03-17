import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { prisma } from '@/lib/prisma';
import path from 'path';
import { spawnFFmpeg } from '@/lib/ffmpeg';

const uploadDir = path.join(process.cwd(), 'uploads');
const hlsOutputDir = path.join(process.cwd(), 'hls-output');

const tusServer = new TusServer({
  path: '/api/upload',
  datastore: new FileStore({ directory: uploadDir }),

  onUploadCreate: async (req, upload) => {
    const roomId = upload.metadata?.roomId;
    if (!roomId) throw { status_code: 400, body: 'roomId required in metadata' };

    // Create a pending Video record
    const video = await prisma.video.create({
      data: {
        roomId,
        originalName: decodeURIComponent(upload.metadata?.filename || 'video'),
        status: 'pending',
      },
    });

    // Store videoId so we can access it on finish
    upload.metadata.videoId = video.id;
    return upload;
  },

  onUploadFinish: async (req, upload) => {
    const videoId = upload.metadata?.videoId;
    const roomId = upload.metadata?.roomId;
    const filename = decodeURIComponent(upload.metadata?.filename || 'video');
    const rawPath = path.join(uploadDir, upload.id);

    // Mark as transcoding
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'transcoding' },
    });

    // Start FFmpeg in background — non-blocking
    spawnFFmpeg({ videoId, roomId, rawPath, filename, hlsOutputDir }).catch(console.error);

    return upload;
  },
});

// Next.js App Router — ALL HTTP methods forwarded to tus
async function handler(req) {
  // Convert Web Request → Node-style req/res
  const { readable, writable } = new TransformStream();
  const nodeReq = req;
  const nodeRes = new Response(readable);

  return new Promise((resolve) => {
    tusServer.handle(req, nodeRes);
    resolve(nodeRes);
  });
}

// tus uses PATCH, POST, HEAD, DELETE
export { handler as GET, handler as POST, handler as PATCH, handler as HEAD, handler as DELETE, handler as OPTIONS };
