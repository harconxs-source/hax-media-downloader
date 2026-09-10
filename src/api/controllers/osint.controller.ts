import { Request, Response, NextFunction } from 'express';
import { osintService } from '../../services/osint/osint.service.ts';

export class OsintController {
  async profile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platform = String(req.body?.platform || req.query.platform || '').toLowerCase();
      const username = String(req.body?.username || req.query.username || '').trim();
      const timeoutMs = Number(req.body?.timeoutMs || req.query.timeoutMs || 12000);
      if (!platform || !username) { res.status(400).json({ success: false, error: 'platform and username are required' }); return; }
      const data = await osintService.getProfile(platform as any, username, timeoutMs);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const osintController = new OsintController();
