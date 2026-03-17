'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import styles from './Chat.module.css';

export default function Chat({ roomId, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    const handler = (msg) => setMessages((prev) => [...prev.slice(-199), msg]);
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    getSocket().emit('chat:message', { text });
    setInput('');
  };

  return (
    <div className={styles.chat}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>CHAT</span>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>No messages yet.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${m.from === userName ? styles.own : ''}`}>
            <span className={styles.from}>{m.from === userName ? 'YOU' : m.from}</span>
            <span className={styles.text}>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className={styles.form} onSubmit={sendMessage}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
        />
        <button className={styles.sendBtn} type="submit" aria-label="Send">➤</button>
      </form>
    </div>
  );
}
