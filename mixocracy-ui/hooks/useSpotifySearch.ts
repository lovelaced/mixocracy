import { useState, useCallback, useRef } from 'react';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  uri: string;
  preview_url: string | null;
  duration_ms: number;
}

export function useSpotifySearch() {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const tokenExpiryRef = useRef<number>(0);

  const getAccessToken = async () => {
    if (tokenRef.current && Date.now() < tokenExpiryRef.current) {
      return tokenRef.current;
    }
    
    const response = await fetch('/api/spotify/token');
    const data = await response.json();
    tokenRef.current = data.access_token;
    tokenExpiryRef.current = Date.now() + 3600 * 1000; // 1 hour
    return data.access_token;
  };

  const searchTracks = useCallback(async (query: string) => {
    if (!query.trim()) {
      setTracks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to search tracks');

      const data = await response.json();
      setTracks(data.tracks.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { searchTracks, tracks, loading, error };
}