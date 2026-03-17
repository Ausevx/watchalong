'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './VideoPlayer.module.css';

export default function VideoPlayer({ hlsUrl, isHost }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const suppressRef = useRef(false);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    // Tear down old HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;

    async function init() {
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = hlsUrl;
      }
    }
    init();

    return () => {
      hlsRef.current?.destroy();
    };
  }, [hlsUrl]);

  // Host: emit sync events on play/pause/seek
  useEffect(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;

    const emit = (action) => {
      if (suppressRef.current) return;
      getSocket().emit('sync:state', { action, currentTime: video.currentTime });
    };

    const onPlay = () => emit('play');
    const onPause = () => emit('pause');
    const onSeeked = () => emit('seek');

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [isHost, hlsUrl]);

  // Non-host: receive and apply sync
  useEffect(() => {
    if (isHost) return;
    const socket = getSocket();
    const video = videoRef.current;

    const apply = ({ action, currentTime }) => {
      if (!video) return;
      suppressRef.current = true;
      if (action === 'seek' || Math.abs(video.currentTime - currentTime) > 1.5) {
        video.currentTime = currentTime;
      }
      if (action === 'play') video.play().catch(() => {});
      if (action === 'pause') video.pause();
      setTimeout(() => { suppressRef.current = false; }, 200);
    };

    const onInit = ({ currentTime, isPlaying }) => {
      if (!video) return;
      suppressRef.current = true;
      video.currentTime = currentTime;
      if (isPlaying) video.play().catch(() => {}); else video.pause();
      setTimeout(() => { suppressRef.current = false; }, 300);
    };

    socket.on('sync:state', apply);
    socket.on('sync:init', onInit);
    return () => {
      socket.off('sync:state', apply);
      socket.off('sync:init', onInit);
    };
  }, [isHost, hlsUrl]);

  return (
    <div className={styles.wrapper}>
      <video
        ref={videoRef}
        className={styles.video}
        controls={isHost}
        playsInline
      />
      {!isHost && <div className={styles.overlay} />}
    </div>
  );
}
