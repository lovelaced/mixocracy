export const PASEO_TESTNET = {
  id: 420420422,
  name: 'Paseo TestNet',
  network: 'paseo',
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
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io' 
    },
  },
  testnet: true,
} as const;

export const WESTEND_TESTNET = {
  id: 2087,
  name: 'Westend AssetHub',
  network: 'westend',
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
      name: 'Westend Explorer', 
      url: 'https://westend-asset-hub.subscan.io' 
    },
  },
  testnet: true,
} as const;