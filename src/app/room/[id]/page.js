'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const YouTubePlayer = dynamic(() => import('@/components/YouTubePlayer/YouTubePlayer'), { ssr: false });
const VideoPlayer   = dynamic(() => import('@/components/VideoPlayer/VideoPlayer'), { ssr: false });
const Chat          = dynamic(() => import('@/components/Chat/Chat'), { ssr: false });
const ParticipantList = dynamic(() => import('@/components/ParticipantList/ParticipantList'), { ssr: false });
const VideoUpload   = dynamic(() => import('@/components/VideoUpload/VideoUpload'), { ssr: false });

function WatchRoom() {
  const { id: roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const name = searchParams.get('name') || (typeof window !== 'undefined' && sessionStorage?.getItem('wa_name')) || 'Guest';
  const isHostParam = searchParams.get('host') === '1' ||
    (typeof window !== 'undefined' && sessionStorage?.getItem(`wa_host_${roomId}`) === '1');

  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(isHostParam);
  const [videoSource, setVideoSource] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [ytInput, setYtInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  // Load room
  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!data) { router.push('/'); return; } setRoom(data); });
  }, [roomId, router]);

  // Socket
  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('room:join', { roomId, name });

    socket.on('sync:init', ({ videoSource: vs, videoUrl: vu, isHost: ih }) => {
      if (vs) setVideoSource(vs);
      if (vu) setVideoUrl(vu);
      setIsHost(prev => ih ?? prev);
    });
    socket.on('video:set', ({ videoSource: vs, videoUrl: vu }) => {
      setVideoSource(vs); setVideoUrl(vu);
    });
    socket.on('host:promoted', () => {
      setIsHost(true);
      sessionStorage.setItem(`wa_host_${roomId}`, '1');
    });

    return () => { disconnectSocket(); };
  }, [roomId, name]);

  const handleSetYoutube = (e) => {
    e.preventDefault();
    const url = ytInput.trim();
    if (!url) return;
    setVideoSource('youtube'); setVideoUrl(url);
    getSocket().emit('video:set', { videoSource: 'youtube', videoUrl: url });
    setYtInput('');
  };

  const handleVideoReady = ({ videoSource: vs, videoUrl: vu }) => {
    setVideoSource(vs); setVideoUrl(vu);
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingTitle}>LOADING...</p>
        <span className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <a href="/" className={styles.logo}>WATCHALONG</a>
          <span className={styles.roomName}>{room.name}</span>
          {isHost && <span className={styles.hostBadge}>HOST</span>}
        </div>
        <div className={styles.topRight}>
          <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`} />
          <span className={styles.statusText}>{connected ? 'LIVE' : 'RECONNECTING'}</span>
          <div className={styles.codeBox}>
            <span className={styles.codeLabel}>CODE</span>
            <span className={styles.code}>{room.code}</span>
            <button className={styles.copyBtn} onClick={copyCode} title="Copy code">
              {copied ? '✓' : '⧉'}
            </button>
          </div>
          <button className={styles.shareBtn} onClick={copyLink}>
            {copied ? '✓ COPIED' : 'SHARE'}
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.content}>
        {/* Left: Video */}
        <div className={styles.videoSide}>
          <div className={styles.playerBox}>
            {!videoUrl && (
              <div className={styles.placeholder}>
                <p className={styles.placeholderTitle}>
                  {isHost ? 'CHOOSE A VIDEO' : 'WAITING FOR HOST'}
                </p>
                <p className={styles.placeholderSub}>
                  {isHost
                    ? 'Paste a YouTube link or upload a file below'
                    : 'The host will load a video shortly…'}
                </p>
              </div>
            )}
            {videoUrl && videoSource === 'youtube' && (
              <YouTubePlayer videoUrl={videoUrl} isHost={isHost} roomId={roomId} />
            )}
            {videoUrl && videoSource === 'upload' && (
              <VideoPlayer hlsUrl={videoUrl} isHost={isHost} />
            )}
          </div>

          {isHost && (
            <div className={styles.hostControls}>
              <span className={styles.sectionLabel}>▸ YouTube</span>
              <form className={styles.ytForm} onSubmit={handleSetYoutube}>
                <div className={styles.ytRow}>
                  <input
                    className="input-field"
                    placeholder="https://youtube.com/watch?v=…"
                    value={ytInput}
                    onChange={(e) => setYtInput(e.target.value)}
                  />
                  <button className="btn-ghost" type="submit" style={{ flexShrink: 0 }}>
                    Load
                  </button>
                </div>
              </form>

              <div className={styles.orRow}>OR UPLOAD</div>

              <VideoUpload roomId={roomId} onVideoReady={handleVideoReady} />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <aside className={styles.sidebar}>
          <ParticipantList />
          <div className={styles.chatWrapper}>
            <Chat roomId={roomId} userName={name} />
          </div>
        </aside>
      </main>
    </div>
  );
}

export default function RoomPage() {
  return <Suspense><WatchRoom /></Suspense>;
}
