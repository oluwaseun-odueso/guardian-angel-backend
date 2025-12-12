import express from 'express'
import authRoutes from './auth.routes';
import alertRoutes from './alert.routes';
import adminRoutes from './user.routes'

const router = express.Router();


router.use('/auth', authRoutes)
router.use('/user', adminRoutes);
router.use('/alert', alertRoutes);

// router.get('/health', (_req, res) => {
//   res.json({
//     success: true,
//     message: 'guardian-angel-backend is running',
//     timestamp: new Date().toISOString()
//   });
// });

export default router;