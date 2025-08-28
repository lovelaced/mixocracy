export const SPOTIFY_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
  redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!,
  scopes: [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
  ].join(' ')
};