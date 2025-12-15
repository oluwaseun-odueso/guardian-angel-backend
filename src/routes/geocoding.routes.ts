import { Router } from 'express';
import GeocodingController from '../controllers/geocoding.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', GeocodingController.geocodeAddress);

router.post('/reverse-geocode', GeocodingController.reverseGeocode);

// Calculate distance between two points
router.post('/distance', GeocodingController.calculateDistance);

// Get route between two points
router.post('/route', GeocodingController.getRoute);

// Get nearby places (hospitals, police stations, etc.)
router.get('/nearby-places', GeocodingController.getNearbyPlaces);

// Get static map image URL
router.get('/static-map', GeocodingController.getStaticMap);

export default router;