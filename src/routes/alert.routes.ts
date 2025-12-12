import { Router } from 'express';
import AlertController from '../controllers/alert.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate, AlertSchemas } from '../middlewares/validation.middleware';

const router = Router();

// All alert routes require authentication
router.use(authenticate);

// User routes
router.post('/', validate(AlertSchemas.createAlert), AlertController.createAlert);
router.get('/my-alerts', AlertController.getUserAlerts);
router.get('/:alertId', AlertController.getAlertDetails);
router.put('/:alertId/status', AlertController.updateAlertStatus);
router.post('/:alertId/messages', AlertController.addMessageToAlert);

// Responder and Admin routes
router.get('/', authorize('responder', 'admin'), AlertController.getActiveAlerts);

export default router;