import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class AuthController {
  static async register(req: Request, res: Response): Promise<Response> {
    try {
      const user = await AuthService.register(req.body);
      
      const tokens = AuthService.generateTokens(user);
      
      return ResponseHandler.success(res, {
        user,
        tokens,
      }, 'Registration successful', 201);
    } catch (error: any) {
      logger.error('Registration controller error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      
      return ResponseHandler.success(res, result, 'Login successful');
    } catch (error: any) {
      logger.error('Login controller error:', error);
      return ResponseHandler.unauthorized(res, error.message);
    }
  }

  // static async refreshToken(req: Request, res: Response): Promise<Response> {
  //   try {
  //     const { refreshToken } = req.body;
      
  //     if (!refreshToken) {
  //       return ResponseHandler.unauthorized(res, 'Refresh token required');
  //     }

  //     const tokens = AuthService.refreshToken(refreshToken);
      
  //     return ResponseHandler.success(res, tokens, 'Token refreshed');
  //   } catch (error: any) {
  //     logger.error('Refresh token error:', error);
  //     return ResponseHandler.unauthorized(res, 'Invalid refresh token');
  //   }
  // }

  static async refreshToken(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return ResponseHandler.error(res, 'Invalid request body', 400);
      }

      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return ResponseHandler.unauthorized(res, 'Refresh token required');
      }

      if (typeof refreshToken !== 'string' || refreshToken.split('.').length !== 3) {
        return ResponseHandler.unauthorized(res, 'Invalid token format');
      }

      const tokens = AuthService.refreshToken(refreshToken);
      
      return ResponseHandler.success(res, tokens, 'Token refreshed');
    } catch (error: any) {
      logger.error('Refresh token error:', error);
      
      if (error.message.includes('Invalid refresh token') || 
          error.message.includes('jwt') || 
          error.name === 'JsonWebTokenError') {
        return ResponseHandler.unauthorized(res, 'Invalid refresh token');
      }
      
      return ResponseHandler.error(res, 'Failed to refresh token', 500);
    }
  }

  static async getProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      return ResponseHandler.success(res, req.user, 'Profile retrieved');
    } catch (error: any) {
      logger.error('Get profile error:', error);
      return ResponseHandler.error(res, 'Failed to get profile');
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const updatedUser = await AuthService.updateProfile(req.user._id.toString(), req.body);
      
      return ResponseHandler.success(res, updatedUser, 'Profile updated');
    } catch (error: any) {
      logger.error('Update profile error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async logout(_req: AuthRequest, res: Response): Promise<Response> {
    try {
      // In a real app, you might want to blacklist the token
      // For now, we just return success
      return ResponseHandler.success(res, null, 'Logout successful');
    } catch (error: any) {
      logger.error('Logout error:', error);
      return ResponseHandler.error(res, 'Logout failed');
    }
  }
}

export default AuthController;