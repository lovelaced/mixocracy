import mixocracyAbi from './mixocracy-abi.json';

export const MIXOCRACY_CONTRACT_ADDRESS = '0xc266af4f9e53Efc34E9213D36a60dcA6b74C2e5b' as const;
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