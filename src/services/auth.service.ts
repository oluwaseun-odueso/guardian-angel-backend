import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import config from '../config/env';
import logger from '../utils/logger';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  static async register(userData: Partial<IUser>): Promise<IUser> {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create new user with proper defaults
      const user = new User({
        ...userData,
        // Ensure lastKnownLocation is not set during registration
        lastKnownLocation: undefined,
        // Set proper defaults
        settings: userData.settings || {
          enableFallDetection: false,
          alertPreferences: {
            sms: true,
            push: true,
            email: true,
          },
        },
        medicalInfo: userData.medicalInfo || {
          bloodType: null,
          allergies: [],
          conditions: [],
        },
        isActive: true,
      });

      await user.save();

      return user;
    } catch (error: any) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  static async login(email: string, password: string): Promise<{ user: IUser; tokens: AuthTokens }> {
    try {
      const user = await User.findOne({ email }).select('+password');
      
      if (!user || !user.isActive) {
        throw new Error('Invalid credentials or inactive account');
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      const tokens = this.generateTokens(user);

      const userWithoutPassword = user.toObject();
      delete (userWithoutPassword as any).password;

      return {
        user: userWithoutPassword as IUser,
        tokens,
      };
    } catch (error: any) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  static generateTokens(user: IUser): AuthTokens {
    const payload: TokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    // Fix: Create proper options object
    const accessTokenOptions: jwt.SignOptions = {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    };

    const refreshTokenOptions: jwt.SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, accessTokenOptions);
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, refreshTokenOptions);

    // Calculate expiresIn in seconds
    let expiresInSeconds = 7 * 24 * 60 * 60; // Default: 7 days
    const expiresInString = config.jwt.expiresIn as string;
    
    if (expiresInString.includes('d')) {
      const days = parseInt(expiresInString);
      expiresInSeconds = days * 24 * 60 * 60;
    } else if (expiresInString.includes('h')) {
      const hours = parseInt(expiresInString);
      expiresInSeconds = hours * 60 * 60;
    } else if (expiresInString.includes('m')) {
      const minutes = parseInt(expiresInString);
      expiresInSeconds = minutes * 60;
    } else if (expiresInString.includes('s')) {
      expiresInSeconds = parseInt(expiresInString);
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  }

  static refreshToken(refreshToken: string): AuthTokens {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
      
      const mockUser: Partial<IUser> = {
        _id: decoded.id as any,
        email: decoded.email,
        role: decoded.role as any,
      };
      
      return this.generateTokens(mockUser as IUser);
    } catch (error: any) {
      // throw new Error('Invalid refresh token');

      logger.error('Refresh token verification error:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Failed to refresh token');
      }
    }
  }

  static async updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      return user;
    } catch (error: any) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }
}

export default AuthService;