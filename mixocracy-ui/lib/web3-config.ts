import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define Westend Asset Hub chain
export const westendAssetHub = defineChain({
  id: 420420421, // 0x190f1b45 in hex
  name: 'Westend Asset Hub',
  nativeCurrency: {
    decimals: 12,
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

export const config = getDefaultConfig({
  appName: 'Mixocracy',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [westendAssetHub],
  ssr: true,
});