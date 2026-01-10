import mongoose from 'mongoose';
import Responder from '../models/responder.model';
import User from '../models/user.model';
import logger from '../utils/logger';
import HospitalService from './hospital.service';
import { IHospital } from '@/models/hospital.model';


export class ResponderAuthService {
  static async registerAsResponder(
    userId: string,
    data: {
      hospital: string; // Can be hospital name or hospital ID
      certifications?: string[];
      experienceYears?: number;
      vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
      licenseNumber?: string;
      availability?: any;
      maxDistance?: number;
      bio?: string;
      currentLocation: { coordinates: [number, number] }
    }
  ) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }
      
      const existingResponder = await Responder.findOne({ userId }).session(session);
      if (existingResponder) {
        throw new Error('Already registered as a responder');
      }

      // Extract coordinates from currentLocation
      // const [longitude, latitude] = data.currentLocation.coordinates;


      

      let [first, second] = data.currentLocation.coordinates;
      let latitude, longitude;
      let mongoCoordinates: [number, number];

      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
      // First looks like latitude, second like longitude
        if (Math.abs(first) > 90 || Math.abs(second) > 180) {
          // Actually swapped
          latitude = second;
          longitude = first;
          mongoCoordinates = [first, second]; // Already [lng, lat]
        } else {
          // This is [lat, lng], need to swap for MongoDB
          latitude = first;
          longitude = second;
          mongoCoordinates = [second, first]; // Swap to [lng, lat]
        }
      } else {
        // Can't determine, assume already [lng, lat]
        longitude = first;
        latitude = second;
        mongoCoordinates = [first, second];
      }
      
      // Validate coordinates
      if (latitude < -90 || latitude > 90) {
        throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90`);
      }
      if (longitude < -180 || longitude > 180) {
        throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180`);
      }
      
      console.log(`Coordinates: lat=${latitude}, lng=${longitude}, MongoDB format: ${mongoCoordinates}`);






      
      // Step 1: Find or create hospital
      let hospital: IHospital;
      try {
        hospital = await HospitalService.findOrCreateHospital(
          data.hospital,
          { latitude, longitude }
        );
      } catch (hospitalError: any) {
        throw new Error(`Hospital error: ${hospitalError.message}`);
      }

      const validatedAvailability = data.availability 
        ? this.validateAvailability(data.availability)
        : this.getDefaultAvailability();
      
      // Step 2: Create responder with hospital ObjectId
      const responder = await Responder.create([{
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        hospital: hospital._id, // Use the hospital ObjectId
        certifications: data.certifications || [],
        experienceYears: data.experienceYears || 0,
        vehicleType: data.vehicleType,
        licenseNumber: data.licenseNumber,
        availability: validatedAvailability,
        maxDistance: data.maxDistance || 10,
        bio: data.bio,
        status: 'available',
        rating: 5,
        isActive: true,
        isVerified: true, // Needs admin verification
        currentLocation: {
          type: 'Point',
          coordinates: data.currentLocation.coordinates,
          updatedAt: new Date()
        },
        totalAssignments: 0,
        successfulAssignments: 0,
        responseTimeAvg: 0,
        lastPing: new Date(),
      }], { session });
      
      // user.role = 'responder';
      await user.save({ session });
      
      await session.commitTransaction();
      
      logger.info(`Responder registered: ${userId} - ${user.fullName} at hospital: ${hospital.name}`);
      
      // Return enriched data
      const responderData = responder[0].toObject();
      return {
        ...responderData,
        hospitalDetails: {
          id: hospital._id,
          name: hospital.name,
          city: hospital.city,
          country: hospital.country
        }
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Responder registration error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // static async registerAsResponder(
  //   userId: string,
  //   data: {
  //     hospital: string;
  //     certifications?: string[];
  //     experienceYears?: number;
  //     vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
  //     licenseNumber?: string;
  //     availability?: any;
  //     maxDistance?: number;
  //     bio?: string;
  //     currentLocation: object
  //   }
  // ) {
  //   const session = await mongoose.startSession();
    
  //   try {
  //     session.startTransaction();
      
  //     const user = await User.findById(userId).session(session);
  //     if (!user) {
  //       throw new Error('User not found');
  //     }
      
  //     const existingResponder = await Responder.findOne({ userId }).session(session);
  //     if (existingResponder) {
  //       throw new Error('Already registered as a responder');
  //     }

  //     const validatedAvailability = data.availability 
  //     ? this.validateAvailability(data.availability)
  //     : this.getDefaultAvailability();
      
  //     const responder = await Responder.create([{
  //       userId: user._id,
  //       fullName: user.fullName,
  //       email: user.email,
  //       phone: user.phone,
  //       hospital: data.hospital,
  //       certifications: data.certifications || [],
  //       experienceYears: data.experienceYears || 0,
  //       vehicleType: data.vehicleType,
  //       licenseNumber: data.licenseNumber,
  //       availability: validatedAvailability,
  //       maxDistance: data.maxDistance || 10,
  //       bio: data.bio,
  //       status: 'available',
  //       rating: 5,
  //       isActive: true,
  //       isVerified: true, // Needs admin verification
  //       currentLocation: data.currentLocation,
  //       totalAssignments: 0, // Add missing required fields
  //       successfulAssignments: 0,
  //       responseTimeAvg: 0,
  //       lastPing: new Date(),
  //     }], { session });
      
  //     user.role = 'responder';
  //     await user.save({ session });
      
  //     await session.commitTransaction();
      
  //     logger.info(`Responder registered: ${userId} - ${user.fullName}`);
      
  //     return responder[0];
  //   } catch (error) {
  //     await session.abortTransaction();
  //     logger.error('Responder registration error:', error);
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }
  
  static async updateProfile(
    userId: string,
    updateData: {
      fullName?: string;
      certifications?: string[];
      experienceYears?: number;
      vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
      licenseNumber?: string;
      availability?: any;
      maxDistance?: number;
      bio?: string;
      hourlyRate?: number;
      isActive?: boolean;
    }
  ) {
    try {
      const responder = await Responder.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      logger.info(`Responder profile updated: ${userId}`);
      
      return responder;
    } catch (error: any) {
      logger.error('Update responder profile error:', error);
      throw error;
    }
  }
  
  static async updateStatus(userId: string, status: 'available' | 'busy' | 'offline') {
    try {
      const responder = await Responder.findOneAndUpdate(
        { userId },
        {
          $set: {
            status,
            lastPing: new Date(),
          },
        },
        { new: true }
      );
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      logger.info(`Responder ${userId} status updated to ${status}`);
      
      return responder;
    } catch (error: any) {
      logger.error('Update responder status error:', error);
      throw error;
    }
  }
  
  static async updateLocation(
    userId: string,
    coordinates: number[],
    accuracy: number
  ) {
    try {
      if (!coordinates || coordinates.length !== 2) {
        throw new Error('Valid coordinates array with exactly 2 elements required');
      }

      const responder = await Responder.findOneAndUpdate(
        { userId },
        {
          $set: {
            'currentLocation': {
              type: 'Point', // Must include type
              coordinates: coordinates,
              updatedAt: new Date(),
            },
            lastPing: new Date(),
          },
        },
        { new: true, upsert: true }
      );
      
      logger.debug(`Responder location updated: ${userId}`, { 
        coordinates,
        accuracy 
      });
      return responder;
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      throw error;
    }
  }
  
  static async getProfile(userId: string) {
    try {
      const responder = await Responder.findOne({ userId })
        .populate('userId', 'fullName email phone profileImage')
        .lean();

      
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      return responder;
    } catch (error: any) {
      logger.error('Get responder profile error:', error);
      throw error;
    }
  }
  
  static async getStats(userId: string) {
    try {
      const responder = await Responder.findOne({ userId });
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      const completionRate = responder.totalAssignments > 0 
        ? (responder.successfulAssignments / responder.totalAssignments) * 100 
        : 0;
      
      return {
        totalAssignments: responder.totalAssignments,
        successfulAssignments: responder.successfulAssignments,
        averageResponseTime: responder.responseTimeAvg,
        rating: responder.rating,
        completionRate,
        status: responder.status,
        isVerified: responder.isVerified,
      };
    } catch (error: any) {
      logger.error('Get responder stats error:', error);
      throw error;
    }
  }
  
  static async deactivate(userId: string) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const responder = await Responder.findOneAndUpdate(
        { userId },
        {
          $set: {
            isActive: false,
            status: 'offline',
          },
        },
        { session }
      );
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      await User.findByIdAndUpdate(
        userId,
        { role: 'user' },
        { session }
      );
      
      // 3. Cancel any active alerts
      const Alert = await import('../models/alert.model');
      await Alert.default.updateMany(
        {
          'assignedResponder.responderId': userId,
          status: { $in: ['active', 'acknowledged'] },
        },
        {
          $set: {
            status: 'cancelled',
            'assignedResponder.cancelledAt': new Date(),
          },
        },
        { session }
      );
      
      await session.commitTransaction();
      
      logger.info(`Responder deactivated: ${userId}`);
      
      return { success: true };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Deactivate responder error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  private static getDefaultAvailability() {
    return {
      monday: Array(24).fill(true),
      tuesday: Array(24).fill(true).slice(9, 17),
      wednesday: Array(24).fill(true),
      thursday: Array(24).fill(true),
      friday: Array(24).fill(true),
      saturday: Array(24).fill(true),
      sunday: Array(24).fill(true),
    };
  }

  private static validateAvailability(availability: any) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validated: any = {};
    
    days.forEach(day => {
      if (availability && availability[day] && Array.isArray(availability[day])) {
        validated[day] = availability[day].map((hour: any) => Boolean(hour));
      } else {
        validated[day] = Array(24).fill(false);
      }
    });
    
    return validated;
  }
}

export default ResponderAuthService;




// import mongoose from 'mongoose';
// import Responder, { IResponder } from '../models/responder.model';
// import User from '../models/user.model';
// import logger from '../utils/logger';

// export interface ResponderSignupData {
//   userId: string;
//   firstName: string;
//   lastName: string;
//   email: string;
//   phone: string;
//   certifications: string[];
//   experienceYears: number;
//   vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
//   licenseNumber?: string;
//   availability: {
//     monday: boolean[];
//     tuesday: boolean[];
//     wednesday: boolean[];
//     thursday: boolean[];
//     friday: boolean[];
//     saturday: boolean[];
//     sunday: boolean[];
//   };
//   maxDistance: number;
//   bio?: string;
//   hourlyRate?: number;
// }

// export interface ResponderUpdateData {
//   certifications?: string[];
//   experienceYears?: number;
//   vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
//   licenseNumber?: string;
//   availability?: {
//     monday: boolean[];
//     tuesday: boolean[];
//     wednesday: boolean[];
//     thursday: boolean[];
//     friday: boolean[];
//     saturday: boolean[];
//     sunday: boolean[];
//   };
//   maxDistance?: number;
//   isActive?: boolean;
//   bio?: string;
//   hourlyRate?: number;
// }

// export class ResponderAuthService {
//   static async signupAsResponder(data: ResponderSignupData): Promise<IResponder> {
//     const session = await mongoose.startSession();
    
//     try {
//       session.startTransaction();
      
//       // Check if responder already exists
//       const existingResponder = await Responder.findOne({ userId: data.userId }).session(session);
//       if (existingResponder) {
//         throw new Error('User is already registered as a responder');
//       }
      
//       // Check if user exists
//       const user = await User.findById(data.userId).session(session);
//       if (!user) {
//         throw new Error('User not found');
//       }
      
//       // Create responder profile
//       const responder = await Responder.create([{
//         userId: data.userId,
//         firstName: data.firstName,
//         lastName: data.lastName,
//         email: data.email,
//         phone: data.phone,
//         certifications: data.certifications || [],
//         experienceYears: data.experienceYears || 0,
//         vehicleType: data.vehicleType,
//         licenseNumber: data.licenseNumber,
//         availability: data.availability || this.getDefaultAvailability(),
//         maxDistance: data.maxDistance || 10, // km
//         status: 'offline',
//         rating: 5,
//         totalAssignments: 0,
//         successfulAssignments: 0,
//         responseTimeAvg: 0,
//         isActive: true,
//         isVerified: false, // Needs admin verification
//         bio: data.bio,
//         hourlyRate: data.hourlyRate,
//       }], { session });
      
//       await session.commitTransaction();
      
//       logger.info(`Responder registered: ${data.userId} - ${data.firstName} ${data.lastName}`);
      
//       return responder[0];
//     } catch (error: any) {
//       await session.abortTransaction();
//       logger.error('Responder signup error:', error);
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   }
  
//   static async updateProfile(
//     userId: string,
//     updateData: ResponderUpdateData
//   ): Promise<IResponder | null> {
//     try {
//       const responder = await Responder.findOneAndUpdate(
//         { userId },
//         { $set: updateData },
//         { new: true, runValidators: true }
//       );
      
//       if (!responder) {
//         throw new Error('Responder not found');
//       }
      
//       logger.info(`Responder profile updated: ${userId}`);
//       return responder;
//     } catch (error: any) {
//       logger.error('Update responder profile error:', error);
//       throw error;
//     }
//   }
  
//   static async getResponderStats(userId: string): Promise<{
//     totalAssignments: number;
//     successfulAssignments: number;
//     averageResponseTime: number;
//     rating: number;
//     completionRate: number;
//     earnings?: number;
//     activeHours: number;
//   }> {
//     try {
//       const responder = await Responder.findOne({ userId });
      
//       if (!responder) {
//         throw new Error('Responder not found');
//       }
      
//       const completionRate = responder.totalAssignments > 0 
//         ? (responder.successfulAssignments / responder.totalAssignments) * 100 
//         : 0;
      
//       // Calculate earnings (if hourly rate exists)
//       let earnings;
//       if (responder.hourlyRate) {
//         // This would come from actual assignment data in production
//         const averageAssignmentHours = 0.5; // Example
//         earnings = responder.successfulAssignments * averageAssignmentHours * responder.hourlyRate;
//       }
      
//       // Calculate active hours (simplified)
//       const activeHours = responder.totalAssignments * 0.5; // Example calculation
      
//       return {
//         totalAssignments: responder.totalAssignments,
//         successfulAssignments: responder.successfulAssignments,
//         averageResponseTime: responder.responseTimeAvg,
//         rating: responder.rating,
//         completionRate,
//         earnings,
//         activeHours,
//       };
//     } catch (error: any) {
//       logger.error('Get responder stats error:', error);
//       throw error;
//     }
//   }
  
//   static async deactivateResponder(userId: string): Promise<void> {
//     try {
//       const responder = await Responder.findOneAndUpdate(
//         { userId },
//         { 
//           $set: { 
//             isActive: false,
//             status: 'offline',
//           } 
//         }
//       );
      
//       if (!responder) {
//         throw new Error('Responder not found');
//       }
      
//       // Also update user role back to 'user' if needed
//       await User.findByIdAndUpdate(userId, { role: 'user' });
      
//       logger.info(`Responder deactivated: ${userId}`);
//     } catch (error: any) {
//       logger.error('Deactivate responder error:', error);
//       throw error;
//     }
//   }
  
//   static async getAllResponders(options: {
//     status?: string;
//     isVerified?: boolean;
//     limit: number;
//     page: number;
//   }): Promise<{
//     responders: IResponder[];
//     total: number;
//     page: number;
//     totalPages: number;
//   }> {
//     try {
//       const query: any = {};
      
//       if (options.status) {
//         query.status = options.status;
//       }
      
//       if (options.isVerified !== undefined) {
//         query.isVerified = options.isVerified;
//       }
      
//       const skip = (options.page - 1) * options.limit;
      
//       const [responders, total] = await Promise.all([
//         Responder.find(query)
//           .populate('userId', 'firstName lastName email phone profileImage')
//           .sort({ rating: -1, isVerified: -1, createdAt: -1 })
//           .skip(skip)
//           .limit(options.limit)
//           .lean(),
//         Responder.countDocuments(query),
//       ]);
      
//       const totalPages = Math.ceil(total / options.limit);
      
//       return {
//         responders,
//         total,
//         page: options.page,
//         totalPages,
//       };
//     } catch (error: any) {
//       logger.error('Get all responders error:', error);
//       throw error;
//     }
//   }
  
//   static async verifyResponder(
//     responderId: string,
//     isVerified: boolean,
//     verificationNotes?: string
//   ): Promise<IResponder | null> {
//     try {
//       const responder = await Responder.findByIdAndUpdate(
//         responderId,
//         { 
//           $set: { 
//             isVerified,
//             verificationNotes,
//             verifiedAt: isVerified ? new Date() : null,
//           } 
//         },
//         { new: true }
//       ).populate('userId', 'firstName lastName email');
      
//       if (!responder) {
//         throw new Error('Responder not found');
//       }
      
//       // Send notification to responder
//       if (isVerified) {
//         logger.info(`Responder verified: ${responderId}`);
//         // TODO: Send verification notification
//       }
      
//       return responder;
//     } catch (error: any) {
//       logger.error('Verify responder error:', error);
//       throw error;
//     }
//   }
  
//   private static getDefaultAvailability() {
//     return {
//       monday: Array(24).fill(true),
//       tuesday: Array(24).fill(true),
//       wednesday: Array(24).fill(true),
//       thursday: Array(24).fill(true),
//       friday: Array(24).fill(true),
//       saturday: Array(24).fill(true),
//       sunday: Array(24).fill(true),
//     };
//   }
// }

// export default ResponderAuthService;