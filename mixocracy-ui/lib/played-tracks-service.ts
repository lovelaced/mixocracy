// Service to handle removing played tracks from the blockchain
export class PlayedTracksService {
  // Remove a song from voting after it has been played
  async removePlayedSong(songId: number, djAddress: string): Promise<boolean> {
    try {
      const response = await fetch('/api/remove-played-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songId, djAddress }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`❌ Failed to remove song ${songId} from blockchain:`, {
          status: response.status,
          error: data.error,
          details: data.details,
          songId,
          djAddress,
          timestamp: new Date().toISOString()
        });
        
        // If hot wallet needs funding, log the address
        if (data.address) {
          console.warn(`💰 Hot wallet needs funding: ${data.address}`);
        }
        
        // If hot wallet is not authorized
        if (data.error === 'Hot wallet not authorized') {
          console.error(`🚫 Hot wallet ${data.hotWalletAddress} must be registered as a DJ`);
        }
        
        return false;
      }
      
      // Check for warnings (like hot wallet not configured)
      if (data.warning) {
        console.warn('Song removal warning:', data.error);
        return true; // Don't break the flow
      }
      
      console.log(`✅ Song ${songId} successfully removed from blockchain`, {
        djAddress,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber
      });
      
      // Emit a custom event that components can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('songRemoved', { 
          detail: { songId, djAddress, transactionHash: data.transactionHash } 
        }));
      }
      
      return true;
    } catch (error) {
      console.error('Error calling remove played song API:', {
        error,
        songId,
        djAddress,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  
  // Queue multiple songs for removal (batch processing)
  private removalQueue: Array<{ songId: number; djAddress: string }> = [];
  private isProcessing = false;
  private processedSongs = new Set<string>(); // Track processed songs to avoid duplicates
  
  queueForRemoval(songId: number, djAddress: string) {
    const key = `${djAddress}-${songId}`;
    
    // Skip if already processed or queued
    if (this.processedSongs.has(key)) {
      console.log(`Song ${songId} already processed for DJ ${djAddress}, skipping`);
      return;
    }
    
    // Check if already in queue
    const alreadyQueued = this.removalQueue.some(
      item => item.songId === songId && item.djAddress === djAddress
    );
    
    if (alreadyQueued) {
      console.log(`Song ${songId} already queued for removal for DJ ${djAddress}, skipping`);
      return;
    }
    
    this.removalQueue.push({ songId, djAddress });
    console.log(`📋 Song ${songId} queued for removal from blockchain (queue size: ${this.removalQueue.length})`);
    this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing || this.removalQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.removalQueue.length > 0) {
      const item = this.removalQueue.shift()!;
      const key = `${item.djAddress}-${item.songId}`;
      
      // Mark as processed before attempting removal
      this.processedSongs.add(key);
      
      await this.removePlayedSong(item.songId, item.djAddress);
      
      // Wait a bit between removals to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.isProcessing = false;
  }
}

export const playedTracksService = new PlayedTracksService();