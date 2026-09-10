import { Request, Response, NextFunction } from 'express';
import { pinterestSearchService } from '../../services/pinterest-search/pinterest-search.service.ts';

export class PinterestSearchController {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = String(req.query.q || req.query.query || '').trim();
      const type = String(req.query.type || 'i').toLowerCase() === 's' ? 's' : 'i';
      const rawLimit = Number(req.query.limit || 3);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 25) : 3;

      if (!query) {
        res.status(400).json({ success: false, error: 'Query is required', code: 'VALIDATION_ERROR' });
        return;
      }

      const results = await pinterestSearchService.search(query, type, limit);
      res.json({ success: true, count: results.length, type, query, results });
    } catch (err) {
      next(err);
    }
  }
}

export const pinterestSearchController = new PinterestSearchController();
