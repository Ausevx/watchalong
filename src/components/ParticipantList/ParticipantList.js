'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './ParticipantList.module.css';

function ParticipantVideo({ stream, isLocal, camOn, micOn }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className={styles.videoWrapper}>
      {!camOn && (
        <div className={styles.videoHiddenOverlay}>
          <span style={{ fontSize: '1.4rem', filter: 'grayscale(1)' }}>📷</span>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`${styles.video} ${isLocal ? styles.local : ''}`}
        style={{ opacity: camOn ? 1 : 0 }}
      />
      {!micOn && (
        <div className={styles.mutedBubble}>
          🔇
        </div>
      )}
    </div>
  );
}

export default function ParticipantList({ participants = [], localStream, remoteStreams, localCamOn, localMicOn }) {
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    setMyId(getSocket()?.id);
  }, []);

  const me = participants.find(p => p.id === myId);
  const isMeHost = me?.isHost;

  const toggleHost = (userId, currentIsHost) => {
    const action = currentIsHost ? 'revoke host privileges from' : 'grant host privileges to';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
      getSocket().emit('host:toggle', { targetId: userId });
    }
  };

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.icon}>👥</span>
        Viewers <span className={styles.count}>{participants.length}</span>
      </div>
      <ul className={styles.ul}>
        {participants.map((p) => {
          const stream = p.id === myId ? localStream : remoteStreams?.[p.id];
          return (
            <li key={p.id} className={styles.item}>
              <ParticipantVideo 
                stream={stream} 
                isLocal={p.id === myId} 
                camOn={p.id === myId ? localCamOn : p.camOn}
                micOn={p.id === myId ? localMicOn : p.micOn}
              />
              
              <div className={styles.nameRow}>
                <span className={styles.dot} />
                <span className={styles.name}>
                  {p.name} {p.id === myId ? '(You)' : ''}
                </span>
                {p.isHost && <span className={styles.badge}>HOST</span>}
                {isMeHost && p.id !== myId && (
                  <button 
                    className={styles.makeHostBtn} 
                    onClick={() => toggleHost(p.id, p.isHost)}
                    title={p.isHost ? "Revoke host privileges" : "Grant host privileges"}
                  >
                    {p.isHost ? "Remove Host" : "Add Host"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
