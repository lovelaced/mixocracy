import { useEffect, useState, useCallback, useRef } from 'react';
import { SpotifyAuth } from '@/lib/spotify-auth';
import { Song } from '@/hooks/useMixocracyContract';
import { toast } from 'react-hot-toast';
import { parseSongData } from '@/lib/utils';

interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  currentTrack: Spotify.Track | null;
  position: number;
  duration: number;
  deviceId: string | null;
}

interface QueuedTrack {
  uri: string;
  name: string;
  artist: string;
  votes: number;
  originalSongId: number;
}

export function useSpotifyPlayer(songs: Song[], isDjLive: boolean) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isReady: false,
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    deviceId: null
  });
  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [playedTracks, setPlayedTracks] = useState<Set<number>>(new Set());
  
  const accessTokenRef = useRef<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);
  const hasShownReadyToast = useRef(false);
  const currentTrackIndexRef = useRef(-1);
  const queueRef = useRef<QueuedTrack[]>([]);
  const deviceIdRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const playedTracksRef = useRef<Set<number>>(new Set());
  const queuedTracksRef = useRef<Set<string>>(new Set());
  const trackCacheRef = useRef<Map<string, { uri: string; name: string; artist: string }>>(new Map());
  const isHandlingTrackEndRef = useRef(false);

  // Reset played tracks when DJ stops
  useEffect(() => {
    if (!isDjLive) {
      playedTracksRef.current.clear();
      setPlayedTracks(new Set());
      console.log('Cleared played tracks - DJ is offline');
    }
  }, [isDjLive]);

  // Check current playback state on mount
  useEffect(() => {
    if (!isDjLive || !accessTokenRef.current) return;
    
    const checkCurrentPlayback = async () => {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
          headers: {
            'Authorization': `Bearer ${accessTokenRef.current}`
          }
        });
        
        if (response.ok) {
          const text = await response.text();
          if (text) {
            const data = JSON.parse(text);
            if (data && data.item) {
              console.log('Found existing playback:', data.item.name);
              // Try to match with our queue
              const matchingTrack = queueRef.current.findIndex(
                track => track.uri === data.item.uri
              );
              if (matchingTrack !== -1) {
                setCurrentTrackIndex(matchingTrack);
                currentTrackIndexRef.current = matchingTrack;
                toast(`Resumed at: ${data.item.name}`, { icon: '▶️' });
              }
            }
          }
        } else if (response.status === 204) {
          // No content - no active playback
          console.log('No active playback found');
        }
      } catch (error) {
        console.error('Error checking playback:', error);
      }
    };
    
    if (queue.length > 0) {
      checkCurrentPlayback();
    }
  }, [isDjLive, queue.length]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!isDjLive || typeof window === 'undefined') return;

    const token = SpotifyAuth.getStoredToken();
    if (!token) return;

    accessTokenRef.current = token;

    // Check if SDK is already loaded
    if ((window as any).Spotify) {
      initializePlayer();
      return;
    }

    // Load Spotify SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer();
    };

    return () => {
      // Clear position update interval
      if ((playerRef.current as any)?._positionInterval) {
        clearInterval((playerRef.current as any)._positionInterval);
        delete (playerRef.current as any)._positionInterval;
      }
      
      if (playerRef.current) {
        try {
          playerRef.current.disconnect();
        } catch (error) {
          console.error('Error disconnecting player:', error);
        }
        playerRef.current = null;
      }
    };
  }, [isDjLive]);

  const initializePlayer = () => {
    // Prevent duplicate initialization
    if (playerRef.current) {
      console.log('Player already initialized');
      return;
    }

    const spotifyPlayer = new (window as any).Spotify.Player({
      name: 'Mixocracy DJ Player',
      getOAuthToken: async (cb: (token: string) => void) => {
        let currentToken = SpotifyAuth.getStoredToken();
        if (!currentToken) {
          // Try to refresh
          currentToken = await SpotifyAuth.refreshAccessToken();
        }
        if (currentToken) {
          cb(currentToken);
          accessTokenRef.current = currentToken;
        } else {
          // Re-authenticate if token expired
          SpotifyAuth.authenticate();
        }
      },
      volume: 0.5
    });

    // Error handling
    spotifyPlayer.addListener('initialization_error', ({ message }: any) => {
      console.error('Failed to initialize', message);
      toast.error('Failed to initialize Spotify player');
    });

    spotifyPlayer.addListener('authentication_error', ({ message }: any) => {
      console.error('Failed to authenticate', message);
      toast.error('Spotify authentication failed - please re-login');
      SpotifyAuth.authenticate();
    });

    spotifyPlayer.addListener('account_error', ({ message }: any) => {
      console.error('Failed to validate account', message);
      toast.error('Spotify Premium account required for playback');
    });

    spotifyPlayer.addListener('playback_error', ({ message }: any) => {
      console.error('Failed to perform playback', message);
      toast.error('Playback error occurred');
    });

    // Track the previous track URI
    let previousTrackUri: string | null = null;

    // Playback status updates
    spotifyPlayer.addListener('player_state_changed', (state: any) => {
      if (!state) return;

      setPlayerState(prev => {
        const wasPlaying = prev.isPlaying;
        const isNowPlaying = !state.paused;
        const currentTrackUri = state.track_window.current_track?.uri || null;
        
        // Detect track change
        if (previousTrackUri && currentTrackUri && previousTrackUri !== currentTrackUri) {
          console.log('Track changed from', previousTrackUri, 'to', currentTrackUri);
          
          // Find the previous track in our queue and mark it as played
          const prevTrackInQueue = queueRef.current.find(t => t.uri === previousTrackUri);
          if (prevTrackInQueue) {
            const trackId = prevTrackInQueue.originalSongId;
            playedTracksRef.current.add(trackId);
            setPlayedTracks(prevSet => {
              const newSet = new Set([...prevSet, trackId]);
              console.log('Marked track as played (track change):', {
                trackId,
                trackName: prevTrackInQueue.name,
                totalPlayed: newSet.size,
                playedIds: Array.from(newSet)
              });
              return newSet;
            });
          }
          
          // Find the new track in our queue and update the current index
          const newTrackIndex = queueRef.current.findIndex(t => t.uri === currentTrackUri);
          if (newTrackIndex !== -1 && newTrackIndex !== currentTrackIndexRef.current) {
            console.log('Updating current track index from', currentTrackIndexRef.current, 'to', newTrackIndex);
            currentTrackIndexRef.current = newTrackIndex;
            setCurrentTrackIndex(newTrackIndex);
          }
        }
        
        previousTrackUri = currentTrackUri;
        
        // Handle track end - when track naturally finishes playing
        // Check that we were near the end of the track before it stopped
        const nearEnd = prev.duration > 0 && prev.position > prev.duration - 2000;
        if (wasPlaying && !isNowPlaying && nearEnd && !state.track_window.next_tracks.length && !isHandlingTrackEndRef.current) {
          // Track ended naturally and no next track in Spotify queue
          console.log('Track ended naturally, need to play next');
          isHandlingTrackEndRef.current = true;
          
          // Use a timeout to avoid race conditions
          setTimeout(() => {
            // First mark the current track as played
            const currentIdx = currentTrackIndexRef.current;
            if (currentIdx >= 0 && queueRef.current[currentIdx]) {
              const currentTrack = queueRef.current[currentIdx];
              playedTracksRef.current.add(currentTrack.originalSongId);
              setPlayedTracks(prev => new Set([...prev, currentTrack.originalSongId]));
              console.log('Marked current track as played:', currentTrack.name);
            }
            
            // Find and play the highest voted unplayed track
            const currentQueue = queueRef.current;
            for (let i = 0; i < currentQueue.length; i++) {
              const track = currentQueue[i];
              if (!playedTracksRef.current.has(track.originalSongId)) {
                console.log('Auto-playing next track:', track.name);
                setCurrentTrackIndex(i);
                currentTrackIndexRef.current = i;
                
                // Use Spotify Web API directly to avoid circular dependencies
                fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    uris: [track.uri],
                    position_ms: 0
                  }),
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessTokenRef.current}`
                  }
                }).then(() => {
                  toast.success(`Now playing: ${track.name}`, { icon: '🎵' });
                  // Reset the flag after a delay
                  setTimeout(() => {
                    isHandlingTrackEndRef.current = false;
                  }, 3000);
                }).catch(err => {
                  console.error('Failed to auto-play next track:', err);
                  isHandlingTrackEndRef.current = false;
                });
                break;
              }
            }
            // Reset flag if no tracks to play
            if (!currentQueue.find(t => !playedTracksRef.current.has(t.originalSongId))) {
              isHandlingTrackEndRef.current = false;
            }
          }, 1000);
        }

        return {
          ...prev,
          isReady: true,
          isPlaying: isNowPlaying,
          currentTrack: state.track_window.current_track,
          position: state.position,
          duration: state.duration
        };
      });
    });

    // Store interval ID for cleanup first
    let positionInterval: NodeJS.Timeout;
    
    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }: any) => {
      console.log('Ready with Device ID', device_id);
      deviceIdRef.current = device_id;
      setPlayerState(prev => ({
        ...prev,
        isReady: true,
        deviceId: device_id
      }));
      
      // Only show toast once
      if (!hasShownReadyToast.current) {
        toast.success('Spotify player ready!');
        hasShownReadyToast.current = true;
      }
      
      // Set up position update interval AFTER player is ready
      positionInterval = setInterval(async () => {
      try {
        if (playerRef.current && typeof playerRef.current.getCurrentState === 'function') {
          const state = await playerRef.current.getCurrentState();
          if (state && !state.paused) {
            setPlayerState(prev => ({
              ...prev,
              position: state.position
            }));
            
            // Don't queue anything automatically - we'll handle it when track ends
            // This prevents us from queuing the wrong track if votes change
          }
        }
      } catch (error) {
        // Silently ignore errors - player might not be ready
        if (error instanceof Error && !error.message.includes('Cannot read properties of null')) {
          console.error('Error in position update:', error);
        }
      }
    }, 100); // Update every 100ms for smooth animation

      // Store interval ID for cleanup
      (spotifyPlayer as any)._positionInterval = positionInterval;
    });

    // Connect to the player
    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);
    playerRef.current = spotifyPlayer;
  };

  // Search for Spotify tracks matching song names
  const searchTrack = useCallback(async (songName: string): Promise<{ uri: string; name: string; artist: string } | null> => {
    // Check cache first
    const cached = trackCacheRef.current.get(songName);
    if (cached) {
      return cached;
    }
    
    const token = accessTokenRef.current || SpotifyAuth.getStoredToken();
    if (!token) return null;

    // Parse song data to check for Spotify URI
    const { displayName, spotifyUri } = parseSongData(songName);
    
    // If we have a Spotify URI, we can get the track directly
    if (spotifyUri) {
      try {
        const trackId = spotifyUri.replace('spotify:track:', '');
        const response = await fetch(
          `https://api.spotify.com/v1/tracks/${trackId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, try to refresh
            const newToken = await SpotifyAuth.refreshAccessToken();
            if (newToken) {
              accessTokenRef.current = newToken;
              return searchTrack(songName);
            }
            return null;
          }
          if (response.status === 503 || response.status === 502 || response.status === 429) {
            // Service unavailable or rate limited, fall back to search
            console.warn(`Spotify API returned ${response.status}, falling back to search`);
            throw new Error('Service unavailable');
          }
          throw new Error('Track fetch failed');
        }

        const track = await response.json();
        const result = {
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', ')
        };
        // Cache the result
        trackCacheRef.current.set(songName, result);
        return result;
      } catch (error) {
        console.warn('Error fetching track by ID, will retry with search:', error);
        // Fall back to search
      }
    }

    // Fall back to search by name
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(displayName)}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          const newToken = await SpotifyAuth.refreshAccessToken();
          if (newToken) {
            accessTokenRef.current = newToken;
            return searchTrack(songName);
          }
          return null;
        }
        if (response.status === 503 || response.status === 502 || response.status === 429) {
          // Service unavailable or rate limited
          console.warn(`Spotify search API returned ${response.status} for "${displayName}"`);
          return null;
        }
        throw new Error('Search failed');
      }

      const data = await response.json();
      if (data.tracks.items.length > 0) {
        const track = data.tracks.items[0];
        const result = {
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', ')
        };
        // Cache the result
        trackCacheRef.current.set(songName, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error searching track:', error);
      return null;
    }
  }, []);

  // Update refs when state changes
  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  
  // Don't remove played tracks from the actual queue to avoid rebuilding
  // Instead, we'll filter them in the UI

  // Build queue from voted songs
  useEffect(() => {
    // Check if Spotify is connected first
    const token = SpotifyAuth.getStoredToken();
    if (!token) {
      // Clear queue if Spotify is not connected
      if (queue.length > 0) {
        setQueue([]);
        queueRef.current = [];
        console.log('Spotify not connected, cleared queue');
      }
      return;
    }
    
    if (!isDjLive || songs.length === 0 || isSearching || isTransitioningRef.current) return;

    const buildQueue = async () => {
      // Only show searching state if we don't have a queue yet
      if (queue.length === 0) {
        setIsSearching(true);
      }
      const newQueue: QueuedTrack[] = [];

      // Sort songs by votes (highest first)
      const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes);

      for (const song of sortedSongs) {
        const trackInfo = await searchTrack(song.name);
        if (trackInfo) {
          newQueue.push({
            ...trackInfo,
            votes: song.votes,
            originalSongId: song.id
          });
        } else {
          console.warn(`Could not find Spotify track for: ${parseSongData(song.name).displayName}`);
        }
      }

      // If we're currently playing, we need to handle the queue carefully
      const currentIndex = currentTrackIndexRef.current;
      const oldQueue = queueRef.current;
      
      if (currentIndex >= 0 && oldQueue[currentIndex] && playerState.isPlaying) {
        const currentTrack = oldQueue[currentIndex];
        
        // Find the current track in the new queue
        const currentTrackNewIndex = newQueue.findIndex(t => t.originalSongId === currentTrack.originalSongId);
        
        if (currentTrackNewIndex !== -1) {
          // Current track exists in new queue, just use the new queue and update index
          setQueue(newQueue);
          queueRef.current = newQueue;
          
          if (currentIndex !== currentTrackNewIndex) {
            setCurrentTrackIndex(currentTrackNewIndex);
            currentTrackIndexRef.current = currentTrackNewIndex;
            console.log('Queue updated, current track moved from index', currentIndex, 'to', currentTrackNewIndex);
          }
        } else {
          // Current track was removed from queue, keep playing it but add to front
          const reorderedQueue = [currentTrack, ...newQueue];
          setQueue(reorderedQueue);
          queueRef.current = reorderedQueue;
          
          if (currentIndex !== 0) {
            setCurrentTrackIndex(0);
            currentTrackIndexRef.current = 0;
          }
          console.log('Queue updated, current track preserved at index 0 (was removed from queue)');
        }
        
        // Check if the next track changed
        const updatedQueue = queueRef.current;
        const updatedIndex = currentTrackIndexRef.current;
        if (oldQueue.length > currentIndex + 1 && updatedQueue.length > updatedIndex + 1) {
          const oldNext = oldQueue[currentIndex + 1];
          const newNext = updatedQueue[updatedIndex + 1];
          
          if (oldNext && (!newNext || oldNext.originalSongId !== newNext.originalSongId)) {
            if (newNext) {
              toast(`Queue updated! Next: ${newNext.name}`, { 
                icon: '🔄',
                duration: 3000 
              });
            }
          }
        }
      } else {
        // Not playing or no current track, just update the queue
        setQueue(newQueue);
        queueRef.current = newQueue;
        
        // Reset index if needed
        if (currentIndex >= newQueue.length) {
          setCurrentTrackIndex(-1);
          currentTrackIndexRef.current = -1;
        }
      }
      
      setIsSearching(false);
    };

    buildQueue();
  }, [songs, isDjLive, searchTrack]);

  // Add track to Spotify queue
  const addToSpotifyQueue = useCallback(async (trackUri: string) => {
    if (!accessTokenRef.current) return false;
    
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessTokenRef.current}`
          }
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Error adding to queue:', error);
      return false;
    }
  }, []);

  // Play specific track
  const playTrack = useCallback(async (trackUri: string) => {
    if (!playerState.deviceId || !accessTokenRef.current) {
      console.log('Device ID:', playerState.deviceId, 'Token:', !!accessTokenRef.current);
      toast.error('Player not ready - make sure Spotify is open');
      return;
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${playerState.deviceId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            uris: [trackUri],
            position_ms: 0
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessTokenRef.current}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('No active device found - make sure Spotify is open');
        } else {
          throw new Error('Failed to start playback');
        }
      }
    } catch (error) {
      console.error('Error playing track:', error);
      toast.error('Failed to play track');
    }
  }, [playerState.deviceId]);

  // Start playing from the beginning of the queue
  const startPlaying = useCallback(async () => {
    if (queue.length === 0) {
      toast.error('No tracks in queue');
      return;
    }

    // Clear any previously queued tracks since we're starting fresh
    queuedTracksRef.current.clear();
    
    // Find the first unplayed track (should be the highest voted)
    let firstTrack = null;
    let firstIndex = -1;
    
    for (let i = 0; i < queue.length; i++) {
      const track = queue[i];
      if (!playedTracksRef.current.has(track.originalSongId)) {
        firstTrack = track;
        firstIndex = i;
        break;
      }
    }
    
    if (!firstTrack) {
      // All tracks have been played, start from the beginning
      firstTrack = queue[0];
      firstIndex = 0;
    }
    
    setCurrentTrackIndex(firstIndex);
    currentTrackIndexRef.current = firstIndex;
    await playTrack(firstTrack.uri);
    toast.success(`Now playing: ${firstTrack.name}`);
    
    // Don't queue anything automatically - let votes determine what plays next
  }, [queue, playTrack]);

  // Play next track in queue
  const playNext = useCallback(async () => {
    const currentIndex = currentTrackIndexRef.current;
    const currentQueue = queueRef.current;
    
    console.log('playNext called', { queueLength: currentQueue.length, currentIndex });
    if (currentQueue.length === 0) return;

    // Mark current track as played before moving to next
    if (currentIndex >= 0 && currentQueue[currentIndex]) {
      const track = currentQueue[currentIndex];
      const trackId = track.originalSongId;
      playedTracksRef.current.add(trackId);
      setPlayedTracks(prev => {
        const newSet = new Set([...prev, trackId]);
        console.log('Marked track as played (skip):', {
          trackId,
          trackName: track.name,
          totalPlayed: newSet.size,
          playedIds: Array.from(newSet)
        });
        return newSet;
      });
    }

    // Find the highest voted track that hasn't been played yet
    let nextTrack = null;
    let nextIndex = -1;
    
    for (let i = 0; i < currentQueue.length; i++) {
      const track = currentQueue[i];
      if (!playedTracksRef.current.has(track.originalSongId)) {
        nextTrack = track;
        nextIndex = i;
        break; // Queue is already sorted by votes, so first unplayed is highest voted
      }
    }
    
    if (!nextTrack || nextIndex === -1) {
      toast('Reached end of queue', { icon: 'ℹ️' });
      return;
    }

    console.log('Playing highest voted unplayed track:', nextIndex, nextTrack);
    setCurrentTrackIndex(nextIndex);
    currentTrackIndexRef.current = nextIndex;
    await playTrack(nextTrack.uri);
    toast.success(`Now playing: ${nextTrack.name}`);
  }, [playTrack]);

  // Skip to next track
  const skipTrack = useCallback(async () => {
    if (!accessTokenRef.current) return;
    
    const currentIndex = currentTrackIndexRef.current;
    const currentQueue = queueRef.current;
    
    console.log('Skip requested:', {
      currentIndex,
      queueLength: currentQueue.length,
      hasQueuedTracks: queuedTracksRef.current.size > 0,
      queuedTracks: Array.from(queuedTracksRef.current)
    });
    
    // Mark current track as played
    if (currentIndex >= 0 && currentQueue[currentIndex]) {
      const track = currentQueue[currentIndex];
      const trackId = track.originalSongId;
      playedTracksRef.current.add(trackId);
      setPlayedTracks(prev => new Set([...prev, trackId]));
    }
    
    // Check if we have a next track in our queue
    if (currentIndex < currentQueue.length - 1) {
      const nextTrack = currentQueue[currentIndex + 1];
      
      // If the next track isn't queued in Spotify yet, we need to play it manually
      if (!queuedTracksRef.current.has(nextTrack.uri)) {
        console.log('Next track not in Spotify queue, playing manually:', nextTrack.name);
        await playNext();
        return;
      }
    }
    
    try {
      // Use Spotify's skip endpoint
      console.log('Using Spotify skip endpoint');
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/next',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessTokenRef.current}`
          }
        }
      );
      
      if (!response.ok && response.status !== 204) {
        // If skip fails, fall back to manual play
        console.warn('Skip failed with status:', response.status);
        await playNext();
      } else {
        console.log('Skip successful');
      }
    } catch (error) {
      console.error('Error skipping track:', error);
      // Fall back to manual play
      await playNext();
    }
  }, [playNext]);

  // Pause playback
  const pause = useCallback(async () => {
    if (!player) return;
    await player.pause();
  }, [player]);

  // Resume playback
  const resume = useCallback(async () => {
    if (!player) return;
    await player.resume();
  }, [player]);

  // Transfer playback to this device
  const transferPlayback = useCallback(async () => {
    if (!playerState.deviceId || !accessTokenRef.current) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        body: JSON.stringify({
          device_ids: [playerState.deviceId],
          play: false
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessTokenRef.current}`
        }
      });

      if (response.ok) {
        toast.success('Playback transferred to Mixocracy player');
      }
    } catch (error) {
      console.error('Error transferring playback:', error);
      toast.error('Failed to transfer playback');
    }
  }, [playerState.deviceId]);

  // Create a filtered queue for display that excludes played tracks
  const visibleQueue = queue.filter(track => {
    // Always show the currently playing track
    if (currentTrackIndex >= 0 && queue[currentTrackIndex]?.originalSongId === track.originalSongId) {
      return true;
    }
    // Hide played tracks
    return !playedTracks.has(track.originalSongId);
  });
  
  
  // Adjust visible index for the filtered queue
  const visibleCurrentTrackIndex = visibleQueue.findIndex(
    track => currentTrackIndex >= 0 && queue[currentTrackIndex]?.originalSongId === track.originalSongId
  );


  return {
    player,
    playerState,
    queue: visibleQueue, // Return the filtered queue for display
    isSearching,
    currentTrackIndex: visibleCurrentTrackIndex, // Return adjusted index
    startPlaying,
    skipTrack,
    pause,
    resume,
    transferPlayback,
    totalQueueSize: queue.length, // Add this so DJ knows total queue size
    playedCount: playedTracks.size, // Add this for stats
    playedTracksSet: playedTracks // Expose this for filtering in other components
  };
}