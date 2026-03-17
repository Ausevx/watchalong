'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './page.module.css';

function CreateRoomForm() {
  const router = useRouter();
  const params = useSearchParams();
  const name = params.get('name') || (typeof window !== 'undefined' && sessionStorage?.getItem('wa_name')) || 'Host';

  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) { setError('Room name cannot be empty.'); return; }
    setCreating(true); setError('');

    try {
      const hostId = `host_${Date.now()}`;
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim(), hostId }),
      });
      if (!res.ok) throw new Error('Create failed');
      const room = await res.json();
      sessionStorage.setItem('wa_name', name);
      sessionStorage.setItem(`wa_host_${room.id}`, '1');
      router.push(`/room/${room.id}?name=${encodeURIComponent(name)}&host=1`);
    } catch {
      setError('Could not create room.');
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <a href="/" className={styles.logo}>
          <span className={styles.logoDot} />
          WATCHALONG
        </a>
      </nav>

      {/* Decorative blob */}
      <div className={styles.blob} />

      {/* Content */}
      <div className={styles.content}>
        <p className={styles.step}>STEP 01</p>
        <h1 className={styles.title}>
          NAME YOUR<br />
          <span className={styles.pink}>ROOM.</span>
        </h1>
        <p className={styles.sub}>You'll be the host — you control playback.</p>

        <form className={styles.form} onSubmit={handleCreate}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="room-name">ROOM NAME</label>
            <input
              id="room-name"
              className="input-field"
              placeholder="e.g. Movie Night 🎬"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className="btn-primary" type="submit" disabled={creating} style={{ width: '100%' }}>
            {creating ? 'Creating…' : 'Create Room →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CreateRoomPage() {
  return <Suspense><CreateRoomForm /></Suspense>;
}
