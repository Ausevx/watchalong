'use server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/rooms/[id] — get a single room + its videos
export async function GET(req, { params }) {
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    include: { videos: { orderBy: { createdAt: 'desc' } } },
  });
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(room);
}
