import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define Westend Asset Hub chain
export const westendAssetHub = defineChain({
  id: 420420421, // 0x190f1b45 in hex
  name: 'Westend Asset Hub',
  nativeCurrency: {
    decimals: 18,
    name: 'WND',
    symbol: 'WND',
  },
  rpcUrls: {
    default: { 
      http: ['https://westend-asset-hub-eth-rpc.polkadot.io'],
    },
    public: { 
      http: ['https://westend-asset-hub-eth-rpc.polkadot.io'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Blockscout', 
      url: 'https://blockscout-asset-hub.parity-chains-scw.parity.io',
    },
  },
  testnet: true,
});

// Define Paseo TestNet chain
export const paseoTestnet = defineChain({
  id: 420420422, // 0x190f1b46 in hex
  name: 'Polkadot Hub TestNet',
  nativeCurrency: {
    decimals: 18,
    name: 'PAS',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: { 
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    },
    public: { 
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'BlockScout', 
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io',
    },
  },
  testnet: true,
});

// Get the chain based on environment variable
const getActiveChain = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'paseo'; // Default to paseo
  switch (network.toLowerCase()) {
    case 'westend':
      return westendAssetHub;
    case 'paseo':
    default:
      return paseoTestnet;
  }
};

export const activeChain = getActiveChain();

// Only export the active chain, not all chains
export const config = getDefaultConfig({
  appName: 'Mixocracy',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '615236977daa232596793212be188282',
  chains: [activeChain], // Only include the active chain
  ssr: true,
});