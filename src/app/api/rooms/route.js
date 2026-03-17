import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// Generate a short room code
function generateCode() {
  return randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9B2"
}

// POST /api/rooms — create a new room
export async function POST(req) {
  const { name, hostId } = await req.json();
  if (!name || !hostId) {
    return NextResponse.json({ error: 'name and hostId required' }, { status: 400 });
  }
  const code = generateCode();
  const room = await prisma.room.create({
    data: { name, hostId, code },
  });
  return NextResponse.json(room, { status: 201 });
}

// GET /api/rooms?code=XXX — find room by code
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  return NextResponse.json(room);
}
