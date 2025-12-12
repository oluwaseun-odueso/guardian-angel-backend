import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, AuthSchemas } from '../middlewares/validation.middleware';

const router = Router();

router.post('/signup', validate(AuthSchemas.register), AuthController.register); //✅
router.post('/login', validate(AuthSchemas.login), AuthController.login); //✅
router.post('/refresh-token', AuthController.refreshToken); //✅

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile); //✅
router.put('/profile', authenticate, AuthController.updateProfile); //✅
router.post('/logout', authenticate, AuthController.logout); //✅

export default router;