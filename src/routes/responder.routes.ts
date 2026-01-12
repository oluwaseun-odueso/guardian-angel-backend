// routes/responder.routes.ts
import { Router } from 'express';
import ResponderAuthController from '../controllers/responder.auth.controller';
import ResponderController from '../controllers/responder.controller';
// import { authenticate } from '../middlewares/auth.middleware';



import { authenticateResponder } from '../middlewares/responder.auth.middleware'
// import { authenticateUser } from '../middlewares/user.auth.middleware';




const router = Router();

router.use(authenticateResponder);

// Responder registration & profile
router.post('/register', ResponderAuthController.register); //✅
router.get('/profile', ResponderAuthController.getProfile); //✅
router.put('/profile', ResponderAuthController.updateProfile);
router.get('/stats', ResponderAuthController.getStats);
router.post('/deactivate', ResponderAuthController.deactivate);

// Responder status & location
router.post('/status', ResponderAuthController.updateStatus);
router.post('/location', ResponderAuthController.updateLocation);

// Alert management for responders
router.get('/alerts/assigned-alerts', ResponderController.getAssignedAlerts); //✅
router.post('/alerts/acknowledge/:alertId', ResponderController.acknowledgeAlert); //✅
router.post('/alerts/cancel/:alertId', ResponderController.cancelAlert); //✅
router.post('/alerts/resolve/:alertId', ResponderController.resolveAlert);
router.post('/alerts/alert-location', ResponderController.updateAlertLocation);

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