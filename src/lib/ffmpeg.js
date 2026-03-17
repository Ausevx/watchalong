import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma.js';

/**
 * Supported input formats: mp4, mkv, avi, mov, webm (and anything FFmpeg can decode)
 * Output: HLS with 3 quality levels + master playlist
 */
export async function spawnFFmpeg({ videoId, roomId, rawPath, filename, hlsOutputDir }) {
  const outDir = path.join(hlsOutputDir, videoId);
  fs.mkdirSync(outDir, { recursive: true });

  const masterPath = path.join(outDir, 'master.m3u8');

  return new Promise((resolve, reject) => {
    const args = [
      '-i', rawPath,
      '-y',
      // Three video streams
      '-filter_complex',
      '[0:v]split=3[v1][v2][v3]; [v1]scale=w=640:h=360[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=1920:h=1080[v3out]',
      // 360p
      '-map', '[v1out]', '-map', '0:a?',
      '-c:v:0', 'libx264', '-b:v:0', '800k', '-maxrate:v:0', '856k', '-bufsize:v:0', '1200k',
      '-c:a:0', 'aac', '-b:a:0', '96k', '-ac', '2',
      // 720p
      '-map', '[v2out]', '-map', '0:a?',
      '-c:v:1', 'libx264', '-b:v:1', '2500k', '-maxrate:v:1', '2678k', '-bufsize:v:1', '3750k',
      '-c:a:1', 'aac', '-b:a:1', '128k', '-ac', '2',
      // 1080p
      '-map', '[v3out]', '-map', '0:a?',
      '-c:v:2', 'libx264', '-b:v:2', '5000k', '-maxrate:v:2', '5350k', '-bufsize:v:2', '7500k',
      '-c:a:2', 'aac', '-b:a:2', '192k', '-ac', '2',
      // HLS output
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(outDir, 'stream_%v/seg_%03d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0,name:360p v:1,a:1,name:720p v:2,a:2,name:1080p',
      path.join(outDir, 'stream_%v/index.m3u8'),
    ];

    const ff = spawn(ffmpegPath, args);

    let duration = null;

    ff.stderr.on('data', (chunk) => {
      const line = chunk.toString();

      // Parse duration once
      if (!duration) {
        const m = line.match(/Duration:\s*(\d+):(\d+):(\d+)/);
        if (m) {
          duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
        }
      }

      // Parse current time to compute progress
      if (duration) {
        const t = line.match(/time=(\d+):(\d+):(\d+)/);
        if (t) {
          const current = parseInt(t[1]) * 3600 + parseInt(t[2]) * 60 + parseInt(t[3]);
          const progress = Math.min(Math.round((current / duration) * 100), 99);
          // Update DB progress (fire-and-forget)
          prisma.video
            .update({ where: { id: videoId }, data: { progress } })
            .catch(() => {});
        }
      }
    });

    ff.on('close', async (code) => {
      if (code === 0) {
        const hlsRelPath = `/hls-output/${videoId}/master.m3u8`;
        await prisma.video.update({
          where: { id: videoId },
          data: { status: 'ready', hlsPath: hlsRelPath, progress: 100 },
        });
        console.log(`[ffmpeg] ✓ ${videoId} → ${hlsRelPath}`);
        resolve(hlsRelPath);
      } else {
        await prisma.video.update({
          where: { id: videoId },
          data: { status: 'error' },
        });
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ff.on('error', reject);
  });
}
