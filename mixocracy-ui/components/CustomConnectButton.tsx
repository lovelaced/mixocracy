'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

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
                  <button onClick={openChainModal} type="button" className="btn btn-primary">
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-sm">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="btn btn-ghost btn-sm flex items-center gap-xs"
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
                    className="btn btn-primary btn-sm"
                  >
                    {account.displayName}
                    {account.displayBalance && (
                      <span className="opacity-70 ml-1">
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