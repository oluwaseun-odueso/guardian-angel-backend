import { Response } from 'express';
import AlertService from '../services/alert.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ResponderController {
  // Acknowledge an alert
  static async acknowledgeAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      
      const alert = await AlertService.acknowledgeAlert(
        alertId,
        req.user._id.toString()
      );
      
      return ResponseHandler.success(res, alert, 'Alert acknowledged');
    } catch (error: any) {
      logger.error('Acknowledge alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Cancel an alert
  static async cancelAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      const { reason } = req.body;
      
      const alert = await AlertService.cancelAlert(
        alertId,
        req.user._id.toString(),
        reason
      );
      
      return ResponseHandler.success(res, alert, 'Alert cancelled');
    } catch (error: any) {
      logger.error('Cancel alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Resolve an alert
  static async resolveAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      
      const alert = await AlertService.resolveAlert(
        alertId,
        req.user._id.toString()
      );
      
      return ResponseHandler.success(res, alert, 'Alert resolved');
    } catch (error: any) {
      logger.error('Resolve alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Get responder's assigned alerts
  static async getAssignedAlerts(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { status } = req.query;
      
      const alerts = await AlertService.getResponderAlerts(
        req.user._id.toString(),
        status as string
      );
      
      return ResponseHandler.success(res, alerts, 'Assigned alerts retrieved');
    } catch (error: any) {
      logger.error('Get assigned alerts error:', error);
      return ResponseHandler.error(res, 'Failed to get alerts');
    }
  }
  
  // Update responder location for an alert
  static async updateAlertLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId, coordinates, accuracy } = req.body;
      
      if (!alertId || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return ResponseHandler.error(res, 'Alert ID and valid coordinates required', 400);
      }

      const [lon, lat] = coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number' || 
          isNaN(lon) || isNaN(lat)) {
        return ResponseHandler.error(res, 'Coordinates must be valid numbers', 400);
      }

      const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
      const result = await AlertService.updateResponderLocation(
        alertId,
        req.user._id.toString(),
        coordinateTuple,
        accuracy || 15
      );
      
      return ResponseHandler.success(res, result, 'Responder location updated for alert');
    } catch (error: any) {
      logger.error('Update alert location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default ResponderController;


// import { Response } from 'express';
// import ResponderService from '../services/responder.service';
// import ResponseHandler from '../utils/response';
// import logger from '../utils/logger';
// import { AuthRequest } from '../middlewares/auth.middleware';

// export class ResponderController {
//   static async registerResponder(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
//       const User = await import('../models/user.model');
//       await User.default.findByIdAndUpdate(req.user._id, { role: 'responder' });
      
//       const responder = await ResponderService.registerResponder(req.user._id.toString());
//       return ResponseHandler.success(res, responder, 'Registered as responder');
//     } catch (error: any) {
//       logger.error('Register responder error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }

//   static async updateLocation(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       const { coordinates, accuracy } = req.body;
      
//       const responder = await ResponderService.updateResponderLocation(
//         req.user._id.toString(),
//         coordinates,
//         accuracy
//       );

//       return ResponseHandler.success(res, responder, 'Location updated');
//     } catch (error: any) {
//       logger.error('Update responder location error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }

//   static async getNearbyAlerts(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       const { lat, lng, radius = 5 } = req.query;
      
//       if (!lat || !lng) {
//         return ResponseHandler.error(res, 'Latitude and longitude required', 400);
//       }

//       const Alert = await import('../models/alert.model');
//       const alerts = await Alert.default.find({
//         status: 'active',
//         location: {
//           $near: {
//             $geometry: {
//               type: 'Point',
//               coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
//             },
//             $maxDistance: parseFloat(radius as string) * 1000,
//           },
//         },
//       })
//       .populate('userId', 'firstName lastName phone')
//       .limit(20);

//       return ResponseHandler.success(res, alerts, 'Nearby alerts retrieved');
//     } catch (error: any) {
//       logger.error('Get nearby alerts error:', error);
//       return ResponseHandler.error(res, 'Failed to get nearby alerts');
//     }
//   }

//   static async getStats(_req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       const stats = await ResponderService.getResponderStats();
//       return ResponseHandler.success(res, stats, 'Responder stats retrieved');
//     } catch (error: any) {
//       logger.error('Get responder stats error:', error);
//       return ResponseHandler.error(res, 'Failed to get responder stats');
//     }
//   }

//   static async getAllResponders(_req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       const ResponderAvailability = await import('../models/responderAvailability.model');
//       const responders = await ResponderAvailability.default.find()
//         .populate('responderId', 'firstName lastName email phone')
//         .sort({ status: 1, lastPing: -1 });

//       return ResponseHandler.success(res, responders, 'Responders retrieved');
//     } catch (error: any) {
//       logger.error('Get all responders error:', error);
//       return ResponseHandler.error(res, 'Failed to get responders');
//     }
//   }
// }

// export default ResponderController;