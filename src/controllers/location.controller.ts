import { Response } from 'express';
import LocationService from '../services/location.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class LocationController {
  static async updateLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { coordinates, accuracy, batteryLevel, alertId } = req.body;
      
      await LocationService.updateUserLocation({
        userId: req.user._id.toString(),
        coordinates,
        accuracy,
        batteryLevel,
        alertId,
      });

      return ResponseHandler.success(res, null, 'Location updated');
    } catch (error: any) {
      logger.error('Update location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getLocationHistory(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { startDate, endDate, limit } = req.query;
      
      const history = await LocationService.getUserLocationHistory(
        req.user._id.toString(),
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );

      return ResponseHandler.success(res, history, 'Location history retrieved');
    } catch (error: any) {
      logger.error('Get location history error:', error);
      return ResponseHandler.error(res, 'Failed to get location history');
    }
  }

  static async getCurrentLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const user = req.user;
      
      if (!user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      if (!user.lastKnownLocation) {
        return ResponseHandler.notFound(res, 'No location data available');
      }

      return ResponseHandler.success(res, {
        coordinates: user.lastKnownLocation.coordinates,
        accuracy: user.lastKnownLocation.accuracy,
        timestamp: user.lastKnownLocation.timestamp,
      }, 'Current location retrieved');
    } catch (error: any) {
      logger.error('Get current location error:', error);
      return ResponseHandler.error(res, 'Failed to get current location');
    }
  }

  static async addTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { name, coordinates, radius } = req.body;
      
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const user = await (await import('../models/user.model')).default.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            'settings.trustedLocations': {
              name,
              coordinates: {
                type: 'Point',
                coordinates,
              },
              radius: radius || 100,
            },
          },
        },
        { new: true }
      );

      return ResponseHandler.success(res, user, 'Trusted location added');
    } catch (error: any) {
      logger.error('Add trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async removeTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { locationId } = req.params;
      
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const user = await (await import('../models/user.model')).default.findByIdAndUpdate(
        req.user._id,
        {
          $pull: {
            'settings.trustedLocations': { _id: locationId },
          },
        },
        { new: true }
      );

      return ResponseHandler.success(res, user, 'Trusted location removed');
    } catch (error: any) {
      logger.error('Remove trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default LocationController;