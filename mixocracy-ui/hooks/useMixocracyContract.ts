import { useEffect, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { ethers, BrowserProvider } from 'ethers';
import { MIXOCRACY_CONTRACT_ADDRESS } from '@/lib/contract-config';

// Function selectors computed from ethers.js keccak256
const SELECTORS = {
  registerDj: '0x19c236c0', // registerDj(address)
  addSong: '0x7f590f5e', // addSong(string)
  vote: '0x5f74bbde', // vote(address,uint256)
  getVotes: '0xeb9019d4', // getVotes(address,uint256)
  getSong: '0xa4a229cb', // getSong(address,uint256)
  getSongCount: '0xe8771fbe', // getSongCount(address)
  isDj: '0x41d10bee', // isDj(address)
  removeDj: '0x7b6b47a8', // removeDj(address)
  clearVotes: '0xba37829d', // clearVotes(address,uint256)
  hasVoted: '0xa187302b', // hasVoted(address,address,uint256)
  startSet: '0xb4d6b562', // startSet(address)
  stopSet: '0x6b41c169', // stopSet(address)
  isSetActive: '0x2e81782f', // isSetActive(address)
  getActiveDjs: '0x9a709fa4', // getActiveDjs()
  getAllSongsWithVotes: '0x47f8dc84', // getAllSongsWithVotes(address) - returns only non-removed songs
  setDjMetadata: '0xb4a31427', // setDjMetadata(address,string)
  getDjMetadata: '0x197e053e', // getDjMetadata(address)
  getDjInfo: '0xe9230c05', // getDjInfo(address)
  getAllDjs: '0xa2f82c28', // getAllDjs()
  removeSong: '0xd4342cc7', // removeSong(uint256)
  suggestSong: '0x01725aa1', // suggestSong(address,string)
  unvote: '0x02aa9be2', // unvote(address,uint256)
  removeSongUniversal: '0x42ed653b', // removeSongUniversal(address,uint256)
  isSongRemoved: '0x59d23866', // isSongRemoved(address,uint256)
};

// Helper functions
function encodeParams(types: string[], values: any[]): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(types, values);
}

function decodeReturn(types: string[], data: string): any[] {
  return ethers.AbiCoder.defaultAbiCoder().decode(types, data);
}

export interface Song {
  id: number;
  name: string;
  votes: number;
}

export interface DjInfo {
  isRegistered: boolean;
  isActive: boolean;
  startTime: bigint;
  songCount: number;
  metadata: string;
}

export function useMixocracyContract() {
  const { data: walletClient } = useWalletClient();
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [readOnlyProvider, setReadOnlyProvider] = useState<ethers.JsonRpcProvider | null>(null);

  useEffect(() => {
    // Set up read-only provider only once
    if (!readOnlyProvider) {
      // Get RPC URL based on network
      const network = process.env.NEXT_PUBLIC_NETWORK || 'paseo'; // Default to paseo
      const rpcUrl = network === 'westend'
        ? 'https://westend-asset-hub-eth-rpc.polkadot.io'
        : 'https://testnet-passet-hub-eth-rpc.polkadot.io'; // Paseo is default
      
      const jsonProvider = new ethers.JsonRpcProvider(rpcUrl);
      setReadOnlyProvider(jsonProvider);
    }
  }, [readOnlyProvider]);

  useEffect(() => {
    async function setupProvider() {
      if (!walletClient) {
        setProvider(null);
        return;
      }

      try {
        const browserProvider = new BrowserProvider(walletClient as any);
        setProvider(browserProvider);
      } catch (error) {
        console.error('Error setting up provider:', error);
        setProvider(null);
      }
    }

    setupProvider();
  }, [walletClient]);

  const callContract = async (selector: string, paramTypes: string[] = [], params: any[] = []) => {
    const activeProvider = readOnlyProvider || provider;
    if (!activeProvider) throw new Error('No provider available');
    
    let data = selector;
    if (paramTypes.length > 0) {
      data += encodeParams(paramTypes, params).slice(2);
    }
    
    const result = await activeProvider.call({
      to: MIXOCRACY_CONTRACT_ADDRESS,
      data
    });

    if (result === '0x') {
      throw new Error(`Contract call failed - empty response. Selector: ${selector}`);
    }

    return result;
  };

  const sendTransaction = async (selector: string, paramTypes: string[] = [], params: any[] = [], value?: bigint) => {
    if (!provider) throw new Error('Provider not available');
    
    const signer = await provider.getSigner();
    
    let data = selector;
    if (paramTypes.length > 0) {
      data += encodeParams(paramTypes, params).slice(2);
    }

    const tx = await signer.sendTransaction({
      to: MIXOCRACY_CONTRACT_ADDRESS,
      data,
      ...(value ? { value } : {})
    });

    return tx;
  };

  // DJ Management Functions
  const registerDj = async (djAddress: string) => {
    return sendTransaction(SELECTORS.registerDj, ['address'], [djAddress]);
  };

  const removeDj = async (djAddress: string) => {
    return sendTransaction(SELECTORS.removeDj, ['address'], [djAddress]);
  };

  const isDj = async (djAddress: string): Promise<boolean> => {
    const result = await callContract(SELECTORS.isDj, ['address'], [djAddress]);
    return decodeReturn(['bool'], result)[0];
  };

  // DJ Set Management
  const startSet = async (djAddress: string) => {
    return sendTransaction(SELECTORS.startSet, ['address'], [djAddress]);
  };

  const stopSet = async (djAddress: string) => {
    return sendTransaction(SELECTORS.stopSet, ['address'], [djAddress]);
  };

  const isSetActive = async (djAddress: string): Promise<boolean> => {
    const result = await callContract(SELECTORS.isSetActive, ['address'], [djAddress]);
    return decodeReturn(['bool'], result)[0];
  };

  const getActiveDjs = async (): Promise<string[]> => {
    const result = await callContract(SELECTORS.getActiveDjs);
    return decodeReturn(['address[]'], result)[0];
  };

  const getAllDjs = async (): Promise<string[]> => {
    const result = await callContract(SELECTORS.getAllDjs);
    return decodeReturn(['address[]'], result)[0];
  };

  // Song Management
  const addSong = async (songName: string) => {
    return sendTransaction(SELECTORS.addSong, ['string'], [songName]);
  };

  const getSong = async (djAddress: string, songId: number): Promise<string> => {
    const result = await callContract(SELECTORS.getSong, ['address', 'uint256'], [djAddress, songId]);
    return decodeReturn(['string'], result)[0];
  };

  const getSongCount = async (djAddress: string): Promise<number> => {
    const result = await callContract(SELECTORS.getSongCount, ['address'], [djAddress]);
    return decodeReturn(['uint256'], result)[0];
  };

  const getAllSongsWithVotes = async (djAddress: string): Promise<Song[]> => {
    const result = await callContract(SELECTORS.getAllSongsWithVotes, ['address'], [djAddress]);
    const decoded = decodeReturn(['(uint256,string,uint256)[]'], result)[0];
    return decoded.map((item: any) => ({
      id: Number(item[0]),
      name: item[1],
      votes: Number(item[2])
    }));
  };

  // Voting Functions
  const vote = async (djAddress: string, songId: number) => {
    return sendTransaction(SELECTORS.vote, ['address', 'uint256'], [djAddress, songId]);
  };

  const unvote = async (djAddress: string, songId: number) => {
    return sendTransaction(SELECTORS.unvote, ['address', 'uint256'], [djAddress, songId]);
  };

  const getVotes = async (djAddress: string, songId: number): Promise<number> => {
    const result = await callContract(SELECTORS.getVotes, ['address', 'uint256'], [djAddress, songId]);
    return Number(decodeReturn(['uint256'], result)[0]);
  };

  const hasVoted = async (voter: string, djAddress: string, songId: number): Promise<boolean> => {
    const result = await callContract(SELECTORS.hasVoted, ['address', 'address', 'uint256'], [voter, djAddress, songId]);
    return decodeReturn(['bool'], result)[0];
  };

  const clearVotes = async (djAddress: string, songId: number) => {
    return sendTransaction(SELECTORS.clearVotes, ['address', 'uint256'], [djAddress, songId]);
  };

  const removeSong = async (songId: number) => {
    return sendTransaction(SELECTORS.removeSong, ['uint256'], [songId]);
  };

  const suggestSong = async (djAddress: string, songName: string) => {
    return sendTransaction(SELECTORS.suggestSong, ['address', 'string'], [djAddress, songName]);
  };

  // DJ Metadata Functions
  const setDjMetadata = async (djAddress: string, metadata: string) => {
    return sendTransaction(SELECTORS.setDjMetadata, ['address', 'string'], [djAddress, metadata]);
  };

  const getDjMetadata = async (djAddress: string): Promise<string> => {
    const result = await callContract(SELECTORS.getDjMetadata, ['address'], [djAddress]);
    return decodeReturn(['string'], result)[0];
  };

  const getDjInfo = async (djAddress: string): Promise<DjInfo> => {
    const result = await callContract(SELECTORS.getDjInfo, ['address'], [djAddress]);
    const decoded = decodeReturn(['(bool,bool,uint256,uint256,string)'], result)[0];
    return {
      isRegistered: decoded[0],
      isActive: decoded[1],
      startTime: decoded[2],
      songCount: Number(decoded[3]),
      metadata: decoded[4]
    };
  };

  const isSongRemoved = async (djAddress: string, songId: number): Promise<boolean> => {
    try {
      const result = await callContract(SELECTORS.isSongRemoved, ['address', 'uint256'], [djAddress, songId]);
      return decodeReturn(['bool'], result)[0];
    } catch {
      // If the method doesn't exist or fails, assume song is not removed
      return false;
    }
  };

  return {
    hasProvider: !!readOnlyProvider || !!provider,
    hasWallet: !!provider,
    // DJ Management
    registerDj,
    removeDj,
    isDj,
    // DJ Set Management
    startSet,
    stopSet,
    isSetActive,
    getActiveDjs,
    getAllDjs,
    // Song Management
    addSong,
    getSong,
    getSongCount,
    getAllSongsWithVotes,
    removeSong,
    suggestSong,
    // Voting
    vote,
    unvote,
    getVotes,
    hasVoted,
    clearVotes,
    // DJ Metadata
    setDjMetadata,
    getDjMetadata,
    getDjInfo,
    isSongRemoved,
  };
}