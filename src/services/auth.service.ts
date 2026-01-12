import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import Responder, { IResponder } from '../models/responder.model'
import config from '../config/env';
import logger from '../utils/logger';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  userType: 'user' | 'responder'; // Add this field to distinguish
  // Optional: Add responder-specific fields if needed
  responderId?: string;
  hospitalId?: string;
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

  // static async login(email: string, password: string): Promise<{ user: IUser; tokens: AuthTokens }> {
  //   try {
  //     const user = await User.findOne({ email }).select('+password');
      
  //     if (!user || !user.isActive) {
  //       throw new Error('Invalid credentials or inactive account');
  //     }

  //     const isPasswordValid = await user.comparePassword(password);
  //     if (!isPasswordValid) {
  //       throw new Error('Invalid credentials');
  //     }

  //     const tokens = this.generateTokens(user);

  //     const userWithoutPassword = user.toObject();
  //     delete (userWithoutPassword as any).password;

  //     return {
  //       user: userWithoutPassword as IUser,
  //       tokens,
  //     };
  //   } catch (error: any) {
  //     logger.error('Login error:', error);
  //     throw error;
  //   }
  // }

  static async login(
    email: string, 
    password: string, 
    loginType: 'user' | 'respondent' // Changed to enum-like type for clarity
  ): Promise<{ 
    user: IUser | IResponder; 
    tokens: AuthTokens;
    userType: 'user' | 'respondent';
  }> {
    try {
      let user: IUser | IResponder | null = null;
      let userType: 'user' | 'respondent' = 'user';

      if (loginType === 'user') {
        // Search in User model
        const foundUser = await User.findOne({ email }).select('+password');
        
        if (!foundUser) {
          throw new Error('User account not found');
        }
        
        if (!foundUser.isActive) {
          throw new Error('Account is inactive. Please contact support');
        }
        
        // Verify password
        const isPasswordValid = await foundUser.comparePassword(password);
        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }
        
        user = foundUser;
        userType = 'user';
        
      } else if (loginType === 'respondent') {
        // Search in Responder model
        const foundResponder = await Responder.findOne({ email })
          .populate('userId', 'fullName email phone role isActive')
          .select('+password');
        
        if (!foundResponder) {
          throw new Error('Responder account not found');
        }
        
        if (!foundResponder.isActive || !foundResponder.isVerified) {
          throw new Error('Responder account is inactive or not verified');
        }
        
        // For responder, we need to check if associated user exists and get password
        const associatedUser = await User.findById(foundResponder.userId).select('+password');
        
        if (!associatedUser) {
          throw new Error('Associated user account not found');
        }
        
        if (!associatedUser.isActive) {
          throw new Error('Associated user account is inactive');
        }
        
        // Verify password using the associated user's password
        const isPasswordValid = await associatedUser.comparePassword(password);
        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }
        
        user = foundResponder;
        userType = 'respondent';
        
      } else {
        throw new Error('Invalid login type. Must be "user" or "responder"');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);
      
      // Remove password from response
      const userWithoutPassword = user.toObject();
      delete (userWithoutPassword as any).password;
      
      // If it's a responder, include user details in the response
      if (userType === 'respondent') {
        const responder = userWithoutPassword as IResponder;
        // Get the populated user details
        if (responder.userId && typeof responder.userId !== 'string') {
          responder.userDetails = {
            fullName: (responder.userId as any).fullName,
            email: (responder.userId as any).email,
            phone: (responder.userId as any).phone,
            role: (responder.userId as any).role,
          };
        }
      }

      console.log(`✅ Login successful: ${userType}=${email}`);
      
      return {
        user: userWithoutPassword as IUser | IResponder,
        tokens,
        userType,
      };
    } catch (error: any) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  static generateTokens(user: IUser | IResponder): AuthTokens {
    // const userType = user instanceof (mongoose.model('User') as any) ? 'user' : 'responder';

    // const payload: TokenPayload = {
    //   id: user._id.toString(),
    //   email: user.email,
    //   role: user.role,
    //   userType: userType,
    // };

    // if (userType === 'responder') {
    //   const responder = user as IResponder;
    //   payload.responderId = responder._id.toString();
      
    //   // Add hospital ID if available
    //   if (responder.hospital) {
    //     payload.hospitalId = responder.hospital.toString();
    //   }
    // }

    // Determine user type
    const isResponder = 'hospital' in user && 'certifications' in user;
    const userType = isResponder ? 'responder' : 'user';
    
    const payload: TokenPayload = {
      id: isResponder ? (user as IResponder).userId.toString() : user._id.toString(),
      email: user.email,
      role: user.role,
      userType: userType as 'user' | 'responder',
    };

    // If it's a responder, add responder-specific data
    if (isResponder) {
      const responder = user as IResponder;
      payload.responderId = responder._id.toString();
      
      // Add hospital ID if available
      if (responder.hospital) {
        payload.hospitalId = responder.hospital.toString();
      }
    }





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

  static generateResponderTokens(responder: IResponder): AuthTokens {
    const payload: TokenPayload = {
      id: responder.userId.toString(), // User ID
      email: responder.email,
      role: responder.role,
      userType: 'responder',
      responderId: responder._id.toString(), // Responder ID
    };

    // Add hospital ID if available
    if (responder.hospital) {
      payload.hospitalId = responder.hospital.toString();
    }

    const accessTokenOptions: jwt.SignOptions = {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    };

    const refreshTokenOptions: jwt.SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, accessTokenOptions);
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, refreshTokenOptions);

    // Calculate expiresIn in seconds
    let expiresInSeconds = 7 * 24 * 60 * 60;
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