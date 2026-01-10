import { Response } from 'express';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';
import Hospital from '../models/hospital.model'


export class HospitalController {
  static async fetchAllHospitals(req: AuthRequest, res: Response): Promise<Response> {
    try {
        if (!req.user) {
          return ResponseHandler.error(res, 'User not authenticated', 401);
        }

        const hospitals = await Hospital.find()

        return ResponseHandler.success(res, hospitals, 'Hospitals retrieved');
    } catch (error: any) {
      logger.error('Fetch all hospitals error:', error);
      return ResponseHandler.error(res, 'Failed to fetch hospitals');
    }
  }
}

export default HospitalController;