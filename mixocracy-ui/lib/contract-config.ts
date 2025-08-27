import mixocracyAbi from './mixocracy-abi.json';

export const MIXOCRACY_CONTRACT_ADDRESS = '0x42223629303D674AD30338760A6663F9A93484D9' as const;
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