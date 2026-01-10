import { Response } from 'express';
import LocationUpdateService from '../services/location.update.service'
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class LocationUpdateController {
  
  // Update user location (for regular users)
  static async updateUserLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { coordinates, accuracy, alertId } = req.body;
      
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return ResponseHandler.error(res, 'Valid coordinates [longitude, latitude] required', 400);
      }

      const [lon, lat] = coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number' || 
          isNaN(lon) || isNaN(lat)) {
        return ResponseHandler.error(res, 'Coordinates must be valid numbers', 400);
      }

      const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
      const result = await LocationUpdateService.updateUserLocation({
        userId: req.user._id.toString(),
        coordinates: coordinateTuple,
        accuracy: accuracy || 15,
        alertId,
        isResponder: false,
      });
      
      return ResponseHandler.success(res, result, 'Location updated');
    } catch (error: any) {
      logger.error('Update user location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Update responder location
  // static async updateResponderLocation(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }
      
  //     const { coordinates, accuracy, alertId } = req.body;
      
  //     if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
  //       return ResponseHandler.error(res, 'Valid coordinates [longitude, latitude] required', 400);
  //     }

  //     const [lon, lat] = coordinates;
  //     if (typeof lon !== 'number' || typeof lat !== 'number' || 
  //         isNaN(lon) || isNaN(lat)) {
  //       return ResponseHandler.error(res, 'Coordinates must be valid numbers', 400);
  //     }

  //     const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
  //     // Verify user is a responder
  //     if (req.user.role !== 'respondent') {
  //       return ResponseHandler.error(res, 'Only responders can update responder location', 403);
  //     }
      
  //     const result = await LocationUpdateService.updateResponderLocation({
  //       userId: req.user._id.toString(),
  //       coordinates: coordinateTuple,
  //       accuracy: accuracy || 15,
  //       alertId,
  //     });
      
  //     return ResponseHandler.success(res, result, 'Responder location updated');
  //   } catch (error: any) {
  //     logger.error('Update responder location error:', error);
  //     return ResponseHandler.error(res, error.message, 400);
  //   }
  // }
  
  // Get live tracking data for an alert
  static async getLiveTracking(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { alertId } = req.params;
      
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const trackingData = await LocationUpdateService.getLiveTracking(
        alertId,
        req.user._id.toString()
      );
      
      return ResponseHandler.success(res, trackingData, 'Live tracking data retrieved');
    } catch (error: any) {
      logger.error('Get live tracking error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default LocationUpdateController;