'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import { activeChain } from '@/lib/web3-config';

export const CustomConnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} type="button" className="btn btn-primary">
                    Log In
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button 
                    onClick={async () => {
                      // Try to add and switch to the network
                      if (typeof window !== 'undefined' && window.ethereum) {
                        try {
                          // First try to switch to the network
                          const chainIdHex = `0x${activeChain.id.toString(16)}`;
                          await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: chainIdHex }],
                          });
                        } catch (switchError) {
                          // This error code indicates that the chain has not been added to MetaMask
                          if ((switchError as Error & { code?: number })?.code === 4902) {
                            try {
                              await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [
                                  {
                                    chainId: `0x${activeChain.id.toString(16)}`,
                                    chainName: activeChain.name,
                                    nativeCurrency: activeChain.nativeCurrency,
                                    rpcUrls: activeChain.rpcUrls.default.http,
                                    blockExplorerUrls: [activeChain.blockExplorers?.default.url],
                                  },
                                ],
                              });
                            } catch (addError) {
                              console.error('Failed to add network:', addError);
                            }
                          } else {
                            console.error('Failed to switch network:', switchError);
                          }
                        }
                      }
                    }} 
                    type="button" 
                    className="btn btn-primary"
                  >
                    Add {activeChain.name}
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-xs md:gap-sm">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="btn btn-ghost btn-sm items-center gap-xs hidden md:flex"
                  >
                    {chain.hasIcon && (
                      <div
                        className="w-4 h-4 rounded-full overflow-hidden"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <Image
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            width={16}
                            height={16}
                            className="w-full h-full"
                          />
                        )}
                      </div>
                    )}
                    <span className="text-xs">{chain.name}</span>
                  </button>

                  <button 
                    onClick={openAccountModal} 
                    type="button"
                    className="btn btn-secondary btn-sm"
                  >
                    <span className="hidden md:inline">{account.displayName}</span>
                    <span className="md:hidden">{account.address.slice(0, 6)}...</span>
                    {account.displayBalance && (
                      <span className="opacity-70 ml-1 hidden md:inline">
                        ({account.displayBalance})
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};