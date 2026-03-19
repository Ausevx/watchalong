'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './YouTubePlayer.module.css';

let ytApiLoaded = false;
let ytApiCallbacks = [];

function loadYtApi(cb) {
  if (ytApiLoaded) { cb(); return; }
  ytApiCallbacks.push(cb);
  if (ytApiCallbacks.length > 1) return;
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

export default function YouTubePlayer({ videoUrl, isHost, roomId, volume = 1 }) {
  const wrapperRef = useRef(null);
  const playerDivRef = useRef(null);
  const playerRef = useRef(null);
  const suppressEvents = useRef(false);
  const currentVideoId = useRef(null);
  // Always-current ref so stale closures inside YT callbacks see latest isHost
  const isHostRef = useRef(isHost);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  // Create a stable, React-unmanaged div that YouTube can safely replace with an iframe
  useEffect(() => {
    if (!wrapperRef.current || playerDivRef.current) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    wrapperRef.current.insertBefore(div, wrapperRef.current.firstChild);
    playerDivRef.current = div;
  }, []);

  // Apply volume changes
  useEffect(() => {
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(volume * 100);
    }
  }, [volume]);

  // Initialise or reload the player when videoUrl changes.
  // Note: onStateChange reads isHostRef so it always has the latest value,
  // even if the user was promoted to host after the player was created.
  useEffect(() => {
    if (!videoUrl || !playerDivRef.current) return;
    const videoId = extractVideoId(videoUrl);

    loadYtApi(() => {
      if (playerRef.current) {
        if (currentVideoId.current !== videoId) {
          playerRef.current.loadVideoById(videoId);
          currentVideoId.current = videoId;
        }
        return;
      }
      currentVideoId.current = videoId;
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: {
          // controls are always on; non-hosts have a click-blocking overlay
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          enablejsapi: 1,
        },
        events: {
          onReady: () => {},
          onStateChange: (e) => {
            // Only the current host emits sync events,
            // and never when we're already reacting to an incoming sync.
            if (!isHostRef.current || suppressEvents.current) return;
            if (window._ytSyncTimeout) clearTimeout(window._ytSyncTimeout);
            window._ytSyncTimeout = setTimeout(() => {
              const state = e.data;
              const time = playerRef.current?.getCurrentTime?.() ?? 0;
              if (state === window.YT.PlayerState.PLAYING) {
                getSocket().emit('sync:state', { action: 'play', currentTime: time });
              } else if (state === window.YT.PlayerState.PAUSED) {
                getSocket().emit('sync:state', { action: 'pause', currentTime: time });
              }
            }, 250);
          },
        },
      });
    });
  }, [videoUrl, roomId]);

  // ALL clients (hosts included) receive sync events so the room stays in lock-step.
  // suppressEvents prevents an incoming sync from triggering a re-broadcast loop.
  useEffect(() => {
    const socket = getSocket();

    const onSync = ({ action, currentTime }) => {
      const p = playerRef.current;
      if (!p || suppressEvents.current) return;
      suppressEvents.current = true;
      if (action === 'seek' || Math.abs(p.getCurrentTime() - currentTime) > 2) {
        p.seekTo(currentTime, true);
      }
      if (action === 'play') p.playVideo();
      if (action === 'pause') p.pauseVideo();
      setTimeout(() => { suppressEvents.current = false; }, 300);
    };

    const onInit = ({ currentTime, isPlaying }) => {
      const p = playerRef.current;
      if (!p || isHostRef.current) return; // hosts already know their position
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
  }, []); // runs once — uses isHostRef for current value

  const handleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* playerDivRef is inserted imperatively above */}

      {/* Overlay blocks viewer clicks on YT controls; hidden for hosts */}
      {!isHost && (
        <div className={styles.overlay} title="Only the host controls playback" />
      )}

      {/* Fullscreen button — visible to everyone on hover */}
      <button
        className={styles.fullscreenBtn}
        onClick={handleFullscreen}
        title="Fullscreen"
      >
        ⛶
      </button>
    </div>
  );
}
