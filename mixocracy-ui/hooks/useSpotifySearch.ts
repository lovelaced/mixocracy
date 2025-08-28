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
  popularity?: number;
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

  const searchTracks = useCallback(async (query: string, artist?: string) => {
    if (!query.trim()) {
      setTracks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      
      // Build search query - keep it simple for drunk people
      // Just use the raw query, Spotify is pretty good at figuring it out
      const searchQuery = query;
      
      // Search for more results to filter through
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to search tracks');

      const data = await response.json();
      let results = data.tracks.items as SpotifyTrack[];
      
      // Filter out obvious bad results and sort by relevance + popularity
      const queryLower = query.toLowerCase();
      
      results = results
        .filter(track => {
          // Filter out karaoke and instrumental versions
          const lowerName = track.name.toLowerCase();
          const lowerAlbum = track.album.name.toLowerCase();
          const isKaraoke = lowerName.includes('karaoke') || lowerAlbum.includes('karaoke');
          const isInstrumental = lowerName.includes('instrumental') || lowerAlbum.includes('instrumental');
          
          return !isKaraoke && !isInstrumental;
        })
        .map(track => {
          const trackName = track.name.toLowerCase();
          const artistName = track.artists[0].name.toLowerCase();
          const combined = `${trackName} ${artistName}`;
          
          // Calculate relevance score
          let score = 0;
          
          // Exact match in track name = highest priority
          if (trackName === queryLower) score += 1000;
          
          // Query contains both track and artist name (like "all star smash mouth")
          const words = queryLower.split(' ').filter(w => w.length > 1);
          const trackWords = words.filter(w => trackName.includes(w));
          const artistWords = words.filter(w => artistName.includes(w));
          
          // If we have matches in both track and artist, that's a strong signal
          if (trackWords.length > 0 && artistWords.length > 0) {
            score += 500;
          }
          
          // Track name contains the full query
          if (trackName.includes(queryLower)) score += 200;
          
          // Combined string contains the full query
          if (combined.includes(queryLower)) score += 100;
          
          // Percentage of query words found
          const matchPercentage = words.filter(w => combined.includes(w)).length / words.length;
          score += matchPercentage * 50;
          
          // Add popularity as a tiebreaker
          score += (track.popularity || 0) / 100;
          
          return { ...track, relevanceScore: score };
        })
        .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10); // Return top 10 results
      
      setTracks(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { searchTracks, tracks, loading, error };
}