import { Response } from 'express';
import ResponderService from '../services/responder.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ResponderController {
  static async registerResponder(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      // Update user role first
      const User = await import('../models/user.model');
      await User.default.findByIdAndUpdate(req.user._id, { role: 'responder' });
      
      const responder = await ResponderService.registerResponder(req.user._id.toString());
      return ResponseHandler.success(res, responder, 'Registered as responder');
    } catch (error: any) {
      logger.error('Register responder error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async updateStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { status } = req.body;
      
      if (!['available', 'busy', 'offline'].includes(status)) {
        return ResponseHandler.error(res, 'Invalid status', 400);
      }

      const responder = await ResponderService.updateResponderStatus(
        req.user._id.toString(),
        status
      );

      return ResponseHandler.success(res, responder, 'Status updated');
    } catch (error: any) {
      logger.error('Update responder status error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async updateLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { coordinates, accuracy } = req.body;
      
      const responder = await ResponderService.updateResponderLocation(
        req.user._id.toString(),
        coordinates,
        accuracy
      );

      return ResponseHandler.success(res, responder, 'Location updated');
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getNearbyAlerts(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { lat, lng, radius = 5 } = req.query;
      
      if (!lat || !lng) {
        return ResponseHandler.error(res, 'Latitude and longitude required', 400);
      }

      const Alert = await import('../models/alert.model');
      const alerts = await Alert.default.find({
        status: 'active',
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
            },
            $maxDistance: parseFloat(radius as string) * 1000,
          },
        },
      })
      .populate('userId', 'firstName lastName phone')
      .limit(20);

      return ResponseHandler.success(res, alerts, 'Nearby alerts retrieved');
    } catch (error: any) {
      logger.error('Get nearby alerts error:', error);
      return ResponseHandler.error(res, 'Failed to get nearby alerts');
    }
  }

  static async getStats(_req: AuthRequest, res: Response): Promise<Response> {
    try {
      const stats = await ResponderService.getResponderStats();
      return ResponseHandler.success(res, stats, 'Responder stats retrieved');
    } catch (error: any) {
      logger.error('Get responder stats error:', error);
      return ResponseHandler.error(res, 'Failed to get responder stats');
    }
  }

  static async getAllResponders(_req: AuthRequest, res: Response): Promise<Response> {
    try {
      const ResponderAvailability = await import('../models/responderAvailability.model');
      const responders = await ResponderAvailability.default.find()
        .populate('responderId', 'firstName lastName email phone')
        .sort({ status: 1, lastPing: -1 });

      return ResponseHandler.success(res, responders, 'Responders retrieved');
    } catch (error: any) {
      logger.error('Get all responders error:', error);
      return ResponseHandler.error(res, 'Failed to get responders');
    }
  }
}

export default ResponderController;