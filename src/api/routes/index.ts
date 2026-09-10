import { Router } from 'express';
import downloaderRoutes from './downloader.routes.ts';
import adminRoutes from './admin.routes.ts';
import pinterestRoutes from './pinterest.routes.ts';
import pinterestSearchRoutes from './pinterest-search.routes.ts';
import osintRoutes from './osint.routes.ts';

const apiRouter = Router();

apiRouter.use('/admin', adminRoutes);
apiRouter.use('/pinterest', pinterestRoutes);
apiRouter.use('/pinterest', pinterestSearchRoutes);
apiRouter.use('/osint', osintRoutes);
apiRouter.use('/', downloaderRoutes);

export default apiRouter;
