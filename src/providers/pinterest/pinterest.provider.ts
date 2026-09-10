import { BaseProvider } from '../base/base.provider.ts';
import { Platform, DownloadOptions, MediaInfo, NormalizedDownloadResult, ProviderHealth } from '../../types/index.ts';
import { config } from '../../config/index.ts';
import { detectPlatform } from '../../utils/platform-detector.ts';
import { DownloaderError } from '../../utils/errors.ts';
import { pinterestApiService } from '../../services/pinterest/pinterest-api.service.ts';

/**
 * Official Pinterest API provider.
 *
 * This is deliberately a LAST-RESORT provider for Pinterest URLs. It can only
 * resolve numeric /pin/<id> URLs that the authorized Pinterest token can read.
 * Public/arbitrary Pinterest URLs should normally be handled by Cobalt/GenCipta.
 */
export class PinterestProvider extends BaseProvider {
  readonly name = 'pinterest-api';
  readonly supportedPlatforms: Platform[] = ['pinterest'];

  isSupported(url: string): boolean {
    return Boolean(
      config.pinterest.enabled &&
      config.pinterest.downloadFallbackEnabled &&
      config.pinterest.accessToken &&
      pinterestApiService.extractPinId(url) &&
      super.isSupported(url)
    );
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!config.pinterest.enabled || !config.pinterest.downloadFallbackEnabled) {
      return { provider: this.name, available: false, statusMessage: 'Pinterest official API fallback is disabled' };
    }
    if (!config.pinterest.accessToken) {
      return { provider: this.name, available: false, statusMessage: 'Pinterest API enabled but no access token is configured' };
    }
    if (!pinterestApiService.extractPinId('https://www.pinterest.com/pin/123456789/')) {
      return { provider: this.name, available: false, statusMessage: 'Pinterest Pin URL parser unavailable' };
    }
    return { provider: this.name, available: true, statusMessage: 'Pinterest official API fallback configured' };
  }

  async getInfo(url: string, _options?: DownloadOptions): Promise<MediaInfo> {
    const platform = detectPlatform(url);
    if (platform !== 'pinterest') throw DownloaderError.unsupportedPlatform(`Unsupported platform for Pinterest API: ${url}`);
    try {
      const resolved = await pinterestApiService.resolvePinMedia(url);
      const pin = resolved.pin || {};
      return {
        id: pin.id || Buffer.from(url).toString('base64').slice(0, 16),
        title: pin.title || pin.description || 'Pinterest Pin',
        thumbnail: resolved.thumbnail,
        duration: resolved.isVideo ? Number(pin.media?.videos?.duration || 0) : 0,
        author: pin.board_owner?.username || pin.pinner?.username,
        uploader: pin.board_owner?.username || pin.pinner?.username,
        platform: 'pinterest',
        availableQualities: resolved.isVideo ? ['best'] : ['original'],
        availableFormats: [resolved.isVideo ? 'mp4' : 'jpg'],
        url: resolved.mediaUrl,
        webpageUrl: url,
        originalUrl: url,
      };
    } catch (err: unknown) {
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`Pinterest Official API failed: ${(err as Error).message}`);
    }
  }

  async download(url: string, options?: DownloadOptions): Promise<NormalizedDownloadResult> {
    const platform = detectPlatform(url);
    if (platform !== 'pinterest') throw DownloaderError.unsupportedPlatform(`Unsupported platform for Pinterest API: ${url}`);
    try {
      const resolved = await pinterestApiService.resolvePinMedia(url);
      const pin = resolved.pin || {};
      const isAudio = options?.type === 'audio';
      if (isAudio) throw DownloaderError.providerFailed('Pinterest Official API does not provide an audio conversion path.');

      const format = resolved.isVideo ? 'mp4' : 'jpg';
      return {
        success: true,
        platform: 'pinterest',
        provider: this.name,
        title: pin.title || pin.description || 'Pinterest Pin',
        thumbnail: resolved.thumbnail,
        duration: 0,
        format,
        quality: options?.quality || (resolved.isVideo ? 'best' : 'original'),
        url: resolved.mediaUrl,
        downloadUrl: resolved.mediaUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        jobId: (options?.jobId as string) || '',
        metadata: {
          pinterestPinId: pin.id,
          source: 'official-pinterest-api',
          mediaType: resolved.isVideo ? 'video' : 'image',
        },
      };
    } catch (err: unknown) {
      if (err instanceof DownloaderError) throw err;
      throw DownloaderError.providerFailed(`Pinterest Official API download failed: ${(err as Error).message}`);
    }
  }
}
