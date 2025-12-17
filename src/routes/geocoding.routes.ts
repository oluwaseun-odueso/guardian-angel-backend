import { Router } from 'express';
import GeocodingController from '../controllers/geocoding.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', GeocodingController.geocodeAddress); //✅

router.post('/reverse-geocode', GeocodingController.reverseGeocode); //✅

router.post('/distance', GeocodingController.calculateDistance); //✅

router.post('/route', GeocodingController.getRoute); //✅

router.get('/nearby-places', GeocodingController.getNearbyPlaces); //✅

router.get('/static-map', GeocodingController.getStaticMap); //✅

export default router;