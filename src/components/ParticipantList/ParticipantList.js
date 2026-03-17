'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './ParticipantList.module.css';

export default function ParticipantList() {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (list) => setParticipants(list);
    socket.on('participants:update', handler);
    return () => socket.off('participants:update', handler);
  }, []);

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.icon}>👥</span>
        Viewers <span className={styles.count}>{participants.length}</span>
      </div>
      <ul className={styles.ul}>
        {participants.map((p) => (
          <li key={p.id} className={styles.item}>
            <span className={styles.dot} />
            <span className={styles.name}>{p.name}</span>
            {p.isHost && <span className={styles.badge}>HOST</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
