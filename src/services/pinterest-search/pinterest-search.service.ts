import { SearchResultItem } from '../../types/index.ts';

const SEARCH_BASE_URL = 'https://www.pinterest.com/search/pins/';
const REQUEST_TIMEOUT_MS = 15000;

function decodePinterestUrl(value: string): string {
  return value
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u003D/g, '=')
    .replace(/&amp;/g, '&')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003F/g, '?');
}

function normalizeImageUrl(value: string): string | null {
  const decoded = decodePinterestUrl(value).trim();
  if (!/^https?:\/\//i.test(decoded)) return null;
  if (!/(?:pinimg\.com|pinterest\.com)/i.test(decoded)) return null;
  if (!/\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(decoded) && !/pinimg\.com/i.test(decoded)) return null;
  return decoded.replace(/\\u0026/g, '&');
}

function collectUrls(html: string): string[] {
  const candidates = new Set<string>();
  const normalizedHtml = html
    .replace(/\\\//g, '/')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u003A/gi, ':')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u0026/gi, '&');

  // Pinterest embeds Pin media URLs in its server-rendered JSON. The URLs
  // may be plain https://... or JSON-escaped as https:\/\/....
  const urlPattern = /https?:\/\/[^"'\\\s<>]+/gi;
  for (const match of normalizedHtml.matchAll(urlPattern)) {
    const value = normalizeImageUrl(match[0]);
    if (value) candidates.add(value);
  }

  return [...candidates];
}

export class PinterestSearchService {
  async search(query: string, type: 'i' | 's' = 'i', limit = 3): Promise<SearchResultItem[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) throw new Error('Pinterest search query cannot be empty');

    const finalQuery = type === 's' ? `${cleanQuery} sticker` : cleanQuery;
    const url = `${SEARCH_BASE_URL}?q=${encodeURIComponent(finalQuery)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`Pinterest search returned HTTP ${response.status}`);
      }

      const html = await response.text();
      const urls = collectUrls(html);
      const unique = [...new Set(urls)].slice(0, Math.min(Math.max(limit, 1), 25));

      if (!unique.length) {
        throw new Error('Pinterest returned no public search images');
      }

      return unique.map((imageUrl, index) => ({
        id: `pinterest-search-${index + 1}`,
        title: cleanQuery,
        url: imageUrl,
        webpageUrl: url,
        thumbnail: imageUrl,
        platform: 'pinterest',
        author: 'Pinterest',
      }));
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Pinterest search timed out');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const pinterestSearchService = new PinterestSearchService();
