'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { setError('Enter your name and a room code.'); return; }
    setJoining(true); setError('');
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) { setError('Room not found — check the code.'); setJoining(false); return; }
      const room = await res.json();
      sessionStorage.setItem('wa_name', name.trim());
      router.push(`/room/${room.id}?name=${encodeURIComponent(name.trim())}`);
    } catch {
      setError('Something went wrong.');
      setJoining(false);
    }
  };

  const handleCreate = () => {
    if (!name.trim()) { setError('Enter your name first.'); return; }
    sessionStorage.setItem('wa_name', name.trim());
    router.push(`/room/create?name=${encodeURIComponent(name.trim())}`);
  };

  return (
    <div className={styles.page}>

      {/* ── Nav ─────────────────────── */}
      <nav className={styles.nav}>
        <span className={styles.logo}>
          <span className={styles.logoDot} />
          WATCHALONG
        </span>
        <button className="btn-ghost" onClick={handleCreate}>start a room</button>
      </nav>

      {/* ── Hero ────────────────────── */}
      <section className={styles.hero}>
        {/* Floating decorative blobs */}
        <div className={`${styles.blob} ${styles.blob1}`} />
        <div className={`${styles.blob} ${styles.blob2}`} />
        <div className={`${styles.blob} ${styles.blob3}`} />

        <div className={styles.heroInner}>
          <p className={styles.heroTag}>🎬 real-time · frame-perfect · no plugins</p>

          <h1 className={styles.heroTitle}>
            <span className={styles.heroLine1}>WATCH</span>
            <span className={styles.heroLine2}>TOGETHER</span>
            <span className={styles.heroLine3}>IN SYNC<span className={styles.heroDot}>.</span></span>
          </h1>

          <p className={styles.heroSub}>
            Create a room. Share the link.<br />
            Stream <span className={styles.pink}>YouTube</span> or your own files — synced for everyone.
          </p>
        </div>
      </section>

      {/* ── Entry card ─────────────── */}
      <section className={styles.entry}>
        <div className={styles.entryCard}>
          <div className={styles.entryLeft}>
            <label className={styles.fieldLabel}>YOUR NAME</label>
            <input
              id="display-name"
              className="input-field"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.entryDivider} />

          <div className={styles.entryRight}>
            <button
              className={`btn-primary ${styles.createBtn}`}
              onClick={handleCreate}
            >
              ✦ Create Room
            </button>

            <form className={styles.joinForm} onSubmit={handleJoin}>
              <input
                className="input-field"
                placeholder="Room code — A3F9B2"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ letterSpacing: '0.12em', fontWeight: 700 }}
              />
              <button className="btn-ghost" type="submit" disabled={joining}>
                {joining ? '…' : 'Join →'}
              </button>
            </form>
          </div>
        </div>

        <p className={styles.formats}>
          MP4 · MKV · AVI · MOV · WebM · YouTube
        </p>
      </section>

      {/* ── Footer strip ─────────────── */}
      <footer className={styles.footer}>
        <span>WATCHALONG</span>
        <span>Sync. Stream. Together.</span>
      </footer>
    </div>
  );
}
