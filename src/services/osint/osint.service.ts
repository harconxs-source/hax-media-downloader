import { Platform } from '../../types/index.ts';

export interface OsintProfile {
  platform: Platform;
  username: string;
  profileUrl: string;
  available: Record<string, unknown>;
}

const SUPPORTED: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'pinterest', 'twitter', 'reddit'];
const TIMEOUT_MS = 12000;

function cleanUsername(value: string): string {
  let v = String(value || '').trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const parts = u.pathname.split('/').filter(Boolean);
      if (u.hostname.includes('reddit.com') && parts[0] && /^(u|user)$/i.test(parts[0])) return parts[1] || '';
      if ((u.hostname.includes('youtube.com')) && parts[0]?.startsWith('@')) return parts[0].slice(1);
      if ((u.hostname.includes('x.com') || u.hostname.includes('twitter.com')) && parts[0]) return parts[0];
      if ((u.hostname.includes('tiktok.com')) && parts[0]?.startsWith('@')) return parts[0].slice(1);
      return parts[0]?.replace(/^@/, '') || '';
    } catch { return ''; }
  }
  return v.replace(/^@/, '').replace(/^\/+|\/+$/g, '').split(/[?#]/)[0];
}

function profileUrl(platform: Platform, username: string): string {
  const u = encodeURIComponent(username);
  switch (platform) {
    case 'youtube': return `https://www.youtube.com/@${u}`;
    case 'instagram': return `https://www.instagram.com/${u}/`;
    case 'tiktok': return `https://www.tiktok.com/@${u}`;
    case 'facebook': return `https://www.facebook.com/${u}`;
    case 'pinterest': return `https://www.pinterest.com/${u}/`;
    case 'twitter': return `https://x.com/${u}`;
    case 'reddit': return `https://www.reddit.com/user/${u}/about.json`;
  }
}

function text(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function meta(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  const m = html.match(re); return m?.[1]?.trim() || undefined;
}

function first(...values: unknown[]): string | undefined {
  return values.find(v => typeof v === 'string' && v.trim()) as string | undefined;
}

function parseCount(source: string, labels: string[]): number | undefined {
  const escaped = labels.join('|');
  const re = new RegExp(`([\\d,.]+\\s*[KMB]?)\\s*(?:${escaped})`, 'i');
  const m = source.match(re); if (!m) return undefined;
  const raw = m[1].replace(/,/g, '').trim().toUpperCase();
  const n = parseFloat(raw); if (!Number.isFinite(n)) return undefined;
  if (raw.endsWith('K')) return Math.round(n * 1e3);
  if (raw.endsWith('M')) return Math.round(n * 1e6);
  if (raw.endsWith('B')) return Math.round(n * 1e9);
  return Math.round(n);
}

async function fetchPublic(url: string, timeoutMs = TIMEOUT_MS): Promise<{ response: Response; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 3000), 30000));
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const body = await response.text();
    return { response, body };
  } finally { clearTimeout(timer); }
}

export class OsintService {
  isSupported(platform: string): platform is Platform { return SUPPORTED.includes(platform as Platform); }

  async getProfile(platform: Platform, input: string, timeoutMs = TIMEOUT_MS): Promise<OsintProfile> {
    if (!this.isSupported(platform)) throw new Error(`Unsupported OSINT platform: ${platform}`);
    const username = cleanUsername(input);
    if (!username || !/^[A-Za-z0-9._+\-]{1,100}$/.test(username)) throw new Error('Invalid username');

    const url = profileUrl(platform, username);
    if (platform === 'reddit') return this.getReddit(username, url, timeoutMs);

    const { response, body } = await fetchPublic(url, timeoutMs);
    const available: Record<string, unknown> = {};
    const ogTitle = first(meta(body, 'og:title'), meta(body, 'twitter:title'));
    const description = first(meta(body, 'og:description'), meta(body, 'description'), meta(body, 'twitter:description'));
    const image = first(meta(body, 'og:image'), meta(body, 'twitter:image'));
    const canonical = first(meta(body, 'og:url')) || response.url || url;
    if (ogTitle) available.displayName = ogTitle;
    if (description) available.bio = description;
    if (image) available.profilePicture = image;
    if (canonical) available.canonicalUrl = canonical;
    if (!response.ok) available.httpStatus = response.status;

    const visible = text(body);
    const followers = parseCount(`${description || ''} ${visible}`, ['followers','follower','subscribers','subscriber']);
    const following = parseCount(`${description || ''} ${visible}`, ['following','following']);
    const posts = parseCount(`${description || ''} ${visible}`, ['posts','post','videos','video','pins','pin']);
    if (followers !== undefined) available.followers = followers;
    if (following !== undefined) available.following = following;
    if (posts !== undefined) available.postsOrVideos = posts;
    available.isPrivate = /\bprivate account\b|\bthis account is private\b/i.test(visible + ' ' + (description || ''));
    available.publicDataOnly = true;
    return { platform, username, profileUrl: url, available };
  }

  private async getReddit(username: string, url: string, timeoutMs: number): Promise<OsintProfile> {
    const { response, body } = await fetchPublic(url, timeoutMs);
    const available: Record<string, unknown> = { publicDataOnly: true };
    try {
      const json = JSON.parse(body);
      const d = json?.data || json;
      const map: Record<string, unknown> = {
        displayName: d?.subreddit?.display_name_prefixed || d?.name,
        bio: d?.subreddit?.public_description || d?.subreddit?.description,
        profilePicture: d?.icon_img || d?.subreddit?.icon_img || d?.subreddit?.community_icon,
        karma: d?.total_karma,
        isGold: d?.is_gold,
        createdAt: typeof d?.created_utc === 'number' ? new Date(d.created_utc * 1000).toISOString() : undefined,
        isSuspended: d?.is_suspended,
      };
      for (const [k,v] of Object.entries(map)) if (v !== undefined && v !== null && v !== '') available[k] = v;
    } catch {
      available.httpStatus = response.status;
    }
    if (!response.ok) available.httpStatus = response.status;
    return { platform: 'reddit', username, profileUrl: url, available };
  }
}

export const osintService = new OsintService();
