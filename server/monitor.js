#!/usr/bin/env node
const http = require('http');

http.get('http://localhost:3000/api/cli/rooms', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('\n======================================');
      console.log('📡 WATCHALONG - ACTIVE ROOMS');
      console.log('======================================\n');
      
      if (parsed.activeRooms === 0) {
        console.log('No active rooms at the moment.\n');
        return;
      }
      
      parsed.rooms.forEach(room => {
        console.log(`🏠 Room: ${room.roomId}`);
        console.log(`   Participants: ${room.participantCount}`);
        console.log('   Users:');
        room.participants.forEach(p => {
          console.log(`     - ${p.name} ${p.isHost ? '(HOST)' : ''}`);
        });
        console.log(`   Video: ${room.videoSource ? `[${room.videoSource}] ${room.videoUrl}` : 'None'}`);
        console.log('--------------------------------------');
      });
      console.log(`\nTotal Active Rooms: ${parsed.activeRooms}\n`);
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  });
}).on('error', (err) => {
  console.error('Error connecting to WatchAlong server:', err.message);
});
