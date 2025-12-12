import { Router } from 'express';
import UserController from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
// import { validate, AuthSchemas } from '../middleware/validation.middleware';

const router = Router();

router.use(authenticate);

// router.get('/profile', UserController.getProfile);
// router.put('/profile', UserController.updateProfile);

router.post('/emergency-contacts', UserController.addEmergencyContact); //✅
router.delete('/emergency-contacts/:contactId', UserController.removeEmergencyContact); //✅
router.put('/settings', UserController.updateSettings); //❌
router.put('/medical-info', UserController.updateMedicalInfo); //❌

// Admin routes
router.get('/', authorize('admin'), UserController.getAllUsers); //✅
router.put('/:userId/role', authorize('admin'), UserController.updateUserRole); //✅
router.put('/:userId/status', authorize('admin'), UserController.updateUserStatus); //✅

export default router;