import { Router } from 'express';
import downloaderRoutes from './downloader.routes.ts';
import adminRoutes from './admin.routes.ts';
import pinterestRoutes from './pinterest.routes.ts';

const apiRouter = Router();

apiRouter.use('/admin', adminRoutes);
apiRouter.use('/pinterest', pinterestRoutes);
apiRouter.use('/', downloaderRoutes);

export default apiRouter;
