'use client';

import { useState, useEffect, useCallback } from 'react';
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
  HandRaisedIcon
} from '@heroicons/react/24/outline';
import { MIXOCRACY_CONTRACT_ADDRESS } from '@/lib/contract-config';
import { CustomConnectButton } from '@/components/CustomConnectButton';
import { truncateError } from '@/lib/utils';

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
  const [isOwner, setIsOwner] = useState(false);
  const [isDj, setIsDj] = useState(false);
  const [showAddDjModal, setShowAddDjModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [newDjAddress, setNewDjAddress] = useState('');
  const [newSongName, setNewSongName] = useState('');
  const [allDjs, setAllDjs] = useState<string[]>([]);

  // Define callback functions first
  const loadActiveDjs = useCallback(async () => {
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
    if (!address) return;
    
    try {
      // Check if owner (hardcoded from deployment)
      setIsOwner(address.toLowerCase() === '0x953701ef658cf531dad9e23e5ef32dda6d6a4467');
      
      // Check if DJ
      const djStatus = await contract.isDj(address);
      setIsDj(djStatus);
      
      if (djStatus || address.toLowerCase() === '0x953701ef658cf531dad9e23e5ef32dda6d6a4467') {
        // Load all DJs if admin or owner
        loadAllDjs();
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }, [address, contract, loadAllDjs]);

  const loadSongs = useCallback(async (djAddress: string) => {
    try {
      // If loading for self in BOOTH and not live, load songs differently
      if (djAddress === address && activeTab === 'admin' && !activeDjs.includes(djAddress)) {
        // Load songs without votes (since we're not active)
        const songCount = await contract.getSongCount(djAddress);
        const songList: Song[] = [];
        
        for (let i = 0; i < songCount; i++) {
          const name = await contract.getSong(djAddress, i);
          // Skip if song name is empty (might be removed)
          if (!name || name.trim() === '') {
            continue;
          }
          // Try to get votes, default to 0 if it fails
          let votes = 0;
          try {
            votes = await contract.getVotes(djAddress, i);
          } catch {
            // Ignore vote errors when not active
          }
          songList.push({ id: i, name, votes });
        }
        
        setSongs(songList);
      } else {
        // Normal flow for active DJs
        const songList = await contract.getSongsWithVotes(djAddress);
        const sortedSongs = songList.sort((a, b) => b.votes - a.votes);
        setSongs(sortedSongs);
      }
    } catch (error) {
      console.error('Error loading songs:', error);
      setSongs([]);
    }
  }, [address, activeTab, activeDjs, contract]);

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
    if (address && contract.hasProvider) {
      checkUserRole();
    }
  }, [address, contract.hasProvider, checkUserRole]);

  // Load songs when DJ is selected or when viewing own tracks in BOOTH
  useEffect(() => {
    if (contract.hasProvider) {
      if (selectedDj) {
        loadSongs(selectedDj);
        const interval = setInterval(() => loadSongs(selectedDj), 5000);
        return () => clearInterval(interval);
      } else if (isDj && activeTab === 'admin' && address) {
        // Load own songs when in BOOTH
        loadSongs(address);
      } else if (activeDjs.length === 1 && activeTab === 'live') {
        // Auto-load songs when there's only one DJ live
        loadSongs(activeDjs[0]);
        const interval = setInterval(() => loadSongs(activeDjs[0]), 5000);
        return () => clearInterval(interval);
      }
    }
  }, [selectedDj, isDj, activeTab, address, contract.hasProvider, loadSongs, activeDjs]);

  async function handleVote(songId: number, djAddress?: string) {
    const targetDj = djAddress || selectedDj;
    if (!targetDj || votedSongs.has(songId)) return;
    
    setLoading(true);
    try {
      const tx = await contract.vote(targetDj, songId);
      await tx.wait();
      
      setVotedSongs(prev => new Set(prev).add(songId));
      toast.success('Vote submitted!');
      
      // Reload songs
      loadSongs(targetDj);
    } catch (error) {
      toast.error(truncateError(error) || 'Failed to vote');
    } finally {
      setLoading(false);
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
      // Reload all DJs to show the newly added one
      loadAllDjs();
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
    if (!newSongName) return;
    
    setLoading(true);
    try {
      const tx = await contract.addSong(newSongName);
      await tx.wait();
      toast.success('Song added!');
      setNewSongName('');
      setShowAddSongModal(false);
      if (selectedDj === address) {
        loadSongs(address);
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
      <main className="container mb-xl">
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
                  DJs start sets and upload tracks for voting
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
                                  <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
            
            {/* Song Voting Section */}
            {selectedDj && isConnected && (
              <div className="modal-backdrop" onClick={() => setSelectedDj(null)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                  <div className="modal-header">
                    <h3 className="modal-title text-lg md:text-xl">
                      <span className="md:hidden">Vote Now</span>
                      <span className="hidden md:inline">Vote on Tracks</span>
                    </h3>
                    <button
                      className="btn-icon"
                      onClick={() => setSelectedDj(null)}
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="text-center p-xl">
                      <p className="text-secondary">No tracks loaded yet</p>
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
                                  <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
                                  className={`vote-button ${hasVoted ? 'voted' : ''} min-w-[60px] md:min-w-[48px]`}
                                  onClick={() => handleVote(song.id)}
                                  disabled={hasVoted || loading}
                                >
                                  {hasVoted ? '✓' : 'VOTE'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (!isOwner && !isDj) ? (
          /* Logged in but not a DJ - show live DJs or direct tracklist */
          <div className="mt-xl">
            <section>
              {activeDjs.length === 1 ? (
                // Single DJ - show tracklist directly
                <>
                  <div className="flex items-center justify-between mb-lg">
                    <div>
                      <h2 className="text-xl font-semibold">Live Now: {formatAddress(activeDjs[0])}</h2>
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
                                  <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
                                  className={`vote-button ${hasVoted ? 'voted' : ''} min-w-[60px] md:min-w-[48px]`}
                                  onClick={() => handleVote(song.id, activeDjs[0])}
                                  disabled={hasVoted || loading}
                                >
                                  {hasVoted ? '✓' : 'VOTE'}
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
            
            {/* Song Voting Modal */}
            {selectedDj && (
              <div className="modal-backdrop" onClick={() => setSelectedDj(null)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                  <div className="modal-header">
                    <h3 className="modal-title">Vote on Tracks</h3>
                    <button
                      className="btn-icon"
                      onClick={() => setSelectedDj(null)}
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="text-center p-xl">
                      <p className="text-secondary">No tracks loaded yet</p>
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
                                  <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
                                  className={`vote-button ${hasVoted ? 'voted' : ''} min-w-[60px] md:min-w-[48px]`}
                                  onClick={() => handleVote(song.id)}
                                  disabled={hasVoted || loading}
                                >
                                  {hasVoted ? '✓' : 'VOTE'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'live' ? (
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
                                  <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
                                {isConnected && (
                                  <button
                                    className={`vote-button ${hasVoted ? 'voted' : ''} min-w-[60px] md:min-w-[48px]`}
                                    onClick={() => handleVote(song.id, activeDjs[0])}
                                    disabled={hasVoted || loading}
                                  >
                                    {hasVoted ? '✓' : 'VOTE'}
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
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedDj(null)}
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Close
                  </button>
                </div>
                
                {songs.length === 0 ? (
                  <div className="card text-center p-xl">
                    <p className="text-secondary">No songs in queue</p>
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
                                <h4 className="font-medium text-sm md:text-base truncate">{song.name}</h4>
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
                              {isConnected && (
                                <button
                                  className={`vote-button ${hasVoted ? 'voted' : ''} min-w-[60px] md:min-w-[48px]`}
                                  onClick={() => handleVote(song.id)}
                                  disabled={hasVoted || loading}
                                >
                                  {hasVoted ? '✓' : 'VOTE'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddSongModal(true)}
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Song
                  </button>
                </div>
              </div>
            )}

            {/* My Tracks */}
            {isDj && (
              <section className="mb-xl">
                <h3 className="text-lg font-semibold mb-md">My Tracks</h3>
                {songs.length === 0 ? (
                  <div className="card text-center p-lg">
                    <p className="text-secondary">No tracks added yet</p>
                    <p className="text-sm text-tertiary mt-sm">Click &ldquo;Add Song&rdquo; to add your first track</p>
                  </div>
                ) : (
                  <div className="space-y-sm">
                    {songs.map((song, index) => (
                      <div key={song.id} className="track-item">
                        <div className="flex items-center gap-md flex-1">
                          <span className="text-tertiary text-sm font-mono">#{index + 1}</span>
                          <h4 className="font-medium">{song.name}</h4>
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
                      </div>
                    ))}
                  </div>
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
                            <div className="badge badge-success">LIVE</div>
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
        <div className="modal-backdrop" onClick={() => setShowAddSongModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Song</h3>
              <button
                className="btn-icon"
                onClick={() => setShowAddSongModal(false)}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-md">
              <div>
                <label className="block text-sm font-medium mb-sm">
                  Song Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter song name..."
                  value={newSongName}
                  onChange={(e) => setNewSongName(e.target.value)}
                />
              </div>
              
              <div className="flex gap-sm justify-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowAddSongModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddSong}
                  disabled={!newSongName || loading}
                >
                  Add Song
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}