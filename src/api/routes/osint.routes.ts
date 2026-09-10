import { Router } from 'express';
import { osintController } from '../controllers/osint.controller.ts';
import { optionalUserAuthMiddleware } from '../../middleware/auth.middleware.ts';
import { downloadRateLimiter } from '../../middleware/rate-limit.middleware.ts';

const router = Router();
router.post('/profile', optionalUserAuthMiddleware, downloadRateLimiter, (req, res, next) => osintController.profile(req, res, next));
router.get('/profile', optionalUserAuthMiddleware, downloadRateLimiter, (req, res, next) => osintController.profile(req, res, next));
export default router;
