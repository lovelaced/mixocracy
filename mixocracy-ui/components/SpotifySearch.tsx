'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSpotifySearch, SpotifyTrack } from '@/hooks/useSpotifySearch';
import { MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

interface SpotifySearchProps {
  onSelectTrack: (track: SpotifyTrack) => void;
  placeholder?: string;
}

export function SpotifySearch({ onSelectTrack, placeholder = "Search Spotify tracks..." }: SpotifySearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { searchTracks, tracks, loading } = useSpotifySearch();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      searchTracks(debouncedQuery);
    }
  }, [debouncedQuery, searchTracks]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="spotify-search">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder={placeholder}
          className="input pl-10"
        />
      </div>
      
      {loading && (
        <div className="text-center p-md">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
        </div>
      )}
      
      {tracks.length > 0 && query.trim() && (
        <div className="search-results mt-md space-y-sm max-h-96 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="track-result card hoverable cursor-pointer p-md"
              onClick={() => {
                onSelectTrack(track);
                setQuery('');
              }}
            >
              <div className="flex items-center gap-md">
                {track.album.images[2] ? (
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image 
                      src={track.album.images[2].url} 
                      alt={track.album.name}
                      width={48}
                      height={48}
                      className="rounded-md"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-md bg-surface-hover flex items-center justify-center flex-shrink-0">
                    <MusicalNoteIcon className="w-6 h-6 text-tertiary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{track.name}</h4>
                  <p className="text-sm text-secondary truncate">
                    {track.artists.map(a => a.name).join(', ')} • {track.album.name}
                  </p>
                </div>
                <div className="text-xs text-tertiary flex-shrink-0">
                  {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}