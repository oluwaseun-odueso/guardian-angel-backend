import { Response } from 'express';
import ResponderAuthService from '../services/responder.auth.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ResponderAuthController {
  static async register(req: AuthRequest, res: Response): Promise<Response> {
    try {
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
  
  static async getProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const profile = await ResponderAuthService.getProfile(req.user._id.toString());
      
      return ResponseHandler.success(res, profile, 'Responder profile retrieved');
    } catch (error: any) {
      logger.error('Get responder profile error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async updateProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const profile = await ResponderAuthService.updateProfile(
        req.user._id.toString(),
        req.body
      );
      
      return ResponseHandler.success(res, profile, 'Responder profile updated');
    } catch (error: any) {
      logger.error('Update responder profile error:', error);
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
      
      const result = await ResponderAuthService.updateStatus(
        req.user._id.toString(),
        status
      );
      
      return ResponseHandler.success(res, result, 'Status updated');
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
      
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return ResponseHandler.error(res, 'Valid coordinates array [lng, lat] required', 400);
      }

      const coordinateTuple: [number, number] = [coordinates[0], coordinates[1]];
      
      const result = await ResponderAuthService.updateLocation(
        req.user._id.toString(),
        coordinateTuple,
        accuracy || 15
      );
      
      return ResponseHandler.success(res, result, 'Location updated');
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async getStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const stats = await ResponderAuthService.getStats(req.user._id.toString());
      
      return ResponseHandler.success(res, stats, 'Responder statistics retrieved');
    } catch (error: any) {
      logger.error('Get responder stats error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
  
  static async deactivate(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      const result = await ResponderAuthService.deactivate(req.user._id.toString());
      
      return ResponseHandler.success(res, result, 'Responder account deactivated');
    } catch (error: any) {
      logger.error('Deactivate responder error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default ResponderAuthController;


// import { Response } from 'express';
// import ResponderAuthService from '../services/responder.auth.service';
// import ResponseHandler from '../utils/response';
// import logger from '../utils/logger';
// import { AuthRequest } from '../middlewares/auth.middleware';

// export class ResponderAuthController {
  
//   // Sign up as a responder
//   static async signup(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       const { 
//         certifications = [],
//         experienceYears = 0,
//         vehicleType,
//         licenseNumber,
//         availability = {},
//         maxDistance = 10 // default 10km radius
//       } = req.body;
      
//       // Ensure user exists and is not already a responder
//       const user = await (await import('../models/user.model')).default.findById(req.user._id);
//       if (!user) {
//         return ResponseHandler.error(res, 'User not found', 404);
//       }
      
//       if (user.role === 'responder') {
//         return ResponseHandler.error(res, 'Already registered as a responder', 400);
//       }
      
//       // Create responder profile
//       const responder = await ResponderAuthService.signupAsResponder({
//         userId: req.user._id.toString(),
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         phone: user.phone,
//         certifications,
//         experienceYears,
//         vehicleType,
//         licenseNumber,
//         availability,
//         maxDistance,
//       });
      
//       // Update user role to responder
//       user.role = 'responder';
//       await user.save();
      
//       return ResponseHandler.success(res, responder, 'Successfully registered as responder', 201);
//     } catch (error: any) {
//       logger.error('Responder signup error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }
  
//   // Get responder profile
//   static async getProfile(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       const Responder = await import('../models/responder.model');
//       const responder = await Responder.default.findOne({ userId: req.user._id })
//         .populate('userId', 'firstName lastName email phone profileImage');
      
//       if (!responder) {
//         return ResponseHandler.error(res, 'Responder profile not found', 404);
//       }
      
//       return ResponseHandler.success(res, responder, 'Responder profile retrieved');
//     } catch (error: any) {
//       logger.error('Get responder profile error:', error);
//       return ResponseHandler.error(res, 'Failed to get profile');
//     }
//   }
  
//   // Update responder profile
//   static async updateProfile(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       const {
//         certifications,
//         experienceYears,
//         vehicleType,
//         licenseNumber,
//         availability,
//         maxDistance,
//         isActive,
//         bio,
//         hourlyRate,
//       } = req.body;
      
//       const responder = await ResponderAuthService.updateProfile(
//         req.user._id.toString(),
//         {
//           certifications,
//           experienceYears,
//           vehicleType,
//           licenseNumber,
//           availability,
//           maxDistance,
//           isActive,
//           bio,
//           hourlyRate,
//         }
//       );
      
//       return ResponseHandler.success(res, responder, 'Responder profile updated');
//     } catch (error: any) {
//       logger.error('Update responder profile error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }
  
//   // Get responder statistics
//   static async getStats(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       const stats = await ResponderAuthService.getResponderStats(req.user._id.toString());
      
//       return ResponseHandler.success(res, stats, 'Responder statistics retrieved');
//     } catch (error: any) {
//       logger.error('Get responder stats error:', error);
//       return ResponseHandler.error(res, 'Failed to get statistics');
//     }
//   }
  
//   // Deactivate responder account
//   static async deactivate(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user) {
//         return ResponseHandler.error(res, 'User not authenticated', 401);
//       }
      
//       await ResponderAuthService.deactivateResponder(req.user._id.toString());
      
//       return ResponseHandler.success(res, null, 'Responder account deactivated');
//     } catch (error: any) {
//       logger.error('Deactivate responder error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }
  
//   // List all responders (admin only)
//   static async getAllResponders(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user || req.user.role !== 'admin') {
//         return ResponseHandler.error(res, 'Admin access required', 403);
//       }
      
//       const { status, isVerified, limit = 50, page = 1 } = req.query;
      
//       const responders = await ResponderAuthService.getAllResponders({
//         status: status as string,
//         isVerified: isVerified === 'true',
//         limit: parseInt(limit as string),
//         page: parseInt(page as string),
//       });
      
//       return ResponseHandler.success(res, responders, 'Responders retrieved');
//     } catch (error: any) {
//       logger.error('Get all responders error:', error);
//       return ResponseHandler.error(res, 'Failed to get responders');
//     }
//   }
  
//   // Verify responder (admin only)
//   static async verifyResponder(req: AuthRequest, res: Response): Promise<Response> {
//     try {
//       if (!req.user || req.user.role !== 'admin') {
//         return ResponseHandler.error(res, 'Admin access required', 403);
//       }
      
//       const { responderId } = req.params;
//       const { isVerified, verificationNotes } = req.body;
      
//       const responder = await ResponderAuthService.verifyResponder(
//         responderId,
//         isVerified,
//         verificationNotes
//       );
      
//       return ResponseHandler.success(res, responder, 'Responder verification updated');
//     } catch (error: any) {
//       logger.error('Verify responder error:', error);
//       return ResponseHandler.error(res, error.message, 400);
//     }
//   }
// }

// export default ResponderAuthController;