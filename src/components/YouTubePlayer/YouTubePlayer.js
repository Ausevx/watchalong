'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './YouTubePlayer.module.css';

let ytApiLoaded = false;
let ytApiCallbacks = [];

function loadYtApi(cb) {
  if (ytApiLoaded) { cb(); return; }
  ytApiCallbacks.push(cb);
  if (ytApiCallbacks.length > 1) return; // already loading
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytApiLoaded = true;
    ytApiCallbacks.forEach(fn => fn());
    ytApiCallbacks = [];
  };
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').pop();
  } catch {
    return url;
  }
}

export default function YouTubePlayer({ videoUrl, isHost, roomId }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const suppressEvents = useRef(false);

  // Initialise the player once videoUrl is set
  useEffect(() => {
    if (!videoUrl) return;
    const videoId = extractVideoId(videoUrl);

    loadYtApi(() => {
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
        return;
      }
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: { controls: isHost ? 1 : 0, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (!isHost || suppressEvents.current) return;
            const socket = getSocket();
            const state = e.data;
            const time = playerRef.current?.getCurrentTime?.() ?? 0;

            if (state === window.YT.PlayerState.PLAYING) {
              socket.emit('sync:state', { action: 'play', currentTime: time });
            } else if (state === window.YT.PlayerState.PAUSED) {
              socket.emit('sync:state', { action: 'pause', currentTime: time });
            }
          },
        },
      });
    });
  }, [videoUrl, isHost]);

  // Handle seek-bar changes (host only)
  const onSeek = useCallback(() => {
    if (!isHost || !playerRef.current) return;
    const time = playerRef.current.getCurrentTime();
    getSocket().emit('sync:state', { action: 'seek', currentTime: time });
  }, [isHost]);

  // Listen for sync events from server (non-host)
  useEffect(() => {
    if (isHost) return;
    const socket = getSocket();

    const onSync = ({ action, currentTime }) => {
      const p = playerRef.current;
      if (!p) return;
      suppressEvents.current = true;
      if (action === 'seek' || Math.abs(p.getCurrentTime() - currentTime) > 1) {
        p.seekTo(currentTime, true);
      }
      if (action === 'play') p.playVideo();
      if (action === 'pause') p.pauseVideo();
      setTimeout(() => { suppressEvents.current = false; }, 200);
    };

    const onInit = ({ currentTime, isPlaying }) => {
      const p = playerRef.current;
      if (!p) return;
      suppressEvents.current = true;
      p.seekTo(currentTime, true);
      if (isPlaying) p.playVideo(); else p.pauseVideo();
      setTimeout(() => { suppressEvents.current = false; }, 300);
    };

    socket.on('sync:state', onSync);
    socket.on('sync:init', onInit);
    return () => {
      socket.off('sync:state', onSync);
      socket.off('sync:init', onInit);
    };
  }, [isHost]);

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.player} />
      {!isHost && <div className={styles.overlay} title="Only the host controls playback" />}
    </div>
  );
}
