import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Admin only
router.post('/test/sms', authorize('admin'), NotificationController.testSMS);
router.post('/test/email', authorize('admin'), NotificationController.testEmail);

export default router;