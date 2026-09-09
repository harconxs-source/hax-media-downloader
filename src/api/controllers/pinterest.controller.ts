import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.ts';
import { pinterestApiService } from '../../services/pinterest/pinterest-api.service.ts';

export class PinterestController {
  oauthStart(_req: Request, res: Response, next: NextFunction): void {
    try {
      if (!config.pinterest.enabled) {
        res.status(503).json({ success: false, error: 'Pinterest integration is disabled. Set PINTEREST_ENABLED=true.' });
        return;
      }
      res.redirect(pinterestApiService.getAuthorizationUrl());
    } catch (err) { next(err); }
  }

  async oauthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
      if (error) {
        res.status(400).json({ success: false, error, error_description });
        return;
      }
      if (!code || !state || !pinterestApiService.consumeState(state)) {
        res.status(400).json({ success: false, error: 'Invalid or expired Pinterest OAuth state/code.' });
        return;
      }
      const token = await pinterestApiService.exchangeCode(code);
      res.json({
        success: true,
        message: 'Pinterest OAuth completed. Store the returned tokens in Railway Variables, then restart/redeploy the service.',
        token,
        railwayVariables: {
          PINTEREST_ACCESS_TOKEN: token.access_token || '',
          PINTEREST_REFRESH_TOKEN: token.refresh_token || '',
        },
      });
    } catch (err) { next(err); }
  }

  async status(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configured = pinterestApiService.isConfigured();
      const hasAccessToken = Boolean(config.pinterest.accessToken);
      let account: unknown = undefined;
      if (hasAccessToken) account = await pinterestApiService.getUserAccount();
      res.json({ success: true, enabled: config.pinterest.enabled, configured, hasAccessToken, account });
    } catch (err) { next(err); }
  }

  async listPins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pinterestApiService.listPins(undefined, typeof req.query.bookmark === 'string' ? req.query.bookmark : undefined);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const pinterestController = new PinterestController();
