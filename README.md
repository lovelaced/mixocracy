# Mixocracy

A decentralized DJ voting platform where the dancefloor decides what plays next. Built on Westend Asset Hub using PolkaVM smart contracts.

## Overview

Mixocracy is a Web3 application that enables real-time crowd-sourced DJ sets. DJs can go live, upload their tracklists, and let the audience vote on what plays next. The platform features a Berlin techno aesthetic with a dark theme and neon accents.

**New in v2**: Spotify integration allows DJs to automatically play tracks in voted order using the Web Playback SDK.

## Project Structure

```
mixocracy/
├── mixocracy-contract/     # PolkaVM smart contract (Rust)
│   ├── src/
│   │   └── lib.rs         # Contract implementation
│   ├── build.sh           # Build script for PolkaVM compilation
│   ├── deploy.js          # Contract deployment script
│   └── Cargo.toml         # Rust dependencies
└── mixocracy-ui/          # Frontend application (Next.js)
    ├── app/               # Next.js app router pages
    ├── components/        # React components
    ├── hooks/             # Custom React hooks
    ├── lib/               # Utilities and configuration
    └── deploy.sh          # Vercel deployment script
```

## Smart Contract Development

### Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- Node.js 18+ for deployment scripts
- PolkaVM compiler (`polkatool`)

### Custom PolkaVM Toolchain

The contract uses a custom build process for PolkaVM:

1. **Compilation**: Rust → WASM → PolkaVM bytecode
2. **No standard library**: Uses `#![no_std]` and `#![no_main]`
3. **Custom allocator**: SimpleAlloc with 50KB heap
4. **Manual ABI encoding**: Uses `ethabi` for Ethereum-compatible interface

### Building the Contract

```bash
cd mixocracy-contract

# Run the build script
./build.sh

# Or manually:
cargo build --release --target wasm32-unknown-unknown
polkatool compile -s -o mixocracy.polkavm target/wasm32-unknown-unknown/release/mixocracy.wasm
```

The build script handles:
- WASM compilation with proper flags
- PolkaVM bytecode generation
- Build artifact organization

### Contract Architecture

- **Storage**: Key-value pairs with manual serialization
- **Entry Points**: `deploy()` and `call()` functions
- **Function Dispatch**: Manual selector matching
- **Gas Optimization**: Efficient storage patterns with prefixes

### Key Contract Features

- **DJ Management**: Register/remove DJs, track active sets
- **Song Management**: Add/remove tracks, track voting
- **Voting System**: One vote per user per song
- **Set Management**: Start/stop live sets
- **Storage Prefixes**: Organized data structure for efficient queries

### Deployment

```bash
cd mixocracy-contract
npm install
node deploy.js
```

Current deployment: `0x42223629303D674AD30338760A6663F9A93484D9`

## Frontend Development

### Tech Stack

- **Framework**: Next.js 15.5.2 with App Router
- **Web3**: RainbowKit v2 + Wagmi + Ethers.js v6
- **Styling**: Tailwind CSS v4 (new architecture)
- **Language**: TypeScript

### Development Setup

```bash
cd mixocracy-ui
npm install
npm run dev
```

### Spotify Integration Setup

For Spotify features, see [SPOTIFY_SETUP.md](SPOTIFY_SETUP.md). Key requirements:
- Spotify Developer App with Client ID and Secret
- Spotify Premium account (for Web Playback SDK)
- Environment variables configured in `.env.local`

### Key Features

- **Wallet Integration**: RainbowKit with custom theming
- **Real-time Updates**: Polling for live data
- **Responsive Design**: Mobile-first approach
- **Custom Hook**: `useMixocracyContract` for contract interaction
- **Direct Contract Calls**: Using function selectors without ABI
- **Spotify Integration**: 
  - Web Playback SDK for in-browser playback
  - Automatic track search and queuing
  - Play tracks in voted order
  - Full playback controls for DJs

### Contract Integration

The frontend interacts with the contract using:
- Manual function selectors (computed via `ethers.keccak256`)
- Direct encoding/decoding with ethers.js
- Custom hook for all contract methods

### Deployment

```bash
cd mixocracy-ui

# Preview deployment
npm run deploy

# Production deployment
npm run deploy:prod
```

## Network Configuration

- **Network**: Westend Asset Hub
- **Chain ID**: 420420421 (0x190f1b45)
- **RPC**: https://westend-asset-hub-eth-rpc.polkadot.io
- **Block Explorer**: https://blockscout-asset-hub.parity-chains-scw.parity.io

## Development Gotchas

### PolkaVM Constraints

1. **No Panic Handler**: Custom panic handler required
2. **Limited Std**: Many Rust standard library features unavailable
3. **Manual Memory**: Careful management with SimpleAlloc
4. **Gas Limits**: Optimize storage access patterns

### Contract Best Practices

1. **Storage Prefixes**: Use consistent prefix patterns
2. **Batch Operations**: Minimize storage reads/writes
3. **Error Handling**: Use assertions with descriptive messages
4. **Event Emission**: Not supported - use view functions

### Frontend Considerations

1. **Chain Configuration**: Custom chain requires manual setup
2. **Gas Estimation**: May need manual gas limits
3. **Error Handling**: Contract reverts need proper decoding
4. **State Sync**: Poll for updates (no events)

## Testing

### Contract Testing

Currently manual testing via deployment and frontend interaction. Unit tests can be added using:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    // Test implementation
}
```

### Frontend Testing

```bash
cd mixocracy-ui
npm test  # (tests to be implemented)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Security Considerations

- Contract owner privileges (DJ management)
- No upgradability - immutable contract
- Input validation on all user inputs
- Access control for DJ functions

## License

MIT

## Resources

- [PolkaVM Documentation](https://github.com/koute/polkavm)
- [Westend Asset Hub](https://wiki.polkadot.network/docs/learn-assets)
- [RainbowKit Docs](https://www.rainbowkit.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)