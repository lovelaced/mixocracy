import mixocracyAbi from './mixocracy-abi.json';

export const MIXOCRACY_CONTRACT_ADDRESS = '0x375640Cf3e53d2F7DBDeAe31127889d0adF2A403' as const;
export const MIXOCRACY_ABI = mixocracyAbi;

// Type for song data
export interface Song {
  id: number;
  name: string;
  votes: number;
}

// Type for DJ info
export interface DjInfo {
  isRegistered: boolean;
  isActive: boolean;
  startTime: bigint;
  songCount: number;
  metadata: string;
}