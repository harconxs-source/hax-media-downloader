import { Router } from 'express';
import { pinterestController } from '../controllers/pinterest.controller.ts';

const router = Router();

// Start Pinterest OAuth 2.0 Authorization Code flow.
router.get('/oauth', (req, res, next) => pinterestController.oauthStart(req, res, next));
router.get('/oauth/callback', (req, res, next) => pinterestController.oauthCallback(req, res, next));

// Verify the configured token and account access.
router.get('/status', (req, res, next) => pinterestController.status(req, res, next));
router.get('/pins', (req, res, next) => pinterestController.listPins(req, res, next));

export default router;
