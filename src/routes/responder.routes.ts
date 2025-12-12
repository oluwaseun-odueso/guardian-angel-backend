import { Router } from 'express';
import ResponderController from '../controllers/responder.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Register as responder
router.post('/register', ResponderController.registerResponder);

// Update responder status
router.put('/status', authorize('responder', 'admin'), ResponderController.updateStatus);

// Update responder location
router.put('/location', authorize('responder', 'admin'), ResponderController.updateLocation);

// Get nearby alerts
router.get('/nearby-alerts', authorize('responder', 'admin'), ResponderController.getNearbyAlerts);

// Get responder stats
router.get('/stats', authorize('admin'), ResponderController.getStats);

// Get all responders
router.get('/', authorize('admin'), ResponderController.getAllResponders);

export default router;