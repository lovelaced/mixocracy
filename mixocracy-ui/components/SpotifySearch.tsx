'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSpotifySearch, SpotifyTrack } from '@/hooks/useSpotifySearch';
import { MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

interface SpotifySearchProps {
  onSelectTrack: (track: SpotifyTrack) => void;
  placeholder?: string;
  artist?: string;
}

export function SpotifySearch({ onSelectTrack, placeholder = "Search Spotify tracks...", artist }: SpotifySearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { searchTracks, tracks, loading } = useSpotifySearch();
  
  // Clear search when artist changes
  useEffect(() => {
    setQuery('');
  }, [artist]);

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
      searchTracks(debouncedQuery, artist);
    }
  }, [debouncedQuery, searchTracks, artist]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="spotify-search flex-1 flex flex-col h-full">
      <div className="relative mb-md flex-shrink-0">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tertiary pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder={placeholder}
          className="input text-base py-3 pr-4 pl-10 w-full bg-surface-card/80 backdrop-blur-sm"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          inputMode="search"
        />
      </div>
      
      <div className="flex-1 flex flex-col min-h-0">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        )}
        
        {!loading && tracks.length > 0 && query.trim() && (
          <div className="search-results flex-1 overflow-y-auto flex flex-col gap-2 px-1">
            {tracks.slice(0, 5).map((track) => (
              <div
                key={track.id}
                className="track-result cursor-pointer p-3 rounded-lg bg-surface-card/60 backdrop-blur-sm hover:bg-surface-card/80 active:bg-accent/20 transition-all flex items-center"
                onClick={() => {
                  onSelectTrack(track);
                  setQuery('');
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  {track.album.images && track.album.images.length > 0 ? (
                    <Image 
                      src={track.album.images[track.album.images.length - 1].url} 
                      alt={track.album.name}
                      width={48}
                      height={48}
                      className="rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-background-secondary/60 flex items-center justify-center flex-shrink-0">
                      <MusicalNoteIcon className="w-6 h-6 text-tertiary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{track.name}</h4>
                    <p className="text-sm text-secondary truncate">
                      {track.artists.map(a => a.name).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && tracks.length === 0 && query.trim() && (
          <div className="flex-1 flex items-center justify-center text-secondary">
            <p>No tracks found</p>
          </div>
        )}
      </div>
    </div>
  );
}