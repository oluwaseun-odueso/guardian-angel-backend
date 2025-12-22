import { Router } from 'express';
import LocationUpdateController from '../controllers/location.update.controller';
import LocationController from '../controllers/location.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, LocationSchemas } from '../middlewares/validation.middleware';

const router = Router();

router.use(authenticate);

// Update user location
router.post('/update', validate(LocationSchemas.updateLocation), LocationController.updateLocation);

// Get location history
router.get('/history', LocationController.getLocationHistory);

// Get current location
router.get('/current', LocationController.getCurrentLocation);

// Add trusted location
router.post('/trusted-locations', LocationController.addTrustedLocation);

// Remove trusted location
router.delete('/trusted-locations/:locationId', LocationController.removeTrustedLocation);



// Location update endpoints
router.post('/user', LocationUpdateController.updateUserLocation);
router.post('/responder', LocationUpdateController.updateResponderLocation);
router.get('/tracking/:alertId', LocationUpdateController.getLiveTracking);
export default router;