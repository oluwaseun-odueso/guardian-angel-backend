import { Response } from 'express';
import AlertService from '../services/alert.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import Alert from '../models/alert.model'
import { AuthRequest } from '../middlewares/auth.middleware';

export class AlertController {
  // Create manual alert (select specific responder)
  // static async createManualAlert(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }
      
  //     const { responderId, coordinates, accuracy } = req.body;
      
  //     if (!responderId || !coordinates || !accuracy) {
  //       return ResponseHandler.error(res, 'Responder ID, coordinates, and accuracy are required', 400);
  //     }
      
  //     const result = await AlertService.createManualAlert(
  //       req.user._id.toString(),
  //       responderId,
  //       { coordinates, accuracy }
  //     );
      
  //     return ResponseHandler.success(res, result, 'Alert created successfully');
  //   } catch (error: any) {
  //     logger.error('Create manual alert error:', error);
  //     return ResponseHandler.error(res, error.message, 400);
  //   }
  // }

  static async createManualAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { hospitalId, location } = req.body;
      
      if (!hospitalId) {
        return ResponseHandler.error(res, 'Hospital ID is required', 400);
      }
      
      if (!location || !location.coordinates) {
        return ResponseHandler.error(res, 'Location coordinates are required', 400);
      }
      
      const result = await AlertService.createManualAlert(
        req.user._id.toString(),
        hospitalId, // Changed from responderId to hospitalId
        location
      );
      
      return ResponseHandler.success(res, result, 'Alert created successfully');
    } catch (error: any) {
      logger.error('Create manual alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Create panic alert (auto-assign)
  static async createPanicAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { coordinates, accuracy } = req.body;
      
      if (!coordinates || !accuracy) {
        return ResponseHandler.error(res, 'Coordinates and accuracy are required', 400);
      }
      
      const result = await AlertService.createPanicAlert(
        req.user._id.toString(),
        { coordinates, accuracy }
      );
      
      return ResponseHandler.success(res, result, 'Panic alert created, responder assigned');
    } catch (error: any) {
      logger.error('Create panic alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  // static async getAvailableResponders(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     const { lat, lng, maxDistance, page, limit, vehicleType } = req.query;
      
  //     let latitude, longitude;
  //     if (lat && lng) {
  //       latitude = parseFloat(lat as string);
  //       longitude = parseFloat(lng as string);
  //     }

  //     console.log('Lat:', lat)
  //     console.log("Lng:", lng)
      
  //     const options = {
  //       maxDistance: maxDistance ? parseFloat(maxDistance as string) : undefined,
  //       page: page ? parseInt(page as string) : 1,
  //       limit: limit ? parseInt(limit as string) : 20,
  //       vehicleType: vehicleType as string,
  //     };
      
  //     console.log("The request got here")
  //     const result = await AlertService.getAvailableResponders(latitude, longitude, options);
      
  //     console.log("The request got here 2")
  //     return ResponseHandler.success(res, result, 'Available responders retrieved');
  //   } catch (error: any) {
  //     logger.error('Get available responders error:', error);
  //     return ResponseHandler.error(res, 'Failed to get responders');
  //   }
  // }

  static async getNearbyMedicalFacilities(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { 
        lat, 
        lng, 
        maxDistance = 10,
        page = 1,
        limit = 20,
        onlyRegistered = 'false',
        autoRegister = 'true',
      } = req.query;
      
      if (!lat || !lng) {
        return ResponseHandler.error(res, 'Latitude and longitude are required', 400);
      }
      
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      
      console.log("A")
      const result = await AlertService.getNearbyMedicalFacilities(
        latitude,
        longitude,
        {
          maxDistance: parseFloat(maxDistance as string),
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          onlyRegistered: onlyRegistered === 'true',
          autoRegister: autoRegister === 'true',
        }
      );
      
      return ResponseHandler.success(res, result, 'Nearby medical facilities retrieved');
    } catch (error: any) {
      logger.error('Get nearby medical facilities error:', error);
      return ResponseHandler.error(res, 'Failed to get medical facilities');
    }
  }
    
  // Get user's alerts
  static async getUserAlerts(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { status } = req.query;
      
      const alerts = await AlertService.getUserAlerts(
        req.user._id.toString(),
        status as string
      );
      
      return ResponseHandler.success(res, alerts, 'User alerts retrieved');
    } catch (error: any) {
      logger.error('Get user alerts error:', error);
      return ResponseHandler.error(res, 'Failed to get alerts');
    }
  }

  static async deleteAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      const userId = req.user._id.toString();
      
      // Check if the alert exists and belongs to the user
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        return ResponseHandler.error(res, 'Alert not found', 404);
      }
      
      // Verify the alert belongs to the authenticated user
      if (alert.userId.toString() !== userId) {
        return ResponseHandler.error(res, 'Unauthorized to delete this alert', 403);
      }
      
      // if (alert.status !== 'resolved' && alert.status !== 'cancelled') {
      //   return ResponseHandler.error(
      //     res, 
      //     `Cannot delete alert with status: ${alert.status}. Only resolved or cancelled alerts can be deleted.`, 
      //     400
      //   );
      // }
      
      // Delete the alert
      const deletedAlert = await AlertService.deleteAlert(alertId, userId);
      
      if (!deletedAlert) {
        return ResponseHandler.error(res, 'Failed to delete alert', 400);
      }
      
      return ResponseHandler.success(res, deletedAlert, 'Alert deleted successfully');
    } catch (error: any) {
      logger.error('Delete alert error:', error);
      
      // Handle specific error cases
      if (error.name === 'CastError') {
        return ResponseHandler.error(res, 'Invalid alert ID format', 400);
      }
      
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Get live tracking for an alert
  static async getLiveTracking(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      
      const trackingData = await AlertService.getLiveTracking(
        alertId,
        req.user._id.toString()
      );
      
      return ResponseHandler.success(res, trackingData, 'Live tracking data retrieved');
    } catch (error: any) {
      logger.error('Get live tracking error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Update user location
  static async updateUserLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId, coordinates, accuracy } = req.body;
      
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return ResponseHandler.error(res, 'Valid coordinates array [lng, lat] required', 400);
      }

      const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
      const result = await AlertService.updateUserLocation(
        alertId,
        coordinateTuple,
        accuracy || 15
      );
      
      return ResponseHandler.success(res, result, 'User location updated');
    } catch (error: any) {
      logger.error('Update user location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getUserAlertss(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const alerts = await AlertService.getUserAlerts(req.user._id.toString());
      
      return ResponseHandler.success(res, alerts, 'Alerts retrieved');
    } catch (error: any) {
      logger.error('Get user alerts error:', error);
      return ResponseHandler.error(res, 'Failed to retrieve alerts');
    }
  }
}

export default AlertController;



// import { Request, Response } from 'express';
// import AlertService from '../services/alert.service';
// import ResponseHandler from '../utils/response';
// import logger from '../utils/logger';
// import { AuthRequest } from '../middlewares/auth.middleware';

// export class AlertController {
//   static async createAlert(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }

//       const alert = await AlertService.createAlert({
//         userId: req.user._id.toString(),
//         ...req.body,
//       });

//       return ResponseHandler.success(res, alert, 'Alert created successfully', 201);
//     } catch (error: any) {
//       logger.error('Create alert controller error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }

  // static async getUserAlerts(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }

  //     const alerts = await AlertService.getUserAlerts(req.user._id.toString());
      
  //     return ResponseHandler.success(res, alerts, 'Alerts retrieved');
  //   } catch (error: any) {
  //     logger.error('Get user alerts error:', error);
  //     return ResponseHandler.error(res, 'Failed to retrieve alerts');
  //   }
  // }

//   static async getActiveAlerts(req: Request, res: Response): Promise<Response> {
//     try {
//       const { type, status, lat, lng, radius = 5 } = req.query;
      
//       const filters: any = {};
      
//       if (type) filters.type = type;
//       if (status) filters.status = status;
      
//       if (lat && lng) {
//         filters.location = {
//           coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
//           radius: parseFloat(radius as string),
//         };
//       }

//       const alerts = await AlertService.getActiveAlerts(filters);
      
//       return ResponseHandler.success(res, alerts, 'Active alerts retrieved');
//     } catch (error: any) {
//       logger.error('Get active alerts error:', error);
//       return ResponseHandler.error(res, 'Failed to retrieve alerts');
//     }
//   }

  // static async updateAlertStatus(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }

  //     const { alertId } = req.params;
  //     const { status } = req.body;
      
  //     const alert = await AlertService.updateAlertStatus(
  //       alertId,
  //       status,
  //       req.user._id.toString()
  //     );
      
  //     if (!alert) {
  //       return ResponseHandler.notFound(res, 'Alert not found');
  //     }
      
  //     return ResponseHandler.success(res, alert, 'Alert status updated');
  //   } catch (error: any) {
  //     logger.error('Update alert status error:', error);
  //     return ResponseHandler.error(res, error.message, 400);
  //   }
  // }

//   static async getAlertDetails(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       const { alertId } = req.params;
      
//       // This would be implemented in AlertService
//       // For now, return success
//       return ResponseHandler.success(res, { alertId }, 'Alert details retrieved');
//     } catch (error: any) {
//       logger.error('Get alert details error:', error);
//       return ResponseHandler.error(res, 'Failed to get alert details');
//     }
//   }

//   static async addMessageToAlert(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }

//       const { alertId } = req.params;
//       const { content, type = 'text' } = req.body;
      
//       const alert = await AlertService.addMessage(
//         alertId,
//         req.user._id.toString(),
//         content,
//         type
//       );
      
//       if (!alert) {
//         return ResponseHandler.notFound(res, 'Alert not found');
//       }
      
//       return ResponseHandler.success(res, alert, 'Message added');
//     } catch (error: any) {
//       logger.error('Add message error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }
// }

// export default AlertController;