import mongoose from 'mongoose';
import Alert from '../models/alert.model';
import Responder from '../models/responder.model';
import User from '../models/user.model';
import LocationHistory from '../models/locationHistory.model';
import GeocodingServiceInstance from '../services/geocoding.service';
import { GeocodingService } from '../services/geocoding.service'
import logger from '../utils/logger';

export interface LocationUpdate {
  userId: string;
  coordinates: [number, number];
  accuracy: number;
  alertId?: string;
  isResponder?: boolean;
}

export interface LiveTrackingData {
  userLocation?: {
    coordinates: [number, number];
    address?: string;
    timestamp: Date;
    accuracy: number;
  };
  responderLocation?: {
    coordinates: [number, number];
    address?: string;
    timestamp: Date;
    accuracy: number;
  };
  distance?: number; // in km
  estimatedArrival?: string;
  lastUpdated: Date;
  staticMapUrl?: string;
}

export class LocationUpdateService {
  
  static async updateUserLocation(data: LocationUpdate): Promise<{
    updated: boolean;
    alertUpdated?: boolean;
    geocodedAddress?: string;
  }> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const [longitude, latitude] = data.coordinates;
      
      // 1. Update user's last known location
      await User.findByIdAndUpdate(
        data.userId,
        {
          $set: {
            lastKnownLocation: {
              type: 'Point',
              coordinates: data.coordinates,
              timestamp: new Date(),
              accuracy: data.accuracy,
            },
          },
        },
        { session }
      );
      
      // 2. Save to location history
      await LocationHistory.create([{
        userId: data.userId,
        coordinates: data.coordinates,
        accuracy: data.accuracy,
        alertId: data.alertId,
        timestamp: new Date(),
      }], { session });
      
      let alertUpdated = false;
      let geocodedAddress;
      
      // 3. If this is for an active alert, update alert tracking
      if (data.alertId) {
        const alert = await Alert.findById(data.alertId).session(session);

        if (!alert) {
            throw new Error('Alert not found')
        }
        
        if (alert && alert.status === 'active' || alert.status === 'acknowledged' || alert.status === 'cancelled') {
          // Reverse geocode for better location info
          try {
            const addressData = await GeocodingServiceInstance.reverseGeocode({
              latitude,
              longitude,
            });
            
            geocodedAddress = addressData?.formattedAddress;
            
            // Update alert with user location
            await Alert.findByIdAndUpdate(
              data.alertId,
              {
                $set: {
                  'tracking.lastUserLocation': data.coordinates,
                  'tracking.lastUpdated': new Date(),
                },
              },
              { session }
            );
            
            alertUpdated = true;
            
            // 4. Notify assigned responder about location update
            // if (alert.assignedResponder?.responderId && alert.assignedResponder.status !== 'cancelled') {
            if (alert.assignedResponder?.responderId && alert.status !== 'cancelled') {
              await this.notifyResponderOfLocationUpdate(
                alert.assignedResponder.responderId.toString(),
                alert._id.toString(),
                data.coordinates,
                geocodedAddress
              );
            }
            
          } catch (error) {
            logger.warn('Geocoding failed during location update:', error);
          }
        }
      }
      
      await session.commitTransaction();
      
      logger.debug(`User location updated: ${data.userId}`, {
        coordinates: data.coordinates,
        accuracy: data.accuracy,
        alertId: data.alertId,
      });
      
      return {
        updated: true,
        alertUpdated,
        geocodedAddress,
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Update user location service error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  static async updateResponderLocation(data: LocationUpdate): Promise<{
    updated: boolean;
    alertUpdated?: boolean;
    responderStatus?: string;
  }> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // 1. Update responder's current location
      const responder = await Responder.findOneAndUpdate(
        { userId: data.userId },
        {
          $set: {
            'currentLocation.coordinates': data.coordinates,
            'currentLocation.updatedAt': new Date(),
            lastPing: new Date(),
          },
        },
        { new: true, session, upsert: true }
      );
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      // 2. Save to location history
      await LocationHistory.create([{
        userId: data.userId,
        coordinates: data.coordinates,
        accuracy: data.accuracy,
        alertId: data.alertId,
        timestamp: new Date(),
        isResponder: true,
      }], { session });
      
      let alertUpdated = false;
      
      // 3. If this is for an assigned alert, update alert tracking
      if (data.alertId) {
        const alert = await Alert.findById(data.alertId).session(session);
        
        if (alert && alert.assignedResponder?.responderId?.toString() === data.userId) {
          await Alert.findByIdAndUpdate(
            data.alertId,
            {
              $set: {
                'tracking.lastResponderLocation': data.coordinates,
                'tracking.lastUpdated': new Date(),
              },
            },
            { session }
          );
          
          alertUpdated = true;
          
          // 4. Calculate and notify user of distance
          if (alert.tracking?.lastUserLocation) {
            await this.notifyUserOfResponderProximity(
              alert.userId.toString(),
              alert._id.toString(),
              data.coordinates,
              alert.tracking.lastUserLocation
            );
          }
        }
      }
      
      await session.commitTransaction();
      
      logger.debug(`Responder location updated: ${data.userId}`, {
        coordinates: data.coordinates,
        alertId: data.alertId,
      });
      
      return {
        updated: true,
        alertUpdated,
        responderStatus: responder.status,
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Update responder location service error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  static async getLiveTracking(
    alertId: string,
    requestingUserId: string
  ): Promise<LiveTrackingData> {
    try {
      const alert = await Alert.findById(alertId)
        .populate('userId', 'fullName')
        .populate('assignedResponder.responderId', 'fullName vehicleType');
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check permissions
      const isUser = alert.userId._id.toString() === requestingUserId;
      const isAssignedResponder = alert.assignedResponder?.responderId?._id.toString() === requestingUserId;
      const isAdmin = false; // Check from user role
      
      if (!isUser && !isAssignedResponder && !isAdmin) {
        throw new Error('Not authorized to view tracking data');
      }
      
      const result: LiveTrackingData = {
        lastUpdated: alert.tracking?.lastUpdated || alert.updatedAt,
      };
      
      // Get user location data
      if (alert.tracking?.lastUserLocation) {
        const [lng, lat] = alert.tracking.lastUserLocation;
        
        try {
          const address = await GeocodingServiceInstance.reverseGeocode({ latitude: lat, longitude: lng });
          
          result.userLocation = {
            coordinates: alert.tracking.lastUserLocation,
            address: address?.formattedAddress,
            timestamp: alert.tracking.lastUpdated || alert.updatedAt,
            accuracy: alert.location.accuracy,
          };
        } catch (error) {
          result.userLocation = {
            coordinates: alert.tracking.lastUserLocation,
            timestamp: alert.tracking.lastUpdated || alert.updatedAt,
            accuracy: alert.location.accuracy,
          };
        }
      }
      
      // Get responder location data
      if (alert.tracking?.lastResponderLocation) {
        const [lng, lat] = alert.tracking.lastResponderLocation;
        
        try {
          const address = await GeocodingServiceInstance.reverseGeocode({ latitude: lat, longitude: lng });
          
          result.responderLocation = {
            coordinates: alert.tracking.lastResponderLocation,
            address: address?.formattedAddress,
            timestamp: alert.tracking.lastUpdated || alert.updatedAt,
            accuracy: 15, // Default responder accuracy
          };
        } catch (error) {
          result.responderLocation = {
            coordinates: alert.tracking.lastResponderLocation,
            timestamp: alert.tracking.lastUpdated || alert.updatedAt,
            accuracy: 15,
          };
        }
      }
      
      // Calculate distance if both locations available
      if (result.userLocation && result.responderLocation) {
        const [userLng, userLat] = result.userLocation.coordinates;
        const [respLng, respLat] = result.responderLocation.coordinates;
        
        try {
          // const distance = GeocodingService.calculateDistance(
          //   { latitude: userLat, longitude: userLng },
          //   { latitude: respLat, longitude: respLng },
          //   'km'
          // );

          const distance = GeocodingService.calculateDistance(userLat, userLng, respLat, respLng)
          
          result.distance = distance;
          
          // Calculate estimated arrival based on vehicle type
          if (alert.assignedResponder?.responderId && 
              (alert.assignedResponder.responderId as any).vehicleType) {
            
            const vehicleType = (alert.assignedResponder.responderId as any).vehicleType;
            const avgSpeed = this.getAverageSpeed(vehicleType);
            
            if (avgSpeed > 0 && distance > 0) {
              const estimatedTimeHours = distance / avgSpeed;
              const estimatedMinutes = Math.ceil(estimatedTimeHours * 60);
              
              result.estimatedArrival = estimatedMinutes <= 60 
                ? `${estimatedMinutes} minutes`
                : `${Math.ceil(estimatedTimeHours)} hours`;
            }
          }
        } catch (error) {
          logger.warn('Failed to calculate distance:', error);
        }
      }
      
      // Generate static map URL
      if (result.userLocation) {
        const [lng, lat] = result.userLocation.coordinates;
        
        const markers = [];
        markers.push({
          coordinates: { latitude: lat, longitude: lng },
          label: 'U',
          color: 'blue',
        });
        
        if (result.responderLocation) {
          const [respLng, respLat] = result.responderLocation.coordinates;
          markers.push({
            coordinates: { latitude: respLat, longitude: respLng },
            label: 'R',
            color: 'green',
          });
        }
        
        result.staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
          { latitude: lat, longitude: lng },
          markers,
          14,
          '600x400'
        );
      }
      
      return result;
    } catch (error: any) {
      logger.error('Get live tracking error:', error);
      throw error;
    }
  }
  
  private static async notifyResponderOfLocationUpdate(
    responderId: string,
    _alertId: string,
    userCoordinates: [number, number],
    _address?: string
  ): Promise<void> {
    try {
      const [lng, lat] = userCoordinates;
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude: lat, longitude: lng },
        [{
          coordinates: { latitude: lat, longitude: lng },
          label: '📍',
          color: 'blue',
        }],
        16,
        '400x300'
      );
      
    //   await NotificationService.sendToResponder(responderId, {
    //     type: 'location_update',
    //     title: '📍 User Location Updated',
    //     body: `User's location has been updated${address ? `: ${address.substring(0, 50)}` : ''}`,
    //     data: {
    //       alertId,
    //       coordinates: userCoordinates,
    //       address,
    //       staticMapUrl,
    //       timestamp: new Date().toISOString(),
    //     },
    //   });
      
      logger.info(`Notified responder ${responderId} of user location update`);
      logger.info('Static Map URL:', staticMapUrl)
    } catch (error) {
      logger.error('Failed to notify responder of location update:', error);
    }
  }
  
  private static async notifyUserOfResponderProximity(
    _userId: string,
    _alertId: string,
    responderCoordinates: [number, number],
    userCoordinates: [number, number]
  ): Promise<void> {
    try {
      const [userLng, userLat] = userCoordinates;
      const [respLng, respLat] = responderCoordinates;
      
      // Calculate distance
      // const distance = GeocodingService.calculateDistance(
      //   { latitude: userLat, longitude: userLng },
      //   { latitude: respLat, longitude: respLng },
      //   'km'
      // );

      const distance = GeocodingService.calculateDistance(userLat, userLng, respLat, respLng)
      
      if (distance < 1) { // Within 1km
        const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
          { latitude: userLat, longitude: userLng },
          [
            {
              coordinates: { latitude: userLat, longitude: userLng },
              label: 'U',
              color: 'blue',
            },
            {
              coordinates: { latitude: respLat, longitude: respLng },
              label: 'R',
              color: 'green',
            },
          ],
          15,
          '400x300'
        );
        
        // await NotificationService.sendToUser(userId, {
        //   type: 'responder_proximity',
        //   title: '🚑 Responder Nearby',
        //   body: `Responder is ${distance.toFixed(1)}km away and approaching`,
        //   data: {
        //     alertId,
        //     distance: distance.toFixed(1),
        //     staticMapUrl,
        //     timestamp: new Date().toISOString(),
        //   },
        // });
        logger.info('Static Map URL:', staticMapUrl)
      }
    } catch (error) {
      logger.error('Failed to notify user of responder proximity:', error);
    }
  }
  
  private static getAverageSpeed(vehicleType: string): number {
    switch (vehicleType) {
      case 'car': return 30; // km/h in urban area
      case 'motorcycle': return 35;
      case 'bicycle': return 15;
      case 'foot': return 5;
      case 'ambulance': return 40; // with sirens
      default: return 20;
    }
  }
}

export default LocationUpdateService;