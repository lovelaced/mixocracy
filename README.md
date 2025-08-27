# Mixocracy

A decentralized DJ voting platform where the dancefloor decides what plays next. Built on Westend Asset Hub.

## Project Structure

```
mixocracy/
├── mixocracy-contract/     # Smart contract (Rust/PolkaVM)
└── mixocracy-ui/          # Frontend application (Next.js)
```

## Features

- **Live DJ Sets**: DJs can go live and manage their track queues
- **Real-time Voting**: Users vote on tracks to influence play order
- **Decentralized**: Built on Westend Asset Hub blockchain
- **Berlin Techno Aesthetic**: Dark theme with neon accents

## Quick Start

### Frontend Development

```bash
cd mixocracy-ui
npm install
npm run dev
```

### Contract Development

```bash
cd mixocracy-contract
cargo build --release --target wasm32-unknown-unknown
```

## Deployment

### Deploy Frontend to Vercel

```bash
cd mixocracy-ui
npm run deploy:prod
```

### Deploy Contract

See `mixocracy-contract/README.md` for contract deployment instructions.

## Current Deployment

- **Contract**: `0x42223629303D674AD30338760A6663F9A93484D9`
- **Network**: Westend Asset Hub (Chain ID: 420420421)
- **Frontend**: [Deploy with Vercel]

## Tech Stack

- **Smart Contract**: Rust, PolkaVM, ethabi
- **Frontend**: Next.js 15.5, RainbowKit, Wagmi, Ethers.js
- **Styling**: Tailwind CSS v4
- **Network**: Westend Asset Hub

## License

MIT