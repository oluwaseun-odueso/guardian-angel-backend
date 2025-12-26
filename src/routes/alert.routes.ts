import { Router } from 'express';
import AlertController from '../controllers/alert.controller';
import { authenticate } from '../middlewares/auth.middleware';
// import { validate, AlertSchemas } from '../middlewares/validation.middleware';

const router = Router();

// All alert routes require authentication
router.use(authenticate);

router.post('/manual', AlertController.createManualAlert); //✅
router.post('/panic', AlertController.createPanicAlert); //✅

// Alert management
router.get('/available-responders', AlertController.getAvailableResponders); //✅
router.get('/user-alerts', AlertController.getUserAlerts); //✅
router.get('/tracking/:alertId', AlertController.getLiveTracking);

// Location updates
router.post('/location', AlertController.updateUserLocation);


// User routes
// router.post('/', validate(AlertSchemas.createAlert), AlertController.createAlert);
// router.get('/my-alerts', AlertController.getUserAlerts);
// router.get('/:alertId', AlertController.getAlertDetails);
// router.put('/:alertId/status', AlertController.updateAlertStatus);
// router.post('/:alertId/messages', AlertController.addMessageToAlert);

// // Responder and Admin routes
// router.get('/', authorize('responder', 'admin'), AlertController.getActiveAlerts);

export default router;