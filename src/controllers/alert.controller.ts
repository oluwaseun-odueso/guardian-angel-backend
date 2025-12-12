import { Request, Response } from 'express';
import AlertService from '../services/alert.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class AlertController {
  static async createAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const alert = await AlertService.createAlert({
        userId: req.user._id.toString(),
        ...req.body,
      });

      return ResponseHandler.success(res, alert, 'Alert created successfully', 201);
    } catch (error: any) {
      logger.error('Create alert controller error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getUserAlerts(req: AuthRequest, res: Response): Promise<Response> {
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

  static async getActiveAlerts(req: Request, res: Response): Promise<Response> {
    try {
      const { type, status, lat, lng, radius = 5 } = req.query;
      
      const filters: any = {};
      
      if (type) filters.type = type;
      if (status) filters.status = status;
      
      if (lat && lng) {
        filters.location = {
          coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
          radius: parseFloat(radius as string),
        };
      }

      const alerts = await AlertService.getActiveAlerts(filters);
      
      return ResponseHandler.success(res, alerts, 'Active alerts retrieved');
    } catch (error: any) {
      logger.error('Get active alerts error:', error);
      return ResponseHandler.error(res, 'Failed to retrieve alerts');
    }
  }

  static async updateAlertStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { alertId } = req.params;
      const { status } = req.body;
      
      const alert = await AlertService.updateAlertStatus(
        alertId,
        status,
        req.user._id.toString()
      );
      
      if (!alert) {
        return ResponseHandler.notFound(res, 'Alert not found');
      }
      
      return ResponseHandler.success(res, alert, 'Alert status updated');
    } catch (error: any) {
      logger.error('Update alert status error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getAlertDetails(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { alertId } = req.params;
      
      // This would be implemented in AlertService
      // For now, return success
      return ResponseHandler.success(res, { alertId }, 'Alert details retrieved');
    } catch (error: any) {
      logger.error('Get alert details error:', error);
      return ResponseHandler.error(res, 'Failed to get alert details');
    }
  }

  static async addMessageToAlert(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { alertId } = req.params;
      const { content, type = 'text' } = req.body;
      
      const alert = await AlertService.addMessage(
        alertId,
        req.user._id.toString(),
        content,
        type
      );
      
      if (!alert) {
        return ResponseHandler.notFound(res, 'Alert not found');
      }
      
      return ResponseHandler.success(res, alert, 'Message added');
    } catch (error: any) {
      logger.error('Add message error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default AlertController;