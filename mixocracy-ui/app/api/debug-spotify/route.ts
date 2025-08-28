import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID?.trim() || 'NOT_SET',
    redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI?.trim() || 'NOT_SET',
    hasSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
    nodeEnv: process.env.NODE_ENV,
  });
}