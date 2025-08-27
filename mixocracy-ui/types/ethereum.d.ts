interface EthereumProvider {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};