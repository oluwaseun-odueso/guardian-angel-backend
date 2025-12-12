import mongoose from 'mongoose';
import LocationHistory from '../models/locationHistory.model';
import User from '../models/user.model';
import GeoUtils from '../utils/geospatial';
import logger from '../utils/logger';

export interface LocationUpdate {
  userId: string;
  coordinates: [number, number];
  accuracy: number;
  batteryLevel?: number;
  alertId?: string;
}

export interface LocationHistoryRecord {
  userId: string;
  coordinates: [number, number];
  accuracy: number;
  timestamp: Date;
  batteryLevel?: number;
  alertId?: string;
}

export interface GeofenceCheck {
  isInside: boolean;
  trustedLocation?: {
    name: string;
    distance: number; // meters
  };
}

export class LocationService {
  static async updateUserLocation(data: LocationUpdate): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const { userId, coordinates, accuracy, batteryLevel, alertId } = data;
    //   const [longitude, latitude] = coordinates;

      // 1. Update user's last known location
      await User.findByIdAndUpdate(
        userId,
        {
          lastKnownLocation: {
            type: 'Point',
            coordinates,
            timestamp: new Date(),
            accuracy,
          },
        },
        { session }
      );

      // 2. Save to location history
      const locationHistory = new LocationHistory({
        userId,
        coordinates,
        accuracy,
        batteryLevel,
        alertId,
        timestamp: new Date(),
      });

      await locationHistory.save({ session });

      // 3. Check if user is in a trusted location (for auto-silencing alerts)
      const geofenceCheck = await this.checkGeofence(userId, coordinates);
      
      if (geofenceCheck.isInside) {
        logger.info(`User ${userId} is in trusted location: ${geofenceCheck.trustedLocation?.name}`);
        // Could trigger auto-silence of alerts here
      }

      await session.commitTransaction();

      logger.debug(`Location updated for user: ${userId}`);
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Update user location error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async checkGeofence(
    userId: string,
    coordinates: [number, number]
  ): Promise<GeofenceCheck> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.settings?.trustedLocations?.length) {
        return { isInside: false };
      }

      const [longitude, latitude] = coordinates;

      for (const location of user.settings.trustedLocations) {
        const distance = GeoUtils.calculateDistance(
          latitude,
          longitude,
          location.coordinates.coordinates[1],
          location.coordinates.coordinates[0]
        ) * 1000; // Convert to meters

        if (distance <= location.radius) {
          return {
            isInside: true,
            trustedLocation: {
              name: location.name,
              distance,
            },
          };
        }
      }

      return { isInside: false };
    } catch (error: any) {
      logger.error('Check geofence error:', error);
      return { isInside: false };
    }
  }

  static async getUserLocationHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<LocationHistoryRecord[]> {
    try {
      const query: any = { userId };
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      const history = await LocationHistory.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('coordinates accuracy batteryLevel alertId timestamp')
        .lean();

    return history.map((record: {
      coordinates: [number, number];
      accuracy: number;
      batteryLevel?: number;
      alertId?: any;
      timestamp: Date;
    }): LocationHistoryRecord => ({
      userId,
      coordinates: record.coordinates,
      accuracy: record.accuracy,
      batteryLevel: record.batteryLevel,
      alertId: record.alertId?.toString(),
      timestamp: record.timestamp,
    }));
    } catch (error: any) {
      logger.error('Get user location history error:', error);
      throw error;
    }
  }

  static async getAlertLocationHistory(
    alertId: string
  ): Promise<LocationHistoryRecord[]> {
    try {
      const history = await LocationHistory.find({ alertId })
        .sort({ timestamp: 1 })
        .select('userId coordinates accuracy batteryLevel timestamp')
        .populate('userId', 'firstName lastName')
        .lean();

      return history.map((record) => ({
        userId: record.userId._id.toString(),
        coordinates: record.coordinates,
        accuracy: record.accuracy,
        batteryLevel: record.batteryLevel,
        alertId,
        timestamp: record.timestamp,
      }));
    } catch (error: any) {
      logger.error('Get alert location history error:', error);
      throw error;
    }
  }

  static async calculateDistanceTraveled(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const locations = await LocationHistory.find({
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
      })
        .sort({ timestamp: 1 })
        .select('coordinates')
        .lean();

      if (locations.length < 2) {
        return 0;
      }

      let totalDistance = 0;

      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1].coordinates;
        const curr = locations[i].coordinates;
        
        const distance = GeoUtils.calculateDistance(
          prev[1], // latitude
          prev[0], // longitude
          curr[1],
          curr[0]
        );

        totalDistance += distance;
      }

      return totalDistance;
    } catch (error: any) {
      logger.error('Calculate distance traveled error:', error);
      throw error;
    }
  }

  static async getHeatmapData(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    coordinates: [number, number];
    intensity: number;
  }>> {
    try {
      const query: any = {
        coordinates: {
          $geoWithin: {
            $box: [
              [bounds.west, bounds.south],
              [bounds.east, bounds.north],
            ],
          },
        },
      };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      const locations = await LocationHistory.find(query)
        .select('coordinates')
        .lean();

      // Simple clustering for heatmap
      const clusters = new Map<string, number>();
      const precision = 3; // ~100m precision

      locations.forEach((location: { coordinates: [any, any]; }) => {
        const [lon, lat] = location.coordinates;
        const key = `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
        clusters.set(key, (clusters.get(key) || 0) + 1);
      });

      return Array.from(clusters.entries()).map(([key, intensity]) => {
        const [lat, lon] = key.split(',').map(Number);
        return {
          coordinates: [lon, lat],
          intensity,
        };
      });
    } catch (error: any) {
      logger.error('Get heatmap data error:', error);
      throw error;
    }
  }

  static async batchUpdateLocations(updates: LocationUpdate[]): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      for (const update of updates) {
        await this.updateUserLocation(update);
      }

      await session.commitTransaction();
      logger.info(`Batch updated ${updates.length} locations`);
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Batch update locations error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default LocationService;