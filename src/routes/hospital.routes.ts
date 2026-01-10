import { Router } from 'express';
import HospitalController from '../controllers/hospital.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Protected routes
router.get('/', authenticate, HospitalController.fetchAllHospitals); 

export default router;