import mongoose from 'mongoose';
import Alert, { IAlert } from '../models/alert.model';
import User from '../models/user.model';
import ResponderAvailability from '../models/responderAvailability.model';
import GeocodingService from './geocoding.service';
import LocationService from './location.service';
import config from '../config/env';
import logger from '../utils/logger';
import NotificationService from './notification.service';

export interface CreateAlertData {
  userId: string;
  type: 'panic' | 'fall-detection' | 'timer-expired';
  location: {
    coordinates: [number, number];
    accuracy: number;
  };
  fallDetectionData?: {
    acceleration: number;
    timestamp: Date;
  };
  deviceInfo?: {
    batteryLevel?: number;
    osVersion?: string;
    appVersion?: string;
  };
}

export interface NearbyResponder {
  responderId: string;
  distance: number;
  status: string;
}

// Define the exact type for assigned responders
export type AssignedResponder = {
  responderId: mongoose.Types.ObjectId;
  assignedAt: Date;
  status: 'assigned' | 'enroute' | 'on-scene';
  arrivedAt?: Date;
};

export class AlertService {
  static async createAlert(data: CreateAlertData): Promise<IAlert> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Get user details
      const user = await User.findById(data.userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Create alert
      const alert = new Alert({
        userId: data.userId,
        type: data.type,
        location: {
          type: 'Point',
          coordinates: data.location.coordinates,
          accuracy: data.location.accuracy,
        },
        fallDetectionData: data.fallDetectionData,
        status: 'active',
      });

      await alert.save({ session });

      // Update user's last known location
      user.lastKnownLocation = {
        type: 'Point',
        coordinates: data.location.coordinates,
        timestamp: new Date(),
        accuracy: data.location.accuracy,
      };
      await user.save({ session });

      // Find and assign nearby responders
      const assignedResponders = await this.assignNearbyResponders(
        alert,
        data.location.coordinates
      );

      // Type assertion to match IAlert's expected type
      alert.assignedResponders = assignedResponders as any;
      await alert.save({ session });

      // Send notifications
      await NotificationService.sendEmergencyNotifications(alert, user);

      await session.commitTransaction();

      logger.info(`Alert created: ${alert._id} for user: ${data.userId}`);

      return alert;
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Create alert error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async assignNearbyResponders(
    alert: IAlert,
    location: [number, number]
  ): Promise<AssignedResponder[]> {
    try {
      const [longitude, latitude] = location;

      // Find available responders within radius
      const responders = await ResponderAvailability.aggregate([
        {
          $match: {
            status: 'available',
            isActive: true,
            currentLocation: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [longitude, latitude],
                },
                $maxDistance: config.geolocation.maxResponseDistanceKm * 1000, // Convert to meters
              },
            },
          },
        },
        {
          $sort: {
            lastPing: -1, // Most recently active first
          },
        },
        {
          $limit: 5, // Assign to up to 5 responders
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
      ]);

      const assignedResponders: AssignedResponder[] = responders.map((responder) => ({
        responderId: responder.responderId,
        assignedAt: new Date(),
        status: 'assigned' as const, // Use 'as const' to fix the type
      }));

      // Update responder statuses
      await ResponderAvailability.updateMany(
        {
          responderId: { $in: responders.map(r => r.responderId) },
        },
        {
          $set: {
            status: 'busy',
            assignedAlertId: alert._id,
          },
        }
      );

      return assignedResponders;
    } catch (error: any) {
      logger.error('Assign responders error:', error);
      return [];
    }
  }

  static async updateAlertStatus(
    alertId: string,
    status: 'acknowledged' | 'resolved' | 'cancelled',
    responderId?: string
  ): Promise<IAlert | null> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const updateData: any = { status };
      
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      const alert = await Alert.findByIdAndUpdate(
        alertId,
        { $set: updateData },
        { new: true, session }
      );

      if (!alert) {
        throw new Error('Alert not found');
      }

      // If responder is acknowledging the alert
      if (responderId && status === 'acknowledged') {
        await this.updateResponderAlertStatus(alertId, responderId, 'enroute');
      }

      // If alert is resolved, free up responders
      if (status === 'resolved' || status === 'cancelled') {
        await this.freeResponders(alertId);
      }

      await session.commitTransaction();
      return alert;
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Update alert status error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async updateResponderAlertStatus(
    alertId: string,
    responderId: string,
    status: 'assigned' | 'enroute' | 'on-scene'
  ): Promise<void> {
    try {
      await Alert.updateOne(
        {
          _id: alertId,
          'assignedResponders.responderId': responderId,
        },
        {
          $set: {
            'assignedResponders.$.status': status,
          },
        }
      );

      if (status === 'on-scene') {
        await Alert.updateOne(
          { _id: alertId, 'assignedResponders.responderId': responderId },
          {
            $set: {
              'assignedResponders.$.arrivedAt': new Date(),
            },
          }
        );
      }
    } catch (error: any) {
      logger.error('Update responder alert status error:', error);
      throw error;
    }
  }

  static async freeResponders(alertId: string): Promise<void> {
    try {
      // Get alert to find assigned responders
      const alert = await Alert.findById(alertId);
      if (!alert) return;

      const responderIds = alert.assignedResponders.map(r => r.responderId);

      // Update responder availability
      await ResponderAvailability.updateMany(
        {
          responderId: { $in: responderIds },
        },
        {
          $set: {
            status: 'available',
            assignedAlertId: null,
          },
        }
      );
    } catch (error: any) {
      logger.error('Free responders error:', error);
      throw error;
    }
  }

  static async getActiveAlerts(
    filters?: {
      type?: string;
      status?: string;
      location?: {
        coordinates: [number, number];
        radius: number;
      };
    }
  ): Promise<IAlert[]> {
    try {
      const query: any = {};

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.type) {
        query.type = filters.type;
      }

      if (filters?.location) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: filters.location.coordinates,
            },
            $maxDistance: filters.location.radius * 1000,
          },
        };
      }

      const alerts = await Alert.find(query)
        .populate('userId', 'firstName lastName phone email profileImage')
        .populate('assignedResponders.responderId', 'firstName lastName phone')
        .sort({ createdAt: -1 })
        .limit(100);

      return alerts;
    } catch (error: any) {
      logger.error('Get active alerts error:', error);
      throw error;
    }
  }

  static async getUserAlerts(userId: string): Promise<IAlert[]> {
    try {
      const alerts = await Alert.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('assignedResponders.responderId', 'firstName lastName phone');

      return alerts;
    } catch (error: any) {
      logger.error('Get user alerts error:', error);
      throw error;
    }
  }

  static async addMessage(
    alertId: string,
    senderId: string,
    content: string,
    type: 'text' | 'system' = 'text'
  ): Promise<IAlert | null> {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          $push: {
            messages: {
              senderId,
              content,
              type,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      return alert;
    } catch (error: any) {
      logger.error('Add message error:', error);
      throw error;
    }
  }
}

export default AlertService;