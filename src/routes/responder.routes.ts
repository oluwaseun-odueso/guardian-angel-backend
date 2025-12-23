// routes/responder.routes.ts
import { Router } from 'express';
import ResponderAuthController from '../controllers/responder.auth.controller';
import ResponderController from '../controllers/responder.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Responder registration & profile
router.post('/register', ResponderAuthController.register);
router.get('/profile', ResponderAuthController.getProfile);
router.put('/profile', ResponderAuthController.updateProfile);
router.get('/stats', ResponderAuthController.getStats);
router.post('/deactivate', ResponderAuthController.deactivate);

// Responder status & location
router.post('/status', ResponderAuthController.updateStatus);
router.post('/location', ResponderAuthController.updateLocation);

// Alert management for responders
router.get('/assigned-alerts', ResponderController.getAssignedAlerts);
router.post('/acknowledge/:alertId', ResponderController.acknowledgeAlert);
router.post('/cancel/:alertId', ResponderController.cancelAlert);
router.post('/resolve/:alertId', ResponderController.resolveAlert);
router.post('/alert-location', ResponderController.updateAlertLocation);

export default router;





// import { Router } from 'express';
// import ResponderController from '../controllers/responder.controller';
// import { authenticate, authorize } from '../middlewares/auth.middleware';

// const router = Router();

// router.use(authenticate);

// router.post('/register', ResponderController.registerResponder);

// router.put('/status', authorize('responder', 'admin'), ResponderController.updateStatus);

// router.put('/location', authorize('responder', 'admin'), ResponderController.updateLocation);

// router.get('/nearby-alerts', authorize('responder', 'admin'), ResponderController.getNearbyAlerts);

// router.get('/stats', authorize('admin'), ResponderController.getStats);

// router.get('/', authorize('admin'), ResponderController.getAllResponders);

// export default router;