// middleware/responder.auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Responder from '../models/responder.model';
import config from '../config/env';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { ResponderRequest } from '../types/express';

export const authenticateResponder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ResponseHandler.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as { 
      id: string; 
      email: string; 
      userType: string;
      responderId?: string;
    };
    
    console.log(`🚑 Responder token decoded:`, {
      id: decoded.id,
      email: decoded.email,
      userType: decoded.userType,
      responderId: decoded.responderId
    });

    // Only allow responder type tokens
    if (decoded.userType !== 'responder') {
      ResponseHandler.unauthorized(res, 'Invalid token type for responder route');
      return;
    }

    // Find responder - use responderId from token if available, otherwise use id
    const responderId = decoded.responderId || decoded.id;
    const responder = await Responder.findById(responderId)
      .populate('userId', 'fullName email phone role isActive')
      .select('-password');
    
    if (!responder) {
      ResponseHandler.unauthorized(res, 'Responder not found');
      return;
    }

    if (!responder.isActive) {
      ResponseHandler.unauthorized(res, 'Responder account is inactive');
      return;
    }

    if (!responder.isVerified) {
      ResponseHandler.unauthorized(res, 'Responder account not verified');
      return;
    }

    // Attach to request
    (req as unknown as ResponderRequest).responder = responder;
    (req as unknown as ResponderRequest).responderId = responder._id.toString();
    (req as unknown as ResponderRequest).userId = responder.userId.toString();
    (req as unknown as ResponderRequest).userType = 'responder';

    console.log(`✅ Authenticated responder: ${responder.email}`);
    next();
  } catch (error: any) {
    logger.error('Responder authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      ResponseHandler.unauthorized(res, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      ResponseHandler.unauthorized(res, 'Token expired');
    } else {
      ResponseHandler.unauthorized(res, 'Authentication failed');
    }
  }
};

// Optional: Responder authorization middleware
export const authorizeResponder = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const responderReq = req as unknown as ResponderRequest;
    
    if (!responderReq.responder) {
      ResponseHandler.unauthorized(res, 'Responder not authenticated');
      return;
    }

    if (!allowedRoles.includes(responderReq.responder.role)) {
      console.log(`🚫 Responder authorization failed: ${responderReq.responder.role} not in ${allowedRoles}`);
      ResponseHandler.forbidden(res, 'Insufficient permissions');
      return;
    }

    console.log(`✅ Responder authorized: ${responderReq.responder.role} can access this route`);
    next();
  };
};

// // Type guard helper
// export const assertResponderRequest = (req: Request): asserts req is ResponderRequest => {
//   if (!(req as unknown as ResponderRequest).responder) {
//     throw new Error('Expected authenticated responder');
//   }
// };

// Middleware to check if responder is available
export const requireResponderAvailable = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const responderReq = req as unknown as ResponderRequest;
  
  if (!responderReq.responder) {
    ResponseHandler.unauthorized(res, 'Responder not authenticated');
    return;
  }

  if (responderReq.responder.status !== 'available') {
    ResponseHandler.forbidden(res, 'Responder is not available');
    return;
  }

  next();
};