import { Router } from 'express';
import { pinterestSearchController } from '../controllers/pinterest-search.controller.ts';

const router = Router();

// GET /api/pinterest/search?q=cats&type=i&limit=5
router.get('/search', (req, res, next) => pinterestSearchController.search(req, res, next));

export default router;
