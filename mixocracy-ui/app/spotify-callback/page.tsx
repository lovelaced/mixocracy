'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SpotifyAuth } from '@/lib/spotify-auth';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

function SpotifyCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      router.push('/?spotify_error=true');
      return;
    }

    if (code) {
      SpotifyAuth.handleCallback(code)
        .then(() => {
          router.push('/?spotify_connected=true');
        })
        .catch((err) => {
          console.error('Failed to exchange code:', err);
          router.push('/?spotify_error=true');
        });
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-lg">Connecting to Spotify...</h2>
        <ArrowPathIcon className="w-12 h-12 animate-spin text-accent mx-auto" />
      </div>
    </div>
  );
}

export default function SpotifyCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-lg">Loading...</h2>
          <ArrowPathIcon className="w-12 h-12 animate-spin text-accent mx-auto" />
        </div>
      </div>
    }>
      <SpotifyCallbackContent />
    </Suspense>
  );
}