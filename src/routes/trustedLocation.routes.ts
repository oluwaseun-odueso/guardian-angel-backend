import { Router } from 'express';
import TrustedLocationController from '../controllers/location.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router()

router.use(authenticate)

router.post('/', TrustedLocationController.addTrustedLocation)
router.get('/', TrustedLocationController.getTrustedLocations);

// Search addresses for autocomplete
router.get('/search', TrustedLocationController.searchAddresses);

// Check if user is at a trusted location
router.post('/check', TrustedLocationController.checkTrustedLocation);
router.put('/:locationId', TrustedLocationController.updateTrustedLocation);
router.delete('/:locationId', TrustedLocationController.deleteTrustedLocation);

export default router;