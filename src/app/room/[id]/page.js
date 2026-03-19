'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useWebRTC } from '@/hooks/useWebRTC';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const YouTubePlayer   = dynamic(() => import('@/components/YouTubePlayer/YouTubePlayer'), { ssr: false });
const Chat           = dynamic(() => import('@/components/Chat/Chat'), { ssr: false });
const ParticipantList = dynamic(() => import('@/components/ParticipantList/ParticipantList'), { ssr: false });

function WatchRoom() {
  const { id: roomId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const nameFromUrl = searchParams.get('name');
  const isHostParam = searchParams.get('host') === '1' ||
    (typeof window !== 'undefined' && sessionStorage?.getItem(`wa_host_${roomId}`) === '1');

  const [name, setName] = useState(null);
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(isHostParam);
  const [videoSource, setVideoSource] = useState(null); // 'youtube' | null
  const [videoUrl, setVideoUrl] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [ytInput, setYtInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(1);
  const [toastMsg, setToastMsg] = useState(null);

  const { localStream, remoteStreams, startStream, stopStream, toggleVideo, toggleAudio, camOn, micOn } = useWebRTC(participants);

  // ── Name resolution ──
  useEffect(() => {
    const sessionName = typeof window !== 'undefined' ? sessionStorage?.getItem('wa_name') : null;
    const resolvedName = nameFromUrl || sessionName;
    if (!resolvedName || resolvedName === 'Guest') {
      if (!isHostParam) router.push(`/?room=${roomId}`);
    } else {
      if (typeof window !== 'undefined') sessionStorage.setItem('wa_name', resolvedName);
      setName(resolvedName);
    }
  }, [roomId, router, nameFromUrl, isHostParam]);

  // ── Load room ──
  useEffect(() => {
    if (!name) return;
    fetch(`/api/rooms/${roomId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!data) { router.push('/'); return; } setRoom(data); });
  }, [roomId, router, name]);

  // ── Socket.IO ──
  useEffect(() => {
    if (!name || !roomId) return;
    const socket = getSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('room:join', { roomId, name });

    socket.on('participants:update', (list) => setParticipants(list));

    socket.on('sync:init', ({ videoSource: vs, videoUrl: vu, isHost: ih }) => {
      if (vs) setVideoSource(vs);
      if (vu) setVideoUrl(vu);
      setIsHost(prev => ih ?? prev);
    });
    socket.on('video:set', ({ videoSource: vs, videoUrl: vu }) => {
      setVideoSource(vs ?? null); setVideoUrl(vu ?? null);
    });
    socket.on('host:promoted', () => {
      setIsHost(true);
      sessionStorage.setItem(`wa_host_${roomId}`, '1');
    });
    socket.on('host:demoted', () => {
      setIsHost(false);
      sessionStorage.removeItem(`wa_host_${roomId}`);
    });
    socket.on('sync:request', ({ from }) => {
      setToastMsg(`🔔 ${from} requested to play/pause.`);
      setTimeout(() => setToastMsg(null), 5000);
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



  const handleRequestPlayPause = () => {
    getSocket().emit('sync:request', { action: 'toggle' });
    setToastMsg('Request sent to host!');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    const cleanUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(cleanUrl);
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
      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <a href="/" className={styles.logo}>WATCHALONG</a>
          <span className={styles.roomName}>{room.name}</span>
          {isHost && <span className={styles.hostBadge}>HOST</span>}
        </div>
        <div className={styles.topRight}>
          <div className={styles.volumeControl}>
            <span>VOL</span>
            <input
              type="range" min="0" max="1" step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>

          {!isHost && videoSource && (
            <button className={styles.requestBtn} onClick={handleRequestPlayPause}>
              🔔 Request Play/Pause
            </button>
          )}

          <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`} />
          <span className={styles.statusText}>{connected ? 'LIVE' : 'RECONNECTING'}</span>
          <div className={styles.codeBox}>
            <span className={styles.codeLabel}>CODE</span>
            <span className={styles.code}>{room.code}</span>
            <button className={styles.copyBtn} onClick={copyCode} title="Copy code">
              {copied ? '✓' : '⧉'}
            </button>
          </div>
          
          {!localStream ? (
            <button className={styles.shareBtn} onClick={startStream} style={{ background: 'rgba(255,255,255,0.1)' }}>
              📷 JOIN AV
            </button>
          ) : (
            <>
              <button className={styles.shareBtn} onClick={toggleVideo} style={{ color: camOn ? 'inherit' : '#ef4444' }}>
                {camOn ? '📹 CAM' : '🚫 CAM'}
              </button>
              <button className={styles.shareBtn} onClick={toggleAudio} style={{ color: micOn ? 'inherit' : '#ef4444' }}>
                {micOn ? '🎙️ MIC' : '🔇 MIC'}
              </button>
              <button className={styles.shareBtn} onClick={stopStream} style={{ color: '#ef4444' }}>
                ❌ LEAVE
              </button>
            </>
          )}

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
            {/* No source yet */}
            {!videoSource && (
              <div className={styles.placeholder}>
                <p className={styles.placeholderTitle}>
                  {isHost ? 'CHOOSE A VIDEO' : 'WAITING FOR HOST'}
                </p>
                <p className={styles.placeholderSub}>
                  {isHost
                    ? 'Paste a YouTube link below'
                    : 'The host will start a video shortly…'}
                </p>
              </div>
            )}

            {/* YouTube */}
            {videoSource === 'youtube' && videoUrl && (
              <YouTubePlayer videoUrl={videoUrl} isHost={isHost} roomId={roomId} volume={volume} />
            )}
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className={styles.hostControls}>
              {/* YouTube URL input */}
              <span className={styles.sectionLabel}>▸ YouTube</span>
              <form className={styles.ytForm} onSubmit={handleSetYoutube}>
                <div className={styles.ytRow}>
                  <input
                    className="input-field"
                    placeholder="https://youtube.com/watch?v=…"
                    value={ytInput}
                    onChange={(e) => setYtInput(e.target.value)}
                  />
                  <button className="btn-ghost" type="submit" style={{ flexShrink: 0 }}>Load</button>
                </div>
              </form>
            </div>

          )}

        </div>

        {/* Right: Sidebar */}
        <aside className={styles.sidebar}>
          <ParticipantList 
            participants={participants} 
            localStream={localStream} 
            remoteStreams={remoteStreams} 
            localCamOn={camOn} 
            localMicOn={micOn} 
          />
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
