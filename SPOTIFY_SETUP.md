# Spotify Integration Setup Guide

This guide explains how to set up Spotify integration for the Mixocracy platform.

## Prerequisites

- Spotify Developer Account
- Spotify Premium (required for Web Playback SDK)
- Node.js 18+

## Setup Steps

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in the app details:
   - App name: `Mixocracy`
   - App description: `DJ voting platform with Spotify integration`
   - Redirect URIs: 
     - Development: `http://localhost:3000/spotify-callback`
     - Production: `https://your-domain.vercel.app/spotify-callback`
   - Select "Web API" and "Web Playback SDK"
4. Save the app

### 2. Get Your Credentials

From your Spotify app dashboard:
- Copy the `Client ID`
- Copy the `Client Secret`

### 3. Configure Environment Variables

Update `.env.local` with your Spotify credentials:

```env
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://localhost:3000/spotify-callback
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

For production deployment on Vercel:
- Add these environment variables in your Vercel project settings
- Update the redirect URI to match your production domain

### 4. Install Dependencies

The Spotify Web Playback SDK types are already installed. No additional packages needed.

## Features

### For DJs

1. **Spotify Player Integration**
   - Connect Spotify Premium account
   - Automatically searches for Spotify versions of voted tracks
   - Plays tracks in order of votes (highest first)
   - Skip functionality
   - Play/pause controls
   - Queue visualization

2. **How to Use**
   - Go to BOOTH tab
   - Click "Connect Spotify" if not connected
   - Start your DJ set (go live)
   - Click "Start Playing" to begin playback
   - Tracks will play in voted order automatically

### For Users

1. **Song Suggestions** (Coming Soon)
   - Search Spotify catalog
   - Suggest specific tracks to DJs
   - Vote on suggested tracks

## Technical Details

### Authentication Flow

We use the Spotify Authorization Code with PKCE flow:
1. User clicks "Connect Spotify"
2. Redirected to Spotify authorization
3. Spotify redirects back to `/spotify-callback`
4. Exchange code for access token
5. Store tokens securely in localStorage

### Web Playback SDK

The SDK requires:
- Spotify Premium account
- Modern browser (Chrome 86+, Firefox 80+, Safari 14.1+)
- HTTPS in production

### API Integration

- Search API: For finding tracks
- Web API: For playback control
- Web Playback SDK: For in-browser playback

## Troubleshooting

### "Player not ready"
- Ensure Spotify is open on any device
- Click "Transfer Playback Here"

### "Premium required"
- Web Playback SDK requires Spotify Premium
- Free accounts can still search and suggest songs

### "No tracks found"
- Tracks are searched by exact name match
- Consider adding manual track selection in the future

### "Authentication failed"
- Check your environment variables
- Ensure redirect URI matches exactly
- Try logging out and back in

## Security Notes

- Never expose `SPOTIFY_CLIENT_SECRET` to the frontend
- Use server-side API routes for token exchange
- Tokens are stored in localStorage with expiry checks
- Automatic token refresh is implemented

## Future Enhancements

1. **Playlist Integration**
   - Import entire Spotify playlists
   - Save voted sets as playlists

2. **Advanced Search**
   - Search by artist, album, genre
   - Audio features matching (BPM, key, energy)

3. **Social Features**
   - Show who suggested tracks
   - DJ following system

4. **Analytics**
   - Track play statistics
   - Popular songs dashboard

## Development

To test locally:
```bash
npm run dev
```

Visit http://localhost:3000 and test the Spotify integration.

## Production Deployment

1. Add environment variables to Vercel
2. Update redirect URI in Spotify app settings
3. Deploy to Vercel
4. Test with production URL

## Support

For issues related to:
- Spotify API: Check [Spotify Developer Documentation](https://developer.spotify.com/documentation/web-api)
- Web Playback SDK: See [SDK Reference](https://developer.spotify.com/documentation/web-playback-sdk)
- Integration issues: Open an issue in the repository