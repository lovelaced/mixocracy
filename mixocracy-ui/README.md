# Mixocracy UI

A decentralized DJ voting platform built on Westend Asset Hub.

## Features

- **Live DJ Sets**: DJs can go live and upload tracks for voting
- **Real-time Voting**: Users vote on tracks in real-time
- **Track Management**: DJs can add/remove tracks from their playlists
- **Berlin Techno Aesthetic**: Dark theme with neon accents

## Tech Stack

- Next.js 15.5.2 with App Router
- RainbowKit v2 for Web3 wallet connection
- Wagmi & Ethers.js for blockchain interaction
- Tailwind CSS v4 for styling
- TypeScript for type safety

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Deployment

### Vercel Deployment

```bash
# Deploy preview (staging)
npm run deploy

# Deploy to production
npm run deploy:prod
```

Or using the script directly:

```bash
# Preview deployment
./deploy.sh

# Production deployment
./deploy.sh --prod
```

### Manual Vercel Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to link your project
4. Use `vercel --prod` for production deployments

## Environment Variables

No environment variables are required for basic functionality. The contract addresses and chain configuration are hardcoded.

## Contract Address

Current deployment: `0x42223629303D674AD30338760A6663F9A93484D9`

## Network

Westend Asset Hub (Chain ID: 420420421)

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [RainbowKit Documentation](https://www.rainbowkit.com/docs)
- [Wagmi Documentation](https://wagmi.sh)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)