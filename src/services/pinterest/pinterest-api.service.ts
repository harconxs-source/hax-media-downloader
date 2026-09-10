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

  extractPinId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/pin\/(\d+)/i);
      return match?.[1] || null;
    } catch {
      return null;
    }
  }

  async getPin(pinId: string, accessToken = config.pinterest.accessToken): Promise<any> {
    if (!accessToken) throw new Error('No Pinterest access token configured.');
    if (!/^\d+$/.test(pinId)) throw new Error('Invalid Pinterest Pin ID.');
    return this.apiRequest(`/pins/${encodeURIComponent(pinId)}`, accessToken);
  }

  async resolvePinMedia(url: string): Promise<{ pin: any; mediaUrl: string; thumbnail?: string; isVideo: boolean }> {
    const pinId = this.extractPinId(url);
    if (!pinId) throw new Error('Pinterest Official API requires a numeric /pin/<id> URL.');
    if (!config.pinterest.accessToken) throw new Error('No Pinterest access token configured.');

    const pin = await this.getPin(pinId);
    const media = pin?.media || {};
    const mediaType = String(media.media_type || '').toLowerCase();

    if (mediaType === 'video') {
      const videos = media.videos || {};
      const candidates = Object.values(videos) as any[];
      const video = candidates
        .filter((v) => v && typeof v.url === 'string')
        .sort((a, b) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)))[0];
      const videoUrl = pin.video_url || video?.url;
      if (videoUrl) {
        return {
          pin,
          mediaUrl: videoUrl,
          thumbnail: pin.image_signature ? undefined : this.extractImageUrl(media),
          isVideo: true,
        };
      }
      throw new Error('Pinterest API did not return an accessible video URL. pins:read is required and Pinterest may restrict video_url access.');
    }

    const imageUrl = this.extractImageUrl(media);
    if (!imageUrl) throw new Error('Pinterest API did not return an accessible image URL.');
    return { pin, mediaUrl: imageUrl, thumbnail: imageUrl, isVideo: false };
  }

  private extractImageUrl(media: any): string | undefined {
    const images = media?.images || {};
    const candidates = Object.values(images) as any[];
    const valid = candidates
      .filter((v) => v && typeof v.url === 'string')
      .sort((a, b) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)));
    return valid[0]?.url;
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

  async refreshAccessToken(): Promise<PinterestTokenResponse> {
    if (!config.pinterest.refreshToken) throw new Error('No Pinterest refresh token configured.');
    const credentials = Buffer.from(`${config.pinterest.clientId}:${config.pinterest.clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.pinterest.timeoutMs);
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.pinterest.refreshToken,
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
      if (!response.ok) throw new Error(`Pinterest token refresh failed (${response.status}): ${JSON.stringify(data)}`);
      const token = data as PinterestTokenResponse;
      if (token.access_token) config.pinterest.accessToken = token.access_token;
      if (token.refresh_token) config.pinterest.refreshToken = token.refresh_token;
      return token;
    } finally {
      clearTimeout(timer);
    }
  }

  private async apiRequest(path: string, accessToken: string, allowRefresh = true): Promise<unknown> {
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

      if (response.status === 401 && allowRefresh && config.pinterest.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed.access_token) return this.apiRequest(path, refreshed.access_token, false);
      }

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
