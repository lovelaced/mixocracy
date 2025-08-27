'use client';

import * as React from 'react';
import { 
  RainbowKitProvider, 
  darkTheme,
  Theme 
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from './web3-config';
import merge from 'lodash.merge';

const queryClient = new QueryClient();

// Custom theme that matches our Berlin techno aesthetic
const customTheme = merge(darkTheme(), {
  colors: {
    accentColor: '#FF2670',
    accentColorForeground: '#FFFFFF',
    actionButtonBorder: 'rgba(255, 255, 255, 0.1)',
    actionButtonBorderMobile: 'rgba(255, 255, 255, 0.1)',
    actionButtonSecondaryBackground: 'rgba(255, 255, 255, 0.05)',
    closeButton: 'rgba(255, 255, 255, 0.7)',
    closeButtonBackground: 'rgba(255, 255, 255, 0.05)',
    connectButtonBackground: '#191414',
    connectButtonBackgroundError: '#FF2670',
    connectButtonInnerBackground: 'rgba(255, 255, 255, 0.05)',
    connectButtonText: '#FFFFFF',
    connectButtonTextError: '#FFFFFF',
    connectionIndicator: '#E4FF07',
    downloadBottomCardBackground: 'linear-gradient(126deg, rgba(255, 38, 112, 0.1) 9%, rgba(7, 255, 255, 0.05) 91%)',
    downloadTopCardBackground: 'linear-gradient(126deg, rgba(228, 255, 7, 0.1) 9%, rgba(176, 38, 255, 0.05) 91%)',
    error: '#FF2670',
    generalBorder: 'rgba(255, 255, 255, 0.1)',
    generalBorderDim: 'rgba(255, 255, 255, 0.05)',
    menuItemBackground: 'rgba(255, 255, 255, 0.05)',
    modalBackdrop: 'rgba(0, 0, 0, 0.8)',
    modalBackground: '#191414',
    modalBorder: 'rgba(255, 38, 112, 0.2)',
    modalText: '#FFFFFF',
    modalTextDim: 'rgba(255, 255, 255, 0.7)',
    modalTextSecondary: 'rgba(255, 255, 255, 0.5)',
    profileAction: 'rgba(255, 255, 255, 0.05)',
    profileActionHover: 'rgba(255, 255, 255, 0.1)',
    profileForeground: '#191414',
    selectedOptionBorder: 'rgba(255, 38, 112, 0.5)',
    standby: '#E4FF07',
  },
  radii: {
    actionButton: '8px',
    connectButton: '8px',
    menuButton: '8px',
    modal: '12px',
    modalMobile: '12px',
  },
  shadows: {
    connectButton: '0 4px 12px rgba(255, 38, 112, 0.2)',
    dialog: '0 8px 32px rgba(0, 0, 0, 0.5)',
    profileDetailsAction: '0 2px 6px rgba(0, 0, 0, 0.3)',
    selectedOption: '0 2px 6px rgba(255, 38, 112, 0.3)',
    selectedWallet: '0 2px 6px rgba(255, 38, 112, 0.3)',
    walletLogo: '0 2px 16px rgba(0, 0, 0, 0.3)',
  },
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  blurs: {
    modalOverlay: 'blur(8px)',
  },
} as Theme);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={customTheme}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}