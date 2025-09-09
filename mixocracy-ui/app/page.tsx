'use client';

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useMixocracyContract } from '@/hooks/useMixocracyContract';
import { DjInfo, Song } from '@/hooks/useMixocracyContract';
import { toast, Toaster } from 'react-hot-toast';
import { 
  XMarkIcon, 
  PlusIcon, 
  RadioIcon, 
  Cog6ToothIcon,
  PlayIcon,
  HandRaisedIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/outline';
import { MIXOCRACY_CONTRACT_ADDRESS } from '@/lib/contract-config';
import { CustomConnectButton } from '@/components/CustomConnectButton';
import { truncateError, parseSongData } from '@/lib/utils';
import { DjPlayer } from '@/components/DjPlayer';
import { SpotifySearch } from '@/components/SpotifySearch';
import { SpotifyTrack } from '@/hooks/useSpotifySearch';
import { VoteButton } from '@/components/VoteButton';
import MobileVoteHint from '@/components/MobileVoteHint';
import Image from 'next/image';

export default function Home() {
  const { isConnected, address } = useAccount();
  const contract = useMixocracyContract();
  
  // State
  const [activeTab, setActiveTab] = useState<'live' | 'admin'>('live');
  const [activeDjs, setActiveDjs] = useState<string[]>([]);
  const [djInfoMap, setDjInfoMap] = useState<Map<string, DjInfo>>(new Map());
  const [selectedDj, setSelectedDj] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [votedSongs, setVotedSongs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingSongs, setLoadingSongs] = useState<Set<number>>(new Set());
  const [isOwner, setIsOwner] = useState(false);
  const [isDj, setIsDj] = useState(false);
  const [showAddDjModal, setShowAddDjModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [newDjAddress, setNewDjAddress] = useState('');
  const [selectedSpotifyTrack, setSelectedSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [allDjs, setAllDjs] = useState<string[]>([]);
  const [roleChecked, setRoleChecked] = useState(false);
  const [playedTracksSet, setPlayedTracksSet] = useState<Set<number>>(new Set());
  const [removedSongs, setRemovedSongs] = useState<Set<number>>(new Set());
  const [optimisticVotes, setOptimisticVotes] = useState<Map<number, number>>(new Map());

  // Define callback functions first
  const loadActiveDjs = useCallback(async () => {
    if (!contract.getActiveDjs || !contract.getDjInfo) return;
    
    try {
      const djs = await contract.getActiveDjs();
      setActiveDjs(djs);
      
      // Load DJ info for each active DJ
      const infoMap = new Map();
      for (const dj of djs) {
        try {
          const info = await contract.getDjInfo(dj);
          infoMap.set(dj, info);
        } catch (err) {
          console.error(`Error loading info for DJ ${dj}:`, err);
        }
      }
      setDjInfoMap(infoMap);
    } catch (error) {
      console.error('Error loading active DJs:', error);
    }
  }, [contract]);

  const loadAllDjs = useCallback(async () => {
    if (!contract.getAllDjs || !contract.getDjInfo) return;
    
    try {
      const djs = await contract.getAllDjs();
      setAllDjs(djs);
      
      // Load info for each DJ
      const infoMap = new Map();
      for (const dj of djs) {
        try {
          const info = await contract.getDjInfo(dj);
          infoMap.set(dj, info);
        } catch (err) {
          console.error(`Error loading info for DJ ${dj}:`, err);
        }
      }
      setDjInfoMap(prev => new Map([...prev, ...infoMap]));
    } catch (error) {
      console.error('Error loading all DJs:', error);
    }
  }, [contract]);

  const checkUserRole = useCallback(async () => {
    if (!address || !contract.hasProvider || !contract.isDj) return;
    
    try {
      // Check if owner (from environment variable)
      const ownerAddress = process.env.NEXT_PUBLIC_MIXOCRACY_OWNER_ADDRESS?.toLowerCase() || '0x953701ef658cf531dad9e23e5ef32dda6d6a4467';
      const isOwnerAddress = address.toLowerCase() === ownerAddress;
      setIsOwner(isOwnerAddress);
      
      // Check if DJ
      const djStatus = await contract.isDj(address);
      setIsDj(djStatus);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }, [address, contract]);

  const loadSongs = useCallback(async (djAddress: string) => {
    if (!contract.getSongCount || !contract.getSong || !contract.getVotes || !contract.getAllSongsWithVotes || !contract.hasVoted || !contract.isSongRemoved) return;
    
    try {
      // getAllSongsWithVotes works for both active and inactive DJs
      let songList: Song[];
      try {
        songList = await contract.getAllSongsWithVotes(djAddress);
      } catch {
        // Silently fall back to manual loading when getAllSongsWithVotes fails
        // This can happen when the contract's voting data is in an inconsistent state
        
        // Fallback to manual loading
        const songCount = await contract.getSongCount(djAddress);
        songList = [];
        
        for (let i = 0; i < songCount; i++) {
          // Check if song is removed
          const isRemoved = await contract.isSongRemoved(djAddress, i);
          if (isRemoved) {
            console.log(`Song ${i} is marked as removed, skipping`);
            continue;
          }
          
          const name = await contract.getSong(djAddress, i);
          if (!name || name.trim() === '') {
            continue;
          }
          let votes = 0;
          try {
            votes = await contract.getVotes(djAddress, i);
          } catch {
            // Default to 0 votes if can't get them
          }
          songList.push({ id: i, name, votes });
        }
      }
      
      // Apply optimistic votes
      const songsWithOptimisticVotes = songList.map(song => {
        const optimisticVote = optimisticVotes.get(song.id);
        return {
          ...song,
          votes: optimisticVote !== undefined ? optimisticVote : song.votes
        };
      });
      
      // Sort by votes and filter out removed songs
      const sortedSongs = songsWithOptimisticVotes
        .filter(song => !removedSongs.has(song.id))
        .sort((a, b) => b.votes - a.votes);
      setSongs(sortedSongs);
      
      // Check which songs the current user has voted for
      if (address) {
        const votedSet = new Set<number>();
        for (const song of sortedSongs) {
          try {
            const hasVoted = await contract.hasVoted(address, djAddress, song.id);
            if (hasVoted) {
              votedSet.add(song.id);
            }
          } catch (error) {
            console.error('Error checking vote status for song', song.id, ':', error);
          }
        }
        setVotedSongs(votedSet);
      }
    } catch (error) {
      console.error('Error loading songs:', error);
      setSongs([]);
    }
  }, [address, activeTab, activeDjs, contract, optimisticVotes, removedSongs]);

  // Load active DJs
  useEffect(() => {
    if (contract.hasProvider) {
      loadActiveDjs();
      const interval = setInterval(loadActiveDjs, 10000);
      return () => clearInterval(interval);
    }
  }, [contract.hasProvider, loadActiveDjs]);

  // Check if current user is owner/DJ
  useEffect(() => {
    if (address && contract.hasProvider && !roleChecked) {
      checkUserRole().then(() => setRoleChecked(true));
    } else if (!address) {
      // Reset role check when disconnected
      setRoleChecked(false);
      setIsOwner(false);
      setIsDj(false);
    }
  }, [address, contract.hasProvider, roleChecked, checkUserRole]);
  
  // Handle Spotify connection status
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('spotify_connected') === 'true') {
      toast.success('Successfully connected to Spotify!');
      // Remove query params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (searchParams.get('spotify_error') === 'true') {
      toast.error('Failed to connect to Spotify');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Load all DJs when user is owner or DJ
  useEffect(() => {
    if (contract.hasProvider && (isOwner || isDj)) {
      loadAllDjs();
    }
  }, [contract.hasProvider, isOwner, isDj, loadAllDjs]);

  // Load songs when DJ is selected or when viewing own tracks in BOOTH
  useEffect(() => {
    if (!contract.hasProvider) return;
    
    let interval: NodeJS.Timeout;
    
    if (selectedDj) {
      loadSongs(selectedDj);
      interval = setInterval(() => loadSongs(selectedDj), 5000);
    } else if (isDj && activeTab === 'admin' && address) {
      // Load own songs when in BOOTH
      loadSongs(address);
      // Refresh songs periodically if DJ is live
      if (activeDjs.includes(address)) {
        interval = setInterval(() => loadSongs(address), 5000);
      }
      // Clear voted songs for admin view
      setVotedSongs(new Set());
    } else if (activeDjs.length === 1 && (activeTab === 'live' || (!isDj && !isOwner))) {
      // Auto-load songs when there's only one DJ live
      loadSongs(activeDjs[0]);
      interval = setInterval(() => loadSongs(activeDjs[0]), 5000);
    } else {
      // Clear songs and voted state when no DJ is selected
      setSongs([]);
      setVotedSongs(new Set());
      setOptimisticVotes(new Map());
    }
    
    // Listen for song removal events to refresh the list
    const handleSongRemoved = (event: CustomEvent) => {
      const { songId, djAddress: affectedDj, transactionHash } = event.detail;
      console.log(`🎵 Song ${songId} removed from blockchain`, {
        djAddress: affectedDj,
        transactionHash,
        timestamp: new Date().toISOString()
      });
      
      // Add to removed songs set immediately for client-side filtering
      setRemovedSongs(prev => new Set(prev).add(songId));
      
      // Refresh songs for the affected DJ
      if (selectedDj === affectedDj || 
          (activeDjs.length === 1 && activeDjs[0] === affectedDj) ||
          (isDj && address === affectedDj)) {
        // Add a delay to ensure the blockchain state is fully updated
        setTimeout(() => {
          console.log(`🔄 Refreshing song list after removal for DJ ${affectedDj}`);
          loadSongs(affectedDj);
        }, 2000);
      }
    };
    
    window.addEventListener('songRemoved', handleSongRemoved as EventListener);
    
    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('songRemoved', handleSongRemoved as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDj, isDj, isOwner, activeTab, address, contract.hasProvider, activeDjs.length, activeDjs]);

  async function handleVote(songId: number, djAddress?: string) {
    const targetDj = djAddress || selectedDj;
    if (!targetDj) return;
    
    // Set loading for this specific song
    setLoadingSongs(prev => new Set(prev).add(songId));
    
    try {
      console.log('Attempting to vote:', { 
        targetDj, 
        songId, 
        voter: address,
        contractAddress: MIXOCRACY_CONTRACT_ADDRESS 
      });
      const tx = await contract.vote(targetDj, songId);
      
      // Transaction submitted - update UI immediately
      toast.success('Vote submitted!');
      
      // Now update the UI with the new vote count and reorder
      flushSync(() => {
        // Mark as voted
        setVotedSongs(prev => {
          const newSet = new Set(prev);
          newSet.add(songId);
          return newSet;
        });
        
        // Update vote count only (don't reorder yet)
        const currentSong = songs.find(s => s.id === songId);
        if (currentSong) {
          setSongs(prevSongs => {
            // Only update the vote count, maintain current order
            return prevSongs.map(song => 
              song.id === songId ? { ...song, votes: song.votes + 1 } : song
            );
          });
        }
      });
      
      // Wait for confirmation in background
      tx.wait().then(() => {
        // Reload to ensure we have the exact blockchain state
        loadSongs(targetDj);
      }).catch(error => {
        console.error('Transaction failed:', error);
        toast.error('Vote transaction failed');
        // Reload to revert changes
        loadSongs(targetDj);
      });
    } catch (error) {
      // Revert only the voted status on error
      setVotedSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
      
      toast.error(truncateError(error) || 'Failed to vote');
    } finally {
      // Remove loading state for this song
      setLoadingSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
    }
  }

  async function handleUnvote(songId: number, djAddress?: string) {
    const targetDj = djAddress || selectedDj;
    if (!targetDj || !votedSongs.has(songId)) return;
    
    // Set loading for this specific song
    setLoadingSongs(prev => new Set(prev).add(songId));
    
    try {
      if (!contract.unvote) {
        throw new Error('Unvote function not available');
      }
      const tx = await contract.unvote(targetDj, songId);
      
      // Transaction submitted - update UI immediately
      toast.success('Vote removed');
      
      // Now update the UI with the new vote count and reorder
      flushSync(() => {
        // Remove vote mark
        setVotedSongs(prev => {
          const newSet = new Set(prev);
          newSet.delete(songId);
          return newSet;
        });
        
        // Update vote count only (don't reorder yet)
        const currentSong = songs.find(s => s.id === songId);
        if (currentSong && currentSong.votes > 0) {
          setSongs(prevSongs => {
            // Only update the vote count, maintain current order
            return prevSongs.map(song => 
              song.id === songId ? { ...song, votes: Math.max(0, song.votes - 1) } : song
            );
          });
        }
      });
      
      // Wait for confirmation in background
      tx.wait().then(() => {
        // Reload to ensure we have the exact blockchain state
        loadSongs(targetDj);
      }).catch(error => {
        console.error('Transaction failed:', error);
        toast.error('Unvote transaction failed');
        // Reload to revert changes
        loadSongs(targetDj);
      });
    } catch (error) {
      // Revert only the voted status on error
      setVotedSongs(prev => new Set(prev).add(songId));
      
      toast.error(truncateError(error) || 'Failed to remove vote');
    } finally {
      // Remove loading state for this song
      setLoadingSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
    }
  }

  async function handleStartSet() {
    if (!address) return;
    
    setLoading(true);
    try {
      const tx = await contract.startSet(address);
      await tx.wait();
      toast.success('Set started!');
      loadActiveDjs();
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to start set');
    } finally {
      setLoading(false);
    }
  }

  async function handleStopSet() {
    if (!address) return;
    
    setLoading(true);
    try {
      const tx = await contract.stopSet(address);
      await tx.wait();
      toast.success('Set stopped!');
      setPlayedTracksSet(new Set()); // Clear played tracks when stopping set
      loadActiveDjs();
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to stop set');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDj() {
    if (!newDjAddress) return;
    
    setLoading(true);
    try {
      const tx = await contract.registerDj(newDjAddress);
      await tx.wait();
      toast.success('DJ added!');
      setNewDjAddress('');
      setShowAddDjModal(false);
      
      // Reload all DJs
      await loadAllDjs();
      
      // If the added DJ is the current user, force a role recheck
      if (address && newDjAddress.toLowerCase() === address.toLowerCase()) {
        setRoleChecked(false); // This will trigger the useEffect to recheck the role
      }
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to add DJ');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveDj(djAddress: string) {
    if (!confirm(`Remove DJ ${djAddress}?`)) return;
    
    setLoading(true);
    try {
      const tx = await contract.removeDj(djAddress);
      await tx.wait();
      toast.success('DJ removed!');
      loadAllDjs();
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to remove DJ');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSong() {
    if (!selectedSpotifyTrack) return;
    
    // Format: "Artist - Track Name|spotify:track:ID" using | as separator
    const songToAdd = `${selectedSpotifyTrack.artists[0].name} - ${selectedSpotifyTrack.name}|${selectedSpotifyTrack.uri}`;
    
    setLoading(true);
    try {
      // If user is not a DJ but a DJ is selected, we're suggesting a song
      const targetDj = selectedDj || address;
      const isUserSuggesting = !isDj && selectedDj;
      
      let tx;
      if (isUserSuggesting && selectedDj) {
        // Non-DJ user suggesting a song to an active DJ
        tx = await contract.suggestSong(selectedDj, songToAdd);
      } else {
        // DJ adding a song to their own queue
        tx = await contract.addSong(songToAdd);
      }
      await tx.wait();
      
      toast.success(isUserSuggesting ? 'Track suggested!' : 'Song added!');
      setSelectedSpotifyTrack(null);
      setShowAddSongModal(false);
      
      // Reload songs for the target DJ after a small delay
      if (targetDj) {
        setTimeout(() => {
          loadSongs(targetDj);
        }, 500);
      }
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to add song');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearSong(songId: number) {
    if (!address || !confirm('Remove this song? This will hide it from everyone and reset its votes.')) return;
    
    setLoading(true);
    try {
      const tx = await contract.removeSong(songId);
      await tx.wait();
      toast.success('Song removed');
      // Reload songs
      loadSongs(address);
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to remove song');
    } finally {
      setLoading(false);
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            fontSize: '14px',
            maxWidth: '400px',
            wordBreak: 'break-word',
          },
          success: {
            iconTheme: {
              primary: 'var(--accent-primary)',
              secondary: 'var(--surface-card)',
            },
            style: {
              borderColor: 'var(--accent-primary)',
              boxShadow: '0 0 20px rgba(255, 38, 112, 0.2)',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff4444',
              secondary: 'var(--surface-card)',
            },
            style: {
              borderColor: '#ff4444',
              boxShadow: '0 0 20px rgba(255, 68, 68, 0.2)',
            },
          },
        }}
      />
      
      {/* Header */}
      <header className="border-b border-subtle">
        <div className="container flex items-center justify-between p-md md:p-lg">
          <h1 className="text-2xl md:text-4xl font-bold">
            <span className="text-accent neon-text-subtle">MIXOCRACY</span>
          </h1>
          <CustomConnectButton />
        </div>
      </header>

      {/* Tabs */}
      {isConnected && (isOwner || isDj) && (
        <div className="container">
          <nav className="tabs">
            <button
              className={`tab ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              <RadioIcon className="w-4 h-4" />
              FLOOR
            </button>
            <button
              className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Cog6ToothIcon className="w-4 h-4" />
              BOOTH
            </button>
          </nav>
        </div>
      )}


      {/* Main Content */}
      <main className="container mb-xl pb-xl">
        {!isConnected ? (
          /* Landing Page for non-connected users */
          <div className="mt-lg">
            {/* Hero Section */}
            <section className="text-center mb-xl">
              <h2 className="text-3xl font-bold mb-sm">
                <span className="text-primary">VOTE THE</span>{' '}
                <span className="text-accent neon-text">NEXT TRACK</span>
              </h2>
              <p className="text-lg text-secondary max-w-2xl mx-auto">
                Real-time crowd-sourced DJ sets where the dancefloor decides what plays next
              </p>
            </section>

            {/* How It Works */}
            <section className="grid md:grid-cols-3 gap-lg mb-xl">
              <div className="card glass text-center p-lg">
                <div className="flex justify-center mb-sm">
                  <RadioIcon className="w-10 h-10 text-accent" />
                </div>
                <h3 className="font-semibold mb-xs">DJs GO LIVE</h3>
                <p className="text-tertiary text-xs">
                  DJ enables track suggestions and voting
                </p>
              </div>
              
              <div className="card glass text-center p-lg">
                <div className="flex justify-center mb-sm">
                  <HandRaisedIcon className="w-10 h-10 text-lime" />
                </div>
                <h3 className="font-semibold mb-xs">CROWD VOTES</h3>
                <p className="text-tertiary text-xs">
                  Everyone votes for tracks in real-time
                </p>
              </div>
              
              <div className="card glass text-center p-lg">
                <div className="flex justify-center mb-sm">
                  <PlayIcon className="w-10 h-10 text-cyan" />
                </div>
                <h3 className="font-semibold mb-xs">MUSIC PLAYS</h3>
                <p className="text-tertiary text-xs">
                  Highest voted track plays next
                </p>
              </div>
            </section>

            {/* Live Now Section */}
            <section>
              {activeDjs.length === 1 ? (
                // Single DJ - Show tracklist directly for non-logged in users
                <>
                  <div className="flex items-center justify-between mb-lg">
                    <div>
                      <h3 className="text-2xl font-bold">
                        <span>LIVE NOW: </span>
                        <span className="text-accent">{formatAddress(activeDjs[0])}</span>
                      </h3>
                      {djInfoMap.get(activeDjs[0])?.metadata && (
                        <p className="text-sm text-secondary mt-xs">&ldquo;{djInfoMap.get(activeDjs[0])?.metadata}&rdquo;</p>
                      )}
                    </div>
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      LIVE
                    </div>
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="card glass-dark text-center p-xl">
                      <p className="text-secondary">No tracks in queue yet</p>
                    </div>
                  ) : (
                    <div className="space-y-sm mb-lg">
                      <p className="text-sm text-secondary mb-md">Current tracklist - Log in to vote:</p>
                      {songs.map((song, index) => {
                        const isNext = index === 0;
                        return (
                          <div
                            key={song.id}
                            className={`track-item ${isNext ? 'active' : ''}`}
                          >
                            <div className="flex items-center justify-between w-full gap-md">
                              <div className="flex items-center gap-sm md:gap-md flex-1 min-w-0">
                                <span className="text-tertiary text-xs md:text-sm font-mono">
                                  #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm md:text-base truncate">{parseSongData(song.name).displayName}</h4>
                                  {isNext && (
                                    <span className="badge badge-success text-xs">NEXT UP</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-xs md:gap-sm">
                                <div className="vote-count text-center">
                                  <div className="text-sm md:text-base font-semibold">{song.votes}</div>
                                  <div className="text-xs text-tertiary hidden md:block">votes</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                // Multiple DJs or no DJs
                <>
                  <h3 className="text-2xl font-bold mb-lg flex items-center gap-md">
                    <span>LIVE NOW</span>
                    {activeDjs.length > 0 && (
                      <div className="live-indicator">
                        <span className="live-dot"></span>
                        {activeDjs.length} DJ{activeDjs.length !== 1 ? 'S' : ''}
                      </div>
                    )}
                  </h3>
                  
                  {activeDjs.length === 0 ? (
                    <div className="card glass-dark text-center p-xl">
                      <p className="text-secondary mb-lg">No DJs are currently live</p>
                      <p className="text-sm text-tertiary">Check back soon or log in if you&apos;re a DJ</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
                      {activeDjs.map((djAddress) => {
                        const info = djInfoMap.get(djAddress);
                        return (
                          <div
                            key={djAddress}
                            className="card glass-dark hoverable cursor-pointer transition-all"
                            onClick={() => {
                              if (!isConnected) {
                                toast.error('Please log in to vote on tracks');
                              } else {
                                setSelectedDj(djAddress);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-md">
                              <h4 className="font-semibold text-lg">{formatAddress(djAddress)}</h4>
                              <div className="live-indicator">
                                <span className="live-dot"></span>
                                LIVE
                              </div>
                            </div>
                            {info && (
                              <div className="space-y-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-secondary">Tracks loaded</span>
                                  <span className="font-mono text-sm">{info.songCount}</span>
                                </div>
                                {info.metadata && (
                                  <p className="text-xs text-tertiary italic">&ldquo;{info.metadata}&rdquo;</p>
                                )}
                              </div>
                            )}
                            <div className="mt-lg border-t border-subtle">
                              <div style={{ paddingTop: '1.5rem' }}>
                                {isConnected ? (
                                  <p className="text-xs text-accent uppercase tracking-wide">
                                    View tracklist →
                                  </p>
                                ) : (
                                  <button 
                                    className="text-xs text-accent uppercase tracking-wide hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Find and click the Log In button
                                      const loginButton = document.querySelector('.btn.btn-primary');
                                      if (loginButton && loginButton.textContent === 'Log In') {
                                        (loginButton as HTMLButtonElement).click();
                                      }
                                    }}
                                  >
                                    Log in to vote →
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* CTA Section */}
            {!isConnected && (
              <section className="text-center mt-xl">
                <div className="card glass-dark p-lg max-w-md mx-auto">
                  <h3 className="text-lg font-bold mb-sm">READY TO JOIN?</h3>
                  <p className="text-secondary text-sm mb-md">
                    Connect your wallet to vote on tracks
                  </p>
                  <CustomConnectButton />
                </div>
              </section>
            )}
          </div>
        ) : (!isOwner && !isDj) ? (
          /* Logged in but not a DJ - show live DJs or direct tracklist */
          <div className="mt-xl">
            <section>
              {activeDjs.length === 1 ? (
                // Single DJ - show tracklist directly
                <>
                  <div className="mb-lg">
                    <div className="flex items-center justify-between mb-md">
                      <div>
                        <h2 className="text-xl font-semibold">Live Now: {formatAddress(activeDjs[0])}</h2>
                        {djInfoMap.get(activeDjs[0])?.metadata && (
                          <p className="text-sm text-secondary mt-xs">&ldquo;{djInfoMap.get(activeDjs[0])?.metadata}&rdquo;</p>
                        )}
                      </div>
                      <div className="live-indicator hidden md:flex">
                        <span className="live-dot"></span>
                        LIVE
                      </div>
                    </div>
                    {/* Mobile: Full-width suggest button */}
                    <button
                      className="btn btn-primary btn-lg w-full md:hidden"
                      onClick={() => {
                        setSelectedDj(activeDjs[0]);
                        setShowAddSongModal(true);
                      }}
                    >
                      <PlusIcon className="w-5 h-5" />
                      Suggest a Track
                    </button>
                  </div>
                  
                  {/* Desktop: Add suggest button between header and track list */}
                  <div className="hidden md:flex justify-end mb-lg">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        console.log('Desktop suggest button clicked');
                        console.log('Current selectedDj:', selectedDj);
                        console.log('Setting selectedDj to:', activeDjs[0]);
                        setSelectedDj(activeDjs[0]);
                        setShowAddSongModal(true);
                        console.log('showAddSongModal set to true');
                      }}
                    >
                      <PlusIcon className="w-5 h-5" />
                      Suggest a Track
                    </button>
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="card text-center p-xl">
                      <p className="text-secondary">No tracks in queue</p>
                    </div>
                  ) : (
                    <div className="space-y-sm">
                      {songs.map((song, index) => {
                        const hasVoted = votedSongs.has(song.id);
                        const isNext = index === 0;
                        
                        return (
                          <div
                            key={song.id}
                            className={`track-item ${isNext ? 'active' : ''}`}
                          >
                            <div className="flex items-center justify-between w-full gap-md">
                              <div className="flex items-center gap-sm md:gap-md flex-1 min-w-0">
                                <span className="text-tertiary text-xs md:text-sm font-mono">
                                  #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm md:text-base truncate">{parseSongData(song.name).displayName}</h4>
                                  {isNext && (
                                    <span className="badge badge-success text-xs">NEXT UP</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-xs md:gap-sm">
                                <div className="vote-count text-center">
                                  <div className="text-sm md:text-base font-semibold">{song.votes}</div>
                                  <div className="text-xs text-tertiary hidden md:block">votes</div>
                                </div>
                                <button
                                  className={`vote-button ${hasVoted ? 'voted' : ''}`}
                                  onClick={() => handleVote(song.id, activeDjs[0])}
                                  disabled={hasVoted || loading}
                                >
                                  {hasVoted ? '✓' : '↑'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                // Multiple DJs or no DJs - show grid
                <>
                  <h2 className="text-2xl font-bold mb-lg flex items-center gap-md">
                    <span>LIVE DJs</span>
                    {activeDjs.length > 0 && (
                      <div className="live-indicator">
                        <span className="live-dot"></span>
                        {activeDjs.length}
                      </div>
                    )}
                  </h2>
                  
                  {activeDjs.length === 0 ? (
                    <div className="card glass-dark text-center p-xl">
                      <p className="text-secondary mb-lg">No DJs are currently live</p>
                      <p className="text-sm text-tertiary">Check back soon for live sets</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
                      {activeDjs.map((djAddress) => {
                        const info = djInfoMap.get(djAddress);
                        const isSelected = selectedDj === djAddress;
                        return (
                          <div
                            key={djAddress}
                            className={`card glass-dark hoverable cursor-pointer transition-all ${isSelected ? 'ring-2 ring-accent' : ''}`}
                            onClick={() => setSelectedDj(djAddress)}
                          >
                            <div className="flex items-center justify-between mb-md">
                              <h3 className="font-semibold text-lg">{formatAddress(djAddress)}</h3>
                              <div className="live-indicator">
                                <span className="live-dot"></span>
                                LIVE
                              </div>
                            </div>
                            {info && (
                              <div className="space-y-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-secondary">Tracks loaded</span>
                                  <span className="font-mono text-sm">{info.songCount}</span>
                                </div>
                                {info.metadata && (
                                  <p className="text-xs text-tertiary italic">&ldquo;{info.metadata}&rdquo;</p>
                                )}
                              </div>
                            )}
                            <div className="mt-lg border-t border-subtle">
                              <div style={{ paddingTop: '1.5rem' }}>
                                <p className="text-xs text-accent uppercase tracking-wide flex items-center gap-xs">
                                  <span>View tracklist</span>
                                  <span>→</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        ) : activeTab === 'live' || (!isDj && !isOwner) ? (
          <div>
            {/* Active DJs */}
            <section>
              {activeDjs.length === 1 ? (
                // Single DJ - show tracklist directly
                <>
                  <div className="mb-lg">
                    <h2 className="text-2xl font-bold mb-sm">
                      <span className="text-primary">VOTE THE</span>{' '}
                      <span className="text-accent">NEXT TRACK</span>
                    </h2>
                    <div className="flex items-center gap-sm flex-wrap">
                      <span className="text-sm text-secondary">DJ:</span>
                      <span className="text-sm font-medium">{formatAddress(activeDjs[0])}</span>
                      {djInfoMap.get(activeDjs[0])?.metadata && (
                        <span className="text-sm text-tertiary italic">&ldquo;{djInfoMap.get(activeDjs[0])?.metadata}&rdquo;</span>
                      )}
                      <div className="live-indicator">
                        <span className="live-dot"></span>
                        LIVE
                      </div>
                    </div>
                  </div>
                  
                  {/* Mobile: Full-width suggest button */}
                  {isConnected && (
                    <button
                      className="btn btn-primary btn-lg w-full mb-md md:hidden"
                      onClick={() => {
                        setSelectedDj(activeDjs[0]);
                        setShowAddSongModal(true);
                      }}
                    >
                      <PlusIcon className="w-5 h-5" />
                      Suggest a Track
                    </button>
                  )}
                  
                  <div className="flex items-center justify-between mb-md">
                    <h3 className="text-lg font-semibold">Track Queue</h3>
                    {/* Desktop: Inline button */}
                    {isConnected && (
                      <button
                        className="btn btn-primary btn-sm hidden md:flex"
                        onClick={() => {
                          setSelectedDj(activeDjs[0]);
                          setShowAddSongModal(true);
                        }}
                      >
                        <PlusIcon className="w-4 h-4" />
                        Suggest a Track
                      </button>
                    )}
                  </div>
                  
                  {songs.filter(song => !playedTracksSet.has(song.id)).length === 0 ? (
                    <div className="card text-center p-xl">
                      <p className="text-secondary">No tracks in queue</p>
                      {isConnected && (
                        <p className="text-sm text-tertiary mt-sm">Be the first to suggest a track!</p>
                      )}
                    </div>
                  ) : (
                    <LayoutGroup>
                      <div className="track-list">
                        <AnimatePresence mode="popLayout">
                          {songs
                            .filter(song => !playedTracksSet.has(song.id))
                            .map((song, index) => {
                            const hasVoted = votedSongs.has(song.id);
                            const isNext = index === 0;
                            
                            return (
                              <motion.div
                                key={`track-${song.id}`}
                                layout="position"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ 
                                  opacity: 1, 
                                  y: 0
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                  layout: {
                                    duration: 0.3,
                                    ease: "easeInOut"
                                  },
                                  opacity: {
                                    duration: 0.2
                                  }
                                }}
                                className={`track-item ${isNext ? 'active' : ''}`}
                              >
                            <div className="flex items-center justify-between w-full gap-md">
                              <div className="flex items-center gap-sm md:gap-md flex-1 min-w-0">
                                <span className="text-tertiary text-xs md:text-sm font-mono">
                                  #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm md:text-base truncate">{parseSongData(song.name).displayName}</h4>
                                  {isNext && (
                                    <span className="badge badge-success text-xs">NEXT UP</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-xs md:gap-sm">
                                {isConnected ? (
                                  <VoteButton
                                    hasVoted={hasVoted}
                                    isLoading={loadingSongs.has(song.id)}
                                    onClick={() => {
                                      // Explicit check to ensure proper handling in MetaMask
                                      const isVoted = votedSongs.has(song.id);
                                      if (isVoted) {
                                        handleUnvote(song.id, activeDjs[0]);
                                      } else {
                                        handleVote(song.id, activeDjs[0]);
                                      }
                                    }}
                                    votes={song.votes}
                                  />
                                ) : (
                                  <div className="vote-count text-center">
                                    <div className="text-sm md:text-base font-semibold">{song.votes}</div>
                                    <div className="text-xs text-tertiary hidden md:block">votes</div>
                                  </div>
                                )}
                              </div>
                            </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </LayoutGroup>
                  )}
                  
                  {/* Mobile voting hint */}
                  <MobileVoteHint 
                    show={isConnected && songs.filter(song => !playedTracksSet.has(song.id)).length > 0 && votedSongs.size > 0}
                  />
                </>
              ) : (
                // Multiple DJs or no DJs - show grid
                <>
                  <h2 className="text-xl font-semibold mb-lg">Live DJs</h2>
                  {activeDjs.length === 0 ? (
                    <div className="card text-center p-xl">
                      <p className="text-secondary">No DJs are currently live</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
                      {activeDjs.map((djAddress) => {
                        const info = djInfoMap.get(djAddress);
                        const isSelected = selectedDj === djAddress;
                        return (
                          <div
                            key={djAddress}
                            className={`card glass-dark hoverable cursor-pointer transition-all ${isSelected ? 'ring-2 ring-accent' : ''}`}
                            onClick={() => setSelectedDj(djAddress)}
                          >
                            <div className="flex items-center justify-between mb-md">
                              <h3 className="font-semibold text-lg">{formatAddress(djAddress)}</h3>
                              <div className="live-indicator">
                                <span className="live-dot"></span>
                                LIVE
                              </div>
                            </div>
                            {info && (
                              <div className="space-y-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-secondary">Tracks in queue</span>
                                  <span className="font-mono text-sm">{info.songCount}</span>
                                </div>
                                {info.metadata && (
                                  <p className="text-xs text-tertiary italic">&ldquo;{info.metadata}&rdquo;</p>
                                )}
                              </div>
                            )}
                            <div className="mt-lg border-t border-subtle">
                              <div style={{ paddingTop: '1.5rem' }}>
                                <p className="text-xs text-accent uppercase tracking-wide flex items-center gap-xs">
                                  <span>View tracklist</span>
                                  <span>→</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Song List - Only show when multiple DJs and one is selected */}
            {selectedDj && activeDjs.length > 1 && (
              <section className="mt-2xl">
                <div className="flex items-center justify-between mb-lg">
                  <h2 className="text-xl font-semibold">Song Queue</h2>
                  <div className="flex items-center gap-sm">
                    {isConnected && (
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowAddSongModal(true)}
                      >
                        <PlusIcon className="w-5 h-5" />
                        Suggest a Track
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedDj(null)}
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Close
                    </button>
                  </div>
                </div>
                
                {songs.length === 0 ? (
                  <div className="card text-center p-xl">
                    <p className="text-secondary">No songs in queue</p>
                    {isConnected && (
                      <p className="text-sm text-tertiary mt-sm">Be the first to suggest a track!</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-sm">
                    {songs.map((song, index) => {
                      const hasVoted = votedSongs.has(song.id);
                      const isNext = index === 0;
                      
                      return (
                        <div
                          key={song.id}
                          className={`track-item ${isNext ? 'active' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full gap-md">
                            <div className="flex items-center gap-sm md:gap-md flex-1 min-w-0">
                              <span className="text-tertiary text-xs md:text-sm font-mono">
                                #{index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm md:text-base truncate">{parseSongData(song.name).displayName}</h4>
                                {isNext && (
                                  <span className="badge badge-success text-xs">NEXT UP</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-xs md:gap-sm">
                              {isConnected ? (
                                <VoteButton
                                  hasVoted={hasVoted}
                                  isLoading={loadingSongs.has(song.id)}
                                  onClick={() => {
                                    // Explicit check to ensure proper handling in MetaMask
                                    const isVoted = votedSongs.has(song.id);
                                    if (isVoted) {
                                      handleUnvote(song.id);
                                    } else {
                                      handleVote(song.id);
                                    }
                                  }}
                                  votes={song.votes}
                                />
                              ) : (
                                <div className="vote-count text-center">
                                  <div className="text-sm md:text-base font-semibold">{song.votes}</div>
                                  <div className="text-xs text-tertiary hidden md:block">votes</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Mobile voting hint */}
                <MobileVoteHint 
                  show={isConnected && songs.length > 0 && votedSongs.size > 0}
                />
              </section>
            )}
          </div>
        ) : (
          /* Admin Panel */
          <div>
            {/* DJ Controls */}
            {isDj && (
              <div className="card mb-xl">
                <div className="flex items-center justify-between mb-lg">
                  <h3 className="text-lg font-semibold">Your DJ Controls</h3>
                  {activeDjs.includes(address!) ? (
                    <div className="flex items-center gap-md">
                      <div className="live-indicator">
                        <span className="live-dot"></span>
                        LIVE
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={handleStopSet}>
                        Stop Set
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={handleStartSet}>
                      Start Set
                    </button>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-secondary">
                    Manage your songs and go live when ready
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddSongModal(true)}
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Song
                  </button>
                </div>
              </div>
            )}

            {/* Spotify Player */}
            {isDj && (
              <div className="mb-xl">
                <DjPlayer 
                  songs={songs} 
                  isLive={activeDjs.includes(address!)}
                  djAddress={address}
                  onSpotifyConnect={() => {
                    // Optional: Handle post-connection logic
                  }}
                  onPlayedTracksChange={setPlayedTracksSet}
                />
              </div>
            )}

            {/* My Tracks */}
            {isDj && (
              <section className="mb-xl">
                <h3 className="text-lg font-semibold mb-md">Manage Tracks</h3>
                {songs.filter(song => !playedTracksSet.has(song.id)).length === 0 ? (
                  <div className="card text-center p-lg">
                    <p className="text-secondary">No tracks added yet</p>
                    <p className="text-sm text-tertiary mt-sm">Click &ldquo;Add Song&rdquo; to add your first track</p>
                  </div>
                ) : (
                  <LayoutGroup id="manage-tracks">
                    <div className="track-list">
                      <AnimatePresence mode="popLayout">
                        {songs
                          .filter(song => !playedTracksSet.has(song.id))
                          .map((song, index) => (
                          <motion.div
                            key={`manage-${song.id}`}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              transition: {
                                type: "spring",
                                stiffness: 200,
                                damping: 25
                              }
                            }}
                            exit={{ opacity: 0, scale: 0.9, x: -50 }}
                            className="track-item"
                          >
                        <div className="flex items-center gap-md flex-1">
                          <span className="text-tertiary text-sm font-mono">#{index + 1}</span>
                          <h4 className="font-medium">{parseSongData(song.name).displayName}</h4>
                        </div>
                        <div className="flex items-center gap-sm">
                          <span className="text-sm text-secondary">{song.votes} votes</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleClearSong(song.id)}
                            title="Remove song"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </LayoutGroup>
                )}
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-lg">
                <h2 className="text-xl font-semibold">DJ Management</h2>
                {isOwner && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddDjModal(true)}
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add DJ
                  </button>
                )}
              </div>

              {allDjs.length === 0 ? (
                <div className="card text-center p-xl">
                  <p className="text-secondary">No DJs registered</p>
                </div>
              ) : (
                <div className="space-y-sm">
                  {allDjs.map((djAddress) => {
                    const info = djInfoMap.get(djAddress);
                    const isActive = activeDjs.includes(djAddress);
                    
                    return (
                      <div key={djAddress} className="card flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{formatAddress(djAddress)}</h4>
                          {info && (
                            <p className="text-sm text-secondary">
                              {info.songCount} songs • {isActive ? 'Currently live' : 'Offline'}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-sm">
                          {isActive && (
                            <div className="live-indicator">
                              <span className="live-dot"></span>
                              LIVE
                            </div>
                          )}
                          {isOwner && djAddress !== address && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRemoveDj(djAddress)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Contract Info */}
            <section className="mt-2xl">
              <h3 className="text-lg font-semibold mb-md">Contract Info</h3>
              <div className="card">
                <div className="space-y-sm">
                  <div>
                    <span className="text-tertiary text-sm">Contract Address</span>
                    <p className="font-mono text-sm">{MIXOCRACY_CONTRACT_ADDRESS}</p>
                  </div>
                  <div>
                    <span className="text-tertiary text-sm">Network</span>
                    <p className="text-sm">Westend Asset Hub</p>
                  </div>
                  <div>
                    <span className="text-tertiary text-sm">Your Role</span>
                    <p className="text-sm">
                      {isOwner ? 'Owner' : isDj ? 'DJ' : 'User'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Add DJ Modal */}
      {showAddDjModal && (
        <div className="modal-backdrop" onClick={() => setShowAddDjModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New DJ</h3>
              <button
                className="btn-icon"
                onClick={() => setShowAddDjModal(false)}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-md">
              <div>
                <label className="block text-sm font-medium mb-sm">
                  DJ Wallet Address
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="0x..."
                  value={newDjAddress}
                  onChange={(e) => setNewDjAddress(e.target.value)}
                />
              </div>
              
              <div className="flex gap-sm justify-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowAddDjModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddDj}
                  disabled={!newDjAddress || loading}
                >
                  Add DJ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {showAddSongModal && (
        <>
          {/* Mobile: Full screen overlay */}
          <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-background-primary">
            {/* Background gradient effect */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  radial-gradient(ellipse at 20% 80%, rgba(255, 38, 112, 0.08) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 20%, rgba(7, 255, 255, 0.05) 0%, transparent 50%),
                  radial-gradient(ellipse at 50% 50%, rgba(176, 38, 255, 0.03) 0%, transparent 50%)
                `
              }}
            />
            
            {/* Backdrop blur overlay with darkening */}
            <div className="absolute inset-0 backdrop-blur-md bg-black/30 pointer-events-none" />
            
            <div className="relative flex flex-col">
              <div className="h-12" /> {/* Spacer for top margin */}
              <div className="px-md pb-6 pt-2 border-b border-subtle bg-background-secondary/90">
                <h3 className="text-base font-semibold uppercase tracking-wider text-secondary text-center">
                  {selectedSpotifyTrack ? 'READY TO ADD' : 'SEARCH SONGS'}
                </h3>
              </div>
            </div>
            
            <div className="relative flex-1 flex flex-col">
              {selectedSpotifyTrack ? (
                <div className="flex-1 flex flex-col items-center justify-center p-md">
                  <div className="w-full max-w-sm">
                    <div className="mb-md">
                      {selectedSpotifyTrack.album.images && selectedSpotifyTrack.album.images.length > 0 ? (
                        <Image 
                          src={selectedSpotifyTrack.album.images[0].url} 
                          alt={selectedSpotifyTrack.album.name}
                          width={160}
                          height={160}
                          className="rounded-lg shadow-lg mx-auto"
                        />
                      ) : (
                        <div className="w-40 h-40 rounded-lg bg-surface-card/60 flex items-center justify-center mx-auto">
                          <MusicalNoteIcon className="w-16 h-16 text-tertiary" />
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-xs mb-md">
                      <h3 className="font-bold text-xl">{selectedSpotifyTrack.name}</h3>
                      <p className="text-base text-secondary">
                        {selectedSpotifyTrack.artists.map(a => a.name).join(', ')}
                      </p>
                      <p className="text-sm text-tertiary">{selectedSpotifyTrack.album.name}</p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm w-full"
                      onClick={() => setSelectedSpotifyTrack(null)}
                    >
                      Change Selection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col p-md">
                  <SpotifySearch
                    onSelectTrack={(track: SpotifyTrack) => {
                      setSelectedSpotifyTrack(track);
                    }}
                    placeholder="Search artist or song..."
                  />
                </div>
              )}
            </div>
            
            {/* Mobile: Fixed buttons at bottom */}
            <div className="relative px-md py-md bg-background-secondary/80 border-t border-subtle">
              {selectedSpotifyTrack ? (
                <div className="flex gap-sm">
                  <button
                    className="btn btn-ghost flex-1 py-3"
                    onClick={() => setSelectedSpotifyTrack(null)}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-primary flex-1 py-3"
                    onClick={handleAddSong}
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Track'}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost w-full py-3"
                  onClick={() => {
                    setShowAddSongModal(false);
                    setSelectedSpotifyTrack(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Desktop: Large modal with mobile-like design */}
          <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddSongModal(false)}
            />
            
            <div className="relative w-full max-w-2xl h-[600px] min-h-[600px] bg-background-primary rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Background gradient effect */}
                <div 
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{
                    background: `
                      radial-gradient(ellipse at 20% 80%, rgba(255, 38, 112, 0.08) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 20%, rgba(7, 255, 255, 0.05) 0%, transparent 50%),
                      radial-gradient(ellipse at 50% 50%, rgba(176, 38, 255, 0.03) 0%, transparent 50%)
                    `
                  }}
                />
                
                {/* Header */}
                <div style={{ paddingLeft: '32px', paddingRight: '32px', paddingBottom: '24px', paddingTop: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(30,30,30,0.8)' }}>
                  <h3 className="text-lg font-semibold uppercase tracking-wider text-secondary text-center">
                    {selectedSpotifyTrack ? 'READY TO ADD' : 'SEARCH SONGS'}
                  </h3>
                </div>
                
                {/* Content */}
                <div className="relative flex-1 overflow-y-auto flex flex-col">
                  {selectedSpotifyTrack ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <div className="w-full max-w-sm">
                        <div className="mb-8">
                          {selectedSpotifyTrack.album.images && selectedSpotifyTrack.album.images.length > 0 ? (
                            <Image 
                              src={selectedSpotifyTrack.album.images[0].url} 
                              alt={selectedSpotifyTrack.album.name}
                              width={200}
                              height={200}
                              className="rounded-xl shadow-lg mx-auto"
                            />
                          ) : (
                            <div className="w-[200px] h-[200px] rounded-xl bg-surface-card/60 flex items-center justify-center mx-auto">
                              <MusicalNoteIcon className="w-20 h-20 text-tertiary" />
                            </div>
                          )}
                        </div>
                        <div className="text-center space-y-2 mb-8">
                          <h3 className="font-bold text-2xl">{selectedSpotifyTrack.name}</h3>
                          <p className="text-lg text-secondary">
                            {selectedSpotifyTrack.artists.map(a => a.name).join(', ')}
                          </p>
                          <p className="text-sm text-tertiary">{selectedSpotifyTrack.album.name}</p>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm w-full"
                          onClick={() => setSelectedSpotifyTrack(null)}
                        >
                          Change Selection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflow: 'hidden' }}>
                      <div className="flex-1 flex flex-col min-h-0">
                        <SpotifySearch
                          onSelectTrack={(track: SpotifyTrack) => {
                            setSelectedSpotifyTrack(track);
                          }}
                          placeholder="Search artist or song..."
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer buttons */}
                <div className="relative px-8 py-6 bg-background-secondary/50 border-t border-subtle">
                  {selectedSpotifyTrack ? (
                    <div className="flex gap-4">
                      <button
                        className="btn btn-ghost flex-1"
                        onClick={() => setSelectedSpotifyTrack(null)}
                      >
                        Back
                      </button>
                      <button
                        className="btn btn-primary flex-1"
                        onClick={handleAddSong}
                        disabled={loading}
                      >
                        {loading ? 'Adding...' : 'Add Track'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost w-full"
                      onClick={() => {
                        setShowAddSongModal(false);
                        setSelectedSpotifyTrack(null);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
        </>
      )}

    </>
  );
}