'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export function useWebRTC(participants) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);

  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Push new tracks when camera bounds change
  useEffect(() => {
    Object.values(peersRef.current).forEach(({ pc }) => {
      pc.getSenders().forEach(s => pc.removeTrack(s));
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
      }
    });
  }, [localStream]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // Unified factory
    const getOrCreatePeer = (targetId, politeReq) => {
      if (peersRef.current[targetId]) return peersRef.current[targetId];

      const polite = politeReq ?? (socket.id > targetId);
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      });

      let state = { pc, polite, makingOffer: false, ignoreOffer: false };
      peersRef.current[targetId] = state;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
      } else {
        // Create an empty data channel explicitly to force negotiation mapping 
        // to begin, even if neither user has a camera on yet!
        pc.createDataChannel('keepalive');
      }

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription();
          socket.emit('webrtc:signal', { target: targetId, signal: pc.localDescription });
        } catch (e) {
          console.error('[WebRTC] Negotiate error:', e);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('webrtc:signal', { target: targetId, signal: candidate });
      };

      pc.ontrack = ({ streams }) => {
        setRemoteStreams(prev => ({ ...prev, [targetId]: streams[0] }));
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[targetId];
            return next;
          });
        }
      };

      return state;
    };

    // Maintain mesh against changing participants
    const myId = socket.id;
    const validIds = new Set(participants.map(p => p.id));
    
    participants.forEach(p => {
      if (p.id !== myId) getOrCreatePeer(p.id);
    });

    Object.keys(peersRef.current).forEach(id => {
      if (!validIds.has(id)) {
        peersRef.current[id].pc.close();
        delete peersRef.current[id];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    // Signaling listener
    const handleSignal = async ({ sender, signal }) => {
      const peerObj = getOrCreatePeer(sender);
      const { pc } = peerObj;

      try {
        if (signal.type === 'offer' || signal.type === 'answer') {
          const offerCollision = signal.type === 'offer' && (peerObj.makingOffer || pc.signalingState !== 'stable');
          peerObj.ignoreOffer = !peerObj.polite && offerCollision;
          if (peerObj.ignoreOffer) return;

          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          if (signal.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('webrtc:signal', { target: sender, signal: pc.localDescription });
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          } catch (e) {
            if (!peerObj.ignoreOffer) throw e;
          }
        }
      } catch (err) {
        console.error('[WebRTC] Signal handling error:', err);
      }
    };

    socket.on('webrtc:signal', handleSignal);
    return () => socket.off('webrtc:signal', handleSignal);
  }, [participants]);

  const startStream = async () => {
    if (localStream) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setCamOn(true);
      setMicOn(true);
      getSocket()?.emit('webrtc:state', { camOn: true, micOn: true });
    } catch (err) {
      console.error("Camera/Mic access denied or missing:", err);
      alert("Camera/Mic access denied or no device found.");
    }
  };

  const stopStream = () => {
    if (!localStream) return;
    localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setCamOn(false);
    setMicOn(false);
    getSocket()?.emit('webrtc:state', { camOn: false, micOn: false });
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
      getSocket()?.emit('webrtc:state', { camOn: track.enabled, micOn });
    }
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
      getSocket()?.emit('webrtc:state', { camOn, micOn: track.enabled });
    }
  };

  return { localStream, remoteStreams, startStream, stopStream, toggleVideo, toggleAudio, camOn, micOn };
}
