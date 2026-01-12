import { Response, Request } from 'express';
import ResponderAuthService from '../services/responder.auth.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';
// import { assertResponderRequest } from '../middlewares/responder.auth.middleware';
// import { ResponderRequest } from '../types/express'




// export interface AuthRequest extends Request {
//   user?: IUser;
// }


export class ResponderAuthController {
  static async register(req: AuthRequest, res: Response): Promise<Response> {
    try {
      // assertUserRequest(req);

      console.log("Requessssssssssssst userrrrrrrrr: ", req.user)
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const result = await ResponderAuthService.registerAsResponder(
        req.user._id.toString(),
        req.body
      );
      
      return ResponseHandler.success(res, result, 'Successfully registered as responder', 201);
    } catch (error: any) {
      logger.error('Responder registration error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const profile = await ResponderAuthService.getProfile(req.responder.userId._id.toString());
      
      return ResponseHandler.success(res, profile, 'Responder profile retrieved');
    } catch (error: any) {
      logger.error('Get responder profile error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const profile = await ResponderAuthService.updateProfile(
        req.responder.userId._id.toString(),
        req.body
      );
      
      return ResponseHandler.success(res, profile, 'Responder profile updated');
    } catch (error: any) {
      logger.error('Update responder profile error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { status } = req.body;
      
      if (!['available', 'busy', 'offline'].includes(status)) {
        return ResponseHandler.error(res, 'Invalid status', 400);
      }
      
      const result = await ResponderAuthService.updateStatus(
        req.responder.userId._id.toString(),
        status
      );
      
      return ResponseHandler.success(res, result, 'Status updated');
    } catch (error: any) {
      logger.error('Update responder status error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async updateLocation(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const { coordinates, accuracy } = req.body;
      
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return ResponseHandler.error(res, 'Valid coordinates array [lng, lat] required', 400);
      }

      const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
      const result = await ResponderAuthService.updateLocation(
        req.responder.userId._id.toString(),
        coordinateTuple,
        accuracy || 15
      );
      
      return ResponseHandler.success(res, result, 'Location updated');
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async getStats(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const stats = await ResponderAuthService.getStats(req.responder.userId._id.toString());
      
      return ResponseHandler.success(res, stats, 'Responder statistics retrieved');
    } catch (error: any) {
      logger.error('Get responder stats error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async deactivate(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.responder) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const result = await ResponderAuthService.deactivate(req.responder.userId._id.toString());
      
      return ResponseHandler.success(res, result, 'Responder account deactivated');
    } catch (error: any) {
      logger.error('Deactivate responder error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default ResponderAuthController;
