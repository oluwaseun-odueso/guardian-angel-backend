import ResponderAvailability, { IResponderAvailability } from '../models/responderAvailability.model';
import User from '../models/user.model';
import logger from '../utils/logger';

export interface ResponderLocation {
  coordinates: [number, number];
  accuracy: number;
}

export interface NearbyResponder {
  responderId: string;
  distance: number;
  status: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export class ResponderService {
  static async registerResponder(userId: string): Promise<IResponderAvailability> {
    try {
      // Check if user exists and has responder role
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'responder') {
        throw new Error('User is not a responder');
      }

      // Create or update responder availability
      const responder = await ResponderAvailability.findOneAndUpdate(
        { responderId: userId },
        {
          responderId: userId,
          status: 'available',
          isActive: true,
          lastPing: new Date(),
        },
        { upsert: true, new: true }
      ).populate('responderId', 'firstName lastName phone email');

      logger.info(`Responder registered: ${userId}`);
      return responder;
    } catch (error: any) {
      logger.error('Register responder error:', error);
      throw error;
    }
  }

  static async updateResponderStatus(
    responderId: string,
    status: 'available' | 'busy' | 'offline'
  ): Promise<IResponderAvailability | null> {
    try {
      const responder = await ResponderAvailability.findOneAndUpdate(
        { responderId },
        {
          status,
          lastPing: new Date(),
        },
        { new: true }
      ).populate('responderId', 'firstName lastName phone');

      if (!responder) {
        throw new Error('Responder not found');
      }

      logger.info(`Responder ${responderId} status updated to ${status}`);
      return responder;
    } catch (error: any) {
      logger.error('Update responder status error:', error);
      throw error;
    }
  }

  static async updateResponderLocation(
    responderId: string,
    coordinates: [number, number],
    _accuracy: number
  ): Promise<IResponderAvailability | null> {
    try {
      const responder = await ResponderAvailability.findOneAndUpdate(
        { responderId },
        {
          currentLocation: {
            type: 'Point',
            coordinates,
            updatedAt: new Date(),
          },
          lastPing: new Date(),
        },
        { new: true }
      );

      return responder;
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      throw error;
    }
  }

  static async findNearbyResponders(
    coordinates: [number, number],
    maxDistanceKm: number = 5,
    limit: number = 10
  ): Promise<NearbyResponder[]> {
    try {
      const [longitude, latitude] = coordinates;

      const responders = await ResponderAvailability.aggregate([
        {
          $match: {
            status: 'available',
            isActive: true,
            currentLocation: {
              $ne: null,
            },
          },
        },
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            distanceField: 'distance',
            maxDistance: maxDistanceKm * 1000, // Convert to meters
            spherical: true,
          },
        },
        {
          $sort: {
            distance: 1,
          },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'responderId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            responderId: 1,
            distance: 1,
            status: 1,
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            phone: '$user.phone',
          },
        },
      ]);

      return responders;
    } catch (error: any) {
      logger.error('Find nearby responders error:', error);
      throw error;
    }
  }

  static async getResponderStats(): Promise<{
    total: number;
    available: number;
    busy: number;
    offline: number;
  }> {
    try {
      const stats = await ResponderAvailability.aggregate([
        {
          $match: {
            isActive: true,
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        total: 0,
        available: 0,
        busy: 0,
        offline: 0,
      };

      stats.forEach((stat) => {
        if (stat._id in result) {
          result[stat._id as keyof typeof result] = stat.count;
        }
        result.total += stat.count;
      });

      return result;
    } catch (error: any) {
      logger.error('Get responder stats error:', error);
      throw error;
    }
  }

  static async updateLastPing(responderId: string): Promise<void> {
    try {
      await ResponderAvailability.updateOne(
        { responderId },
        {
          lastPing: new Date(),
        }
      );
    } catch (error: any) {
      logger.error('Update last ping error:', error);
      throw error;
    }
  }

  static async deactivateResponder(responderId: string): Promise<void> {
    try {
      await ResponderAvailability.findOneAndUpdate(
        { responderId },
        {
          status: 'offline',
          isActive: false,
        }
      );

      logger.info(`Responder deactivated: ${responderId}`);
    } catch (error: any) {
      logger.error('Deactivate responder error:', error);
      throw error;
    }
  }
}

export default ResponderService;