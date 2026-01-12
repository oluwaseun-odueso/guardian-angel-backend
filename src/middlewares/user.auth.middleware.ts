// middleware/user.auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import config from '../config/env';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { UserRequest } from '../types/express';

export const authenticateUser = async (
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
    };
    
    console.log(`🔐 User token decoded:`, {
      id: decoded.id,
      email: decoded.email,
      userType: decoded.userType
    });

    // Only allow user type tokens
    if (decoded.userType !== 'user') {
      ResponseHandler.unauthorized(res, 'Invalid token type for user route');
      return;
    }

    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      ResponseHandler.unauthorized(res, 'User not found');
      return;
    }

    if (!user.isActive) {
      ResponseHandler.unauthorized(res, 'User account is inactive');
      return;
    }

    // Attach to request
    (req as unknown as UserRequest).user = user;
    (req as unknown as UserRequest).userId = user._id.toString();
    (req as unknown as UserRequest).userType = 'user';

    console.log(`✅ Authenticated user: ${user.email}`);
    next();
  } catch (error: any) {
    logger.error('User authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      ResponseHandler.unauthorized(res, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      ResponseHandler.unauthorized(res, 'Token expired');
    } else {
      ResponseHandler.unauthorized(res, 'Authentication failed');
    }
  }
};

// Optional: User authorization middleware
export const authorizeUser = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userReq = req as unknown as UserRequest;
    
    if (!userReq.user) {
      ResponseHandler.unauthorized(res, 'User not authenticated');
      return;
    }

    if (!allowedRoles.includes(userReq.user.role)) {
      console.log(`🚫 User authorization failed: ${userReq.user.role} not in ${allowedRoles}`);
      ResponseHandler.forbidden(res, 'Insufficient permissions');
      return;
    }

    console.log(`✅ User authorized: ${userReq.user.role} can access this route`);
    next();
  };
};

// // Type guard helper
// export const assertUserRequest = (req: Request): asserts req is UserRequest => {
//   if (!(req as unknown as UserRequest).user) {
//     throw new Error('Expected authenticated user');
//   }
// };