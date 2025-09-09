import mixocracyAbi from './mixocracy-abi.json';

// Default to Paseo contract address if not specified
// Trim whitespace to handle environment variables that might have trailing newlines
export const MIXOCRACY_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_MIXOCRACY_CONTRACT_ADDRESS || '0x5F98737E92016b237A451db3258655B691904fBe').trim();
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