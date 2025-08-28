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
  
  const accessTokenRef = useRef<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);
  const hasShownReadyToast = useRef(false);

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
      if (playerRef.current) {
        // Clear position update interval
        if ((playerRef.current as any)._positionInterval) {
          clearInterval((playerRef.current as any)._positionInterval);
        }
        playerRef.current.disconnect();
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

    // Playback status updates
    spotifyPlayer.addListener('player_state_changed', (state: any) => {
      if (!state) return;

      const wasPlaying = playerState.isPlaying;
      const isNowPlaying = !state.paused;
      const trackEnded = wasPlaying && !isNowPlaying && state.position === 0 && playerState.position > 0;

      setPlayerState(prev => ({
        ...prev,
        isReady: true,
        isPlaying: isNowPlaying,
        currentTrack: state.track_window.current_track,
        position: state.position,
        duration: state.duration
      }));

      // Check if track ended to play next
      if (trackEnded) {
        playNext();
      }
    });

    // Set up position update interval for smooth progress bar
    const positionInterval = setInterval(async () => {
      if (playerRef.current) {
        const state = await playerRef.current.getCurrentState();
        if (state && !state.paused) {
          setPlayerState(prev => ({
            ...prev,
            position: state.position
          }));
        }
      }
    }, 100); // Update every 100ms for smooth animation

    // Store interval ID for cleanup
    (spotifyPlayer as any)._positionInterval = positionInterval;

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }: any) => {
      console.log('Ready with Device ID', device_id);
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
    });

    // Connect to the player
    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);
    playerRef.current = spotifyPlayer;
  };

  // Search for Spotify tracks matching song names
  const searchTrack = useCallback(async (songName: string): Promise<{ uri: string; name: string; artist: string } | null> => {
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
          throw new Error('Track fetch failed');
        }

        const track = await response.json();
        return {
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', ')
        };
      } catch (error) {
        console.error('Error fetching track by ID:', error);
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
        throw new Error('Search failed');
      }

      const data = await response.json();
      if (data.tracks.items.length > 0) {
        const track = data.tracks.items[0];
        return {
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', ')
        };
      }

      return null;
    } catch (error) {
      console.error('Error searching track:', error);
      return null;
    }
  }, []);

  // Build queue from voted songs
  useEffect(() => {
    if (!isDjLive || songs.length === 0 || isSearching) return;

    const buildQueue = async () => {
      setIsSearching(true);
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
          console.warn(`Could not find Spotify track for: ${song.name}`);
        }
      }

      setQueue(newQueue);
      setIsSearching(false);
    };

    buildQueue();
  }, [songs, isDjLive, searchTrack]);

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

    setCurrentTrackIndex(0);
    await playTrack(queue[0].uri);
    toast.success(`Now playing: ${queue[0].name}`);
  }, [queue, playTrack]);

  // Play next track in queue
  const playNext = useCallback(async () => {
    console.log('playNext called', { queueLength: queue.length, currentIndex: currentTrackIndex });
    if (queue.length === 0) return;

    const nextIndex = currentTrackIndex + 1;
    if (nextIndex >= queue.length) {
      toast('Reached end of queue', { icon: 'ℹ️' });
      return;
    }

    console.log('Playing next track:', nextIndex, queue[nextIndex]);
    setCurrentTrackIndex(nextIndex);
    const nextTrack = queue[nextIndex];
    await playTrack(nextTrack.uri);
    toast.success(`Now playing: ${nextTrack.name}`);
  }, [queue, currentTrackIndex, playTrack]);

  // Skip to next track
  const skipTrack = useCallback(async () => {
    // Always use our queue management since we're playing individual tracks
    await playNext();
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

  return {
    player,
    playerState,
    queue,
    isSearching,
    currentTrackIndex,
    startPlaying,
    skipTrack,
    pause,
    resume,
    transferPlayback
  };
}