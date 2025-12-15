import { Router } from 'express';
import ResponderController from '../controllers/responder.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/register', ResponderController.registerResponder);

router.put('/status', authorize('responder', 'admin'), ResponderController.updateStatus);

router.put('/location', authorize('responder', 'admin'), ResponderController.updateLocation);

router.get('/nearby-alerts', authorize('responder', 'admin'), ResponderController.getNearbyAlerts);

router.get('/stats', authorize('admin'), ResponderController.getStats);

router.get('/', authorize('admin'), ResponderController.getAllResponders);

export default router;