export function truncateError(error: unknown, maxLength: number = 100): string {
  let message = 'An error occurred';
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
  }
  
  // Extract meaningful error from common blockchain error patterns
  const patterns = [
    /execution reverted: "?([^"]+)"?/i,  // Contract revert messages
    /reason="([^"]+)"/,                   // Ethers reason field
    /message":"([^"]+)"/,                 // JSON RPC errors
    /error={"([^"]+)"/,                   // Nested error objects
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      message = match[1];
      break;
    }
  }
  
  // Remove common prefixes
  message = message
    .replace(/^Error: /, '')
    .replace(/^Transaction reverted: /, '')
    .replace(/^execution reverted: /, '');
  
  // Truncate if too long
  if (message.length > maxLength) {
    return message.substring(0, maxLength - 3) + '...';
  }
  
  return message;
}

export function parseSongData(songName: string): { displayName: string; spotifyUri?: string } {
  // Check if the song has a Spotify URI appended with |
  const parts = songName.split('|');
  if (parts.length === 2 && parts[1].startsWith('spotify:track:')) {
    return {
      displayName: parts[0],
      spotifyUri: parts[1]
    };
  }
  
  // Legacy format or no Spotify URI
  return {
    displayName: songName,
    spotifyUri: undefined
  };
}