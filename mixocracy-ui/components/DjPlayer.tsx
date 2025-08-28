'use client';

import React from 'react';
import Image from 'next/image';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { Song } from '@/hooks/useMixocracyContract';
import { PlayIcon, PauseIcon, ForwardIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { SpotifyAuth } from '@/lib/spotify-auth';

interface DjPlayerProps {
  songs: Song[];
  isLive: boolean;
  onSpotifyConnect?: () => void;
}

export function DjPlayer({ songs, isLive, onSpotifyConnect }: DjPlayerProps) {
  const {
    playerState,
    queue,
    isSearching,
    currentTrackIndex,
    startPlaying,
    skipTrack,
    pause,
    resume,
    transferPlayback
  } = useSpotifyPlayer(songs, isLive);

  const handleConnectSpotify = () => {
    SpotifyAuth.authenticate();
    onSpotifyConnect?.();
  };

  const hasSpotifyToken = SpotifyAuth.isAuthenticated();

  if (!isLive) {
    return null;
  }

  if (!hasSpotifyToken) {
    return (
      <div className="card glass-dark p-lg text-center">
        <h3 className="text-lg font-semibold mb-sm">Connect Spotify to Start Playing</h3>
        <p className="text-secondary text-sm mb-md">
          Connect your Spotify Premium account to play tracks in voted order
        </p>
        <button 
          className="btn btn-spotify"
          onClick={handleConnectSpotify}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Connect Spotify
        </button>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="card glass-dark p-lg">
        <div className="flex items-center justify-center gap-sm">
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
          <p className="text-secondary">Searching for tracks on Spotify...</p>
        </div>
      </div>
    );
  }

  if (!playerState.isReady) {
    return (
      <div className="card glass-dark p-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Spotify Player Initializing...</h3>
            <p className="text-secondary text-sm">Make sure you have Spotify open</p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={transferPlayback}
          >
            Transfer Playback Here
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card glass-dark relative overflow-hidden">
      {/* Background glow effect when playing */}
      {playerState.isPlaying && (
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 to-transparent animate-pulse pointer-events-none" />
      )}

      {/* Now Playing */}
      {playerState.currentTrack && (
        <div className="relative z-10 mb-lg">
          <h3 className="text-xs text-accent uppercase tracking-wider mb-md flex items-center gap-xs">
            <span className={`inline-block w-2 h-2 rounded-full bg-accent ${playerState.isPlaying ? 'animate-pulse' : ''}`} />
            NOW PLAYING
          </h3>
          <div className="flex items-start gap-md">
            {playerState.currentTrack.album.images[0] && (
              <div className="relative w-20 h-20">
                <Image 
                  src={playerState.currentTrack.album.images[0].url} 
                  alt={playerState.currentTrack.name}
                  width={80}
                  height={80}
                  className="rounded-lg shadow-2xl"
                />
                {playerState.isPlaying && (
                  <div className="absolute inset-0 rounded-lg border-2 border-accent animate-pulse" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-lg mb-xs truncate">{playerState.currentTrack.name}</h4>
              <p className="text-sm text-secondary mb-md truncate">
                {playerState.currentTrack.artists.map(a => a.name).join(', ')}
              </p>
              
              {/* Progress Bar */}
              <div className="space-y-xs">
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  {/* Progress fill */}
                  <div 
                    className="h-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${(playerState.position / playerState.duration) * 100}%`,
                      backgroundColor: 'var(--accent-primary)'
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>
                    {formatTime(playerState.position)}
                  </span>
                  <span className="font-mono text-tertiary">
                    {formatTime(playerState.duration)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Controls */}
      <div className="relative z-10 flex items-center justify-center gap-md mb-lg">
        {!playerState.currentTrack || currentTrackIndex === -1 ? (
          <button
            className="btn btn-primary btn-lg relative overflow-hidden group"
            onClick={startPlaying}
            disabled={queue.length === 0}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-accent-hover to-accent-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <PlayIcon className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Start Playing</span>
          </button>
        ) : (
          <div className="flex items-center gap-xs">
            <button
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
              onClick={playerState.isPlaying ? pause : resume}
              title={playerState.isPlaying ? 'Pause' : 'Play'}
            >
              {playerState.isPlaying ? (
                <PauseIcon className="w-4 h-4 text-white" />
              ) : (
                <PlayIcon className="w-4 h-4 text-white" />
              )}
            </button>
            <button
              className="w-10 h-10 rounded-full border border-white/20 hover:border-accent hover:bg-accent/10 transition-all flex items-center justify-center group disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-white/20"
              onClick={skipTrack}
              title="Skip to next track"
              disabled={currentTrackIndex >= queue.length - 1}
            >
              <ForwardIcon className="w-4 h-4 text-white/70 group-hover:text-accent group-disabled:text-white/30 transition-colors" />
            </button>
          </div>
        )}
      </div>

      {/* Queue Preview */}
      <div className="relative z-10 border-t border-white/10 pt-lg">
        <div className="flex items-center justify-between mb-sm">
          <h3 className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            QUEUE
          </h3>
          <div className="flex items-center gap-xs">
            <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-mono text-white/50">
              {queue.length}
            </span>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="text-xs text-center py-lg opacity-40">NO TRACKS FOUND</p>
        ) : (
          <div className="space-y-0 max-h-64 overflow-y-auto custom-scrollbar">
            {queue.map((track, index) => {
              const isPlaying = index === currentTrackIndex;
              const isNext = index === currentTrackIndex + 1;
              
              return (
                <div 
                  key={index} 
                  className={`
                    group relative flex items-center gap-md py-sm px-xs -mx-xs transition-all
                    ${isPlaying ? 'text-white' : ''}
                    ${!isPlaying ? 'hover:bg-white/5' : ''}
                  `}
                >
                  {/* Track Number / Status */}
                  <div className="w-8 text-center">
                    {isPlaying ? (
                      <div className="flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-white/20 group-hover:text-white/40 transition-colors">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  
                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`
                      text-sm truncate transition-all
                      ${isPlaying ? 'font-medium' : 'text-white/70 group-hover:text-white/90'}
                      ${isNext ? 'text-white/90' : ''}
                    `}>
                      {track.name}
                    </p>
                    <p className="text-xs text-white/30 truncate">
                      {track.artist}
                    </p>
                  </div>
                  
                  {/* Votes */}
                  {track.votes > 0 && (
                    <div className="flex items-center gap-xs">
                      <span className="text-xs font-mono text-white/30">
                        {track.votes}
                      </span>
                      <span className="text-xs text-white/20">
                        {track.votes === 1 ? 'VOTE' : 'VOTES'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}