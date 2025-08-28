import { SPOTIFY_CONFIG } from './spotify-config';

export class SpotifyAuth {
  private static TOKEN_KEY = 'spotify_access_token';
  private static REFRESH_TOKEN_KEY = 'spotify_refresh_token';
  private static EXPIRY_KEY = 'spotify_token_expiry';

  static async authenticate(): Promise<string | null> {
    const verifier = this.generateCodeVerifier(128);
    const challenge = await this.generateCodeChallenge(verifier);
    
    localStorage.setItem('verifier', verifier);

    const params = new URLSearchParams();
    params.append('client_id', SPOTIFY_CONFIG.clientId);
    params.append('response_type', 'code');
    params.append('redirect_uri', SPOTIFY_CONFIG.redirectUri);
    params.append('scope', SPOTIFY_CONFIG.scopes);
    params.append('code_challenge_method', 'S256');
    params.append('code_challenge', challenge);

    // Debug logging
    console.log('Spotify Auth Debug:', {
      clientId: SPOTIFY_CONFIG.clientId,
      redirectUri: SPOTIFY_CONFIG.redirectUri,
      authUrl: `https://accounts.spotify.com/authorize?${params.toString()}`
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    return null;
  }

  static async handleCallback(code: string): Promise<string> {
    const verifier = localStorage.getItem('verifier');
    if (!verifier) throw new Error('No verifier found');

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', SPOTIFY_CONFIG.redirectUri);
    params.append('client_id', SPOTIFY_CONFIG.clientId);
    params.append('code_verifier', verifier);

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    this.storeToken(data.access_token, data.refresh_token, data.expires_in);
    
    localStorage.removeItem('verifier');
    return data.access_token;
  }

  static async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', SPOTIFY_CONFIG.clientId);

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      this.clearTokens();
      return null;
    }

    const data = await response.json();
    this.storeToken(data.access_token, data.refresh_token || refreshToken, data.expires_in);
    return data.access_token;
  }

  static getStoredToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const expiry = localStorage.getItem(this.EXPIRY_KEY);
    
    if (!token || !expiry) return null;
    
    if (Date.now() > parseInt(expiry)) {
      // Try to refresh
      this.refreshAccessToken();
      return null;
    }
    
    return token;
  }

  static isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  static logout(): void {
    this.clearTokens();
  }

  private static storeToken(accessToken: string, refreshToken: string, expiresIn: number) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.EXPIRY_KEY, expiryTime.toString());
  }

  private static clearTokens() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.EXPIRY_KEY);
    localStorage.removeItem('verifier');
  }

  private static generateCodeVerifier(length: number): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}