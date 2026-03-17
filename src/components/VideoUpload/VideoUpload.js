'use client';

import { useState, useRef, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './VideoUpload.module.css';

const ACCEPT = '.mp4,.mkv,.avi,.mov,.webm,video/*';
const MAX_SIZE_GB = 4;

export default function VideoUpload({ roomId, onVideoReady }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | transcoding | ready | error
  const [uploadPct, setUploadPct] = useState(0);
  const [transcodePct, setTranscodePct] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [videoId, setVideoId] = useState(null);
  const pollRef = useRef(null);

  // Poll the video status API while transcoding
  useEffect(() => {
    if (status !== 'transcoding' || !videoId) return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/videos/${videoId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTranscodePct(data.progress);

      if (data.status === 'ready') {
        clearInterval(pollRef.current);
        setStatus('ready');
        // Tell parent: switch the room to this HLS stream
        onVideoReady?.({ videoSource: 'upload', videoUrl: data.hlsPath, videoId });
        getSocket().emit('video:set', { videoSource: 'upload', videoUrl: data.hlsPath });
      } else if (data.status === 'error') {
        clearInterval(pollRef.current);
        setStatus('error');
        setErrorMsg('Transcoding failed — try a different file or format.');
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [status, videoId, onVideoReady]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE_GB * 1024 ** 3) {
      setErrorMsg(`File too large — max ${MAX_SIZE_GB} GB`);
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setUploadPct(0);
    setErrorMsg('');

    try {
      const { Upload } = await import('tus-js-client');

      await new Promise((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: '/api/upload',
          retryDelays: [0, 1000, 3000],
          metadata: {
            filename: encodeURIComponent(file.name),
            filetype: file.type,
            roomId,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadPct(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onAfterResponse: (req, res) => {
            // Extract videoId from response header set by tus server metadata
          },
          onError: reject,
          onSuccess: () => {
            const id = upload.url?.split('/').pop();
            setVideoId(id);
            setStatus('transcoding');
            resolve();
          },
        });
        upload.start();
      });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Upload failed — please try again.');
    }
  };

  return (
    <div className={styles.wrapper}>
      {status === 'idle' && (
        <label className={styles.dropzone}>
          <input
            type="file"
            accept={ACCEPT}
            className={styles.hidden}
            onChange={handleFile}
            id="video-file-input"
          />
          <div className={styles.dropContent}>
            <div className={styles.uploadIcon}>📁</div>
            <p className={styles.label}>Drop a video or <span>browse</span></p>
            <p className={styles.hint}>MP4 · MKV · AVI · MOV · WebM — up to {MAX_SIZE_GB} GB</p>
          </div>
        </label>
      )}

      {status === 'uploading' && (
        <div className={styles.progress}>
          <p className={styles.progressLabel}>Uploading… {uploadPct}%</p>
          <div className={styles.bar}><div className={styles.fill} style={{ width: `${uploadPct}%` }} /></div>
        </div>
      )}

      {status === 'transcoding' && (
        <div className={styles.progress}>
          <p className={styles.progressLabel}>🔄 Transcoding to HLS… {transcodePct}%</p>
          <div className={styles.bar}><div className={styles.fill} style={{ width: `${transcodePct}%` }} /></div>
          <p className={styles.hint}>Hang tight — preparing 360p / 720p / 1080p streams</p>
        </div>
      )}

      {status === 'ready' && (
        <div className={styles.ready}>
          <span className={styles.check}>✅</span>
          <p>Video ready! Streaming to everyone.</p>
          <button className={styles.again} onClick={() => setStatus('idle')}>Upload another</button>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error}>
          <span>⚠️</span> {errorMsg}
          <button className={styles.again} onClick={() => setStatus('idle')}>Try again</button>
        </div>
      )}
    </div>
  );
}
