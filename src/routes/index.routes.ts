import express from 'express'
import authRoutes from './auth.routes';
import alertRoutes from './alert.routes';
import adminRoutes from './user.routes';
import responderRoutes from './responder.routes';
import geocodingRoutes from './geocoding.routes';
import locationRoutes from './location.routes';
import trustedRoutes from './trustedLocation.routes';

const router = express.Router();

router.use('/auth', authRoutes)
router.use('/user', adminRoutes);
router.use('/alert', alertRoutes);
router.use('/responder', responderRoutes)
router.use('/geocode', geocodingRoutes)
router.use('/location', locationRoutes)
router.use('/trusted-location', trustedRoutes)

export default router;