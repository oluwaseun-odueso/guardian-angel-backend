import { Request, Response } from 'express';
import AlertService from '../services/alert.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
// import { AuthRequest } from '../middlewares/auth.middleware';

export class ResponderController {
  // Acknowledge an alert
  static async acknowledgeAlert(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      
      const alert = await AlertService.acknowledgeAlert(
        alertId,
        req.responder.userId._id.toString()
      );
      
      return ResponseHandler.success(res, alert, 'Alert acknowledged');
    } catch (error: any) {
      logger.error('Acknowledge alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Cancel an alert
  static async cancelAlert(req: Request, res: Response): Promise<Response> {
    try {
      console.log("Request itself: ", req)
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { alertId } = req.params;
      const { reason } = req.body;
      
      const alert = await AlertService.cancelAlert(
        alertId,
        req.responder.userId._id.toString(),
        reason
      );
      
      return ResponseHandler.success(res, alert, 'Alert cancelled');
    } catch (error: any) {
      logger.error('Cancel alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Resolve an alert
  static async resolveAlert(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      console.log("Responder id: ", req.responder.userId._id)
      const { alertId } = req.params;

      console.log("Alert id: ", alertId)
      
      const alert = await AlertService.resolveAlert(
        alertId,
        req.responder.userId._id.toString()
      );
      
      return ResponseHandler.success(res, alert, 'Alert resolved');
    } catch (error: any) {
      logger.error('Resolve alert error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  // Get responder's assigned alerts
  static async getAssignedAlerts(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { status } = req.query;
      
      const alerts = await AlertService.getResponderAlerts(
        req.responder.userId._id.toString(),
        status as string
      );
      
      return ResponseHandler.success(res, alerts, 'Assigned alerts retrieved');
    } catch (error: any) {
      logger.error('Get assigned alerts error:', error);
      return ResponseHandler.error(res, 'Failed to get alerts');
    }
  }
  
  // Update responder location for an alert
  static async updateAlertLocation(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
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
        req.responder.userId._id.toString(),
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
