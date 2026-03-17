import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/videos/[id] — poll transcoding status
export async function GET(req, { params }) {
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(video);
}
