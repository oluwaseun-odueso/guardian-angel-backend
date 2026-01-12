import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import config from '../config/env';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
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
    
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
    
    const user = await User.findById(decoded.id).select('-password')
    
    if (!user || !user.isActive) {
      ResponseHandler.unauthorized(res, 'User not found or inactive');
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      ResponseHandler.unauthorized(res, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      ResponseHandler.unauthorized(res, 'Token expired');
    } else {
      ResponseHandler.unauthorized(res, 'Authentication failed');
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ResponseHandler.unauthorized(res, 'User not authenticated');
      return;
    }

    if (!roles.includes(req.user.role)) {
      ResponseHandler.forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};