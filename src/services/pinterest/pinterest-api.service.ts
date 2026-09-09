import crypto from 'node:crypto';
import { config } from '../../config/index.ts';

interface OAuthState { value: string; expiresAt: number; }

export interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  response_type?: string;
  [key: string]: unknown;
}

class PinterestApiService {
  private oauthStates = new Map<string, OAuthState>();

  isConfigured(): boolean {
    return Boolean(config.pinterest.enabled && config.pinterest.clientId && config.pinterest.clientSecret && config.pinterest.redirectUri);
  }

  getAuthorizationUrl(): string {
    if (!this.isConfigured()) throw new Error('Pinterest OAuth is not configured. Set PINTEREST_ENABLED, PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET and PINTEREST_REDIRECT_URI.');
    const state = crypto.randomBytes(24).toString('hex');
    this.oauthStates.set(state, { value: state, expiresAt: Date.now() + 10 * 60 * 1000 });
    const url = new URL(config.pinterest.oauthBaseUrl);
    url.searchParams.set('client_id', config.pinterest.clientId);
    url.searchParams.set('redirect_uri', config.pinterest.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.pinterest.scopes.join(','));
    url.searchParams.set('state', state);
    return url.toString();
  }

  consumeState(state: string): boolean {
    const entry = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    return Boolean(entry && entry.expiresAt > Date.now() && entry.value === state);
  }

  async exchangeCode(code: string): Promise<PinterestTokenResponse> {
    const credentials = Buffer.from(`${config.pinterest.clientId}:${config.pinterest.clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.pinterest.redirectUri,
        continuous_refresh: 'true',
      });
      const response = await fetch(`${config.pinterest.apiBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Pinterest OAuth token exchange failed (${response.status}): ${JSON.stringify(data)}`);
      }
      return data as PinterestTokenResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  async getUserAccount(accessToken = config.pinterest.accessToken): Promise<unknown> {
    if (!accessToken) throw new Error('No Pinterest access token configured.');
    return this.apiRequest('/user_account', accessToken);
  }

  async listPins(accessToken = config.pinterest.accessToken, bookmark?: string): Promise<unknown> {
    if (!accessToken) throw new Error('No Pinterest access token configured.');
    const path = bookmark ? `/pins?bookmark=${encodeURIComponent(bookmark)}` : '/pins';
    return this.apiRequest(path, accessToken);
  }

  private async apiRequest(path: string, accessToken: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const response = await fetch(`${config.pinterest.apiBaseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Pinterest API request failed (${response.status}): ${JSON.stringify(data)}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const pinterestApiService = new PinterestApiService();
