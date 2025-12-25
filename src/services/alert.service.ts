import mongoose from 'mongoose';
import Alert, { IAlert } from '../models/alert.model';
import Responder from '../models/responder.model';
import User from '../models/user.model';
import LocationHistory from '../models/locationHistory.model';
import GeocodingServiceInstance from '../services/geocoding.service';
import { GeocodingService } from '../services/geocoding.service'
import logger from '../utils/logger';

export class AlertService {
  // static async createManualAlert(
  //   userId: string,
  //   responderId: string,
  //   location: { coordinates: [number, number]; accuracy: number }
  // ) {
  //   const session = await mongoose.startSession();
    
  //   try {
  //     session.startTransaction();
      
  //     const [latitude, longitude] = location.coordinates;
      
  //     // 1. Get user details
  //     const user = await User.findById(userId).session(session);
  //     if (!user) {
  //       throw new Error('User not found');
  //     }
      
  //     // 2. Check responder availability
  //     const responder = await Responder.findOne({
  //       userId: responderId,
  //       status: 'available',
  //       isActive: true,
  //       isVerified: true,
  //     }).session(session);
      
  //     if (!responder) {
  //       throw new Error('Selected responder is not available');
  //     }
      
  //     // 3. Calculate distance if responder has location
  //     let distance: number | undefined;
  //     let routeInfo: any;
      
  //     if (responder.currentLocation?.coordinates) {
  //       const [respLat, respLng] = responder.currentLocation.coordinates;
  //       console.log("respLng", respLng)
  //       console.log("respLat", respLat)
  //       console.log('A')
        
  //       distance = GeocodingService.calculateDistance(
  //         latitude,
  //         longitude,
  //         respLat,
  //         respLng
  //       );

  //       console.log("Distance:", distance)

  //       if (!distance) {
  //         throw new Error('Distance calculation failed')
  //       }
        
  //       // Check if within responder's max distance
  //       if (distance > responder.maxDistance) {
  //         throw new Error(`Responder is ${distance.toFixed(1)}km away, outside their maximum range of ${responder.maxDistance}km`);
  //       }
        
  //       // Get route information
  //       routeInfo = await GeocodingServiceInstance.getRoute(
  //         { latitude: respLat, longitude: respLng },
  //         { latitude, longitude },
  //         responder.vehicleType === 'car' ? 'driving' : 
  //         responder.vehicleType === 'bicycle' ? 'bicycling' : 'walking'
  //       );
  //     }
      
  //     // 4. Geocode the location
  //     const geocodedAddress = await GeocodingServiceInstance.reverseGeocode({
  //       latitude,
  //       longitude,
  //     });
      
  //     // 5. Generate static map
  //     const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
  //       { latitude, longitude },
  //       [
  //         {
  //           coordinates: { latitude, longitude },
  //           label: '📍',
  //           color: 'blue',
  //         },
  //       ],
  //       14,
  //       '600x400'
  //     );
      
  //     // 6. Create the alert
  //     const alert = await Alert.create([{
  //       userId,
  //       type: 'manual',
  //       status: 'active',
  //       location: {
  //         type: 'Point',
  //         coordinates: location.coordinates,
  //         accuracy: location.accuracy,
  //         address: geocodedAddress?.formattedAddress,
  //         geocodedData: geocodedAddress,
  //         staticMapUrl,
  //       },
  //       assignedResponder: {
  //         responderId: responder.userId,
  //         assignedAt: new Date(),
  //         status: 'assigned',
  //         estimatedDistance: distance,
  //         routeInfo: routeInfo ? {
  //           distance: routeInfo.distance,
  //           duration: routeInfo.duration,
  //           estimatedArrival: new Date(Date.now() + routeInfo.duration.value * 1000),
  //         } : undefined,
  //       },
  //       tracking: {
  //         lastUserLocation: location.coordinates,
  //         lastUpdated: new Date(),
  //       },
  //     }], { session });
      
  //     // 7. Update responder status
  //     responder.status = 'busy';
  //     responder.assignedAlertId = alert[0]._id;
  //     await responder.save({ session });
      
  //     // 8. Save initial location to history
  //     await LocationHistory.create([{
  //       userId,
  //       coordinates: location.coordinates,
  //       accuracy: location.accuracy,
  //       alertId: alert[0]._id,
  //       address: geocodedAddress?.formattedAddress,
  //       timestamp: new Date(),
  //     }], { session });
      
  //     await session.commitTransaction();
      
  //     logger.info(`Manual alert created: ${alert[0]._id} for user ${userId}, assigned to responder ${responderId}`);
      
  //     return {
  //       alert: alert[0],
  //       distance,
  //       estimatedTime: routeInfo?.duration.text,
  //       locationDetails: {
  //         address: geocodedAddress?.formattedAddress,
  //         staticMapUrl,
  //       },
  //     };
  //   } catch (error) {
  //     await session.abortTransaction();
  //     logger.error('Manual alert creation error:', error);
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  static async createManualAlert(
    userId: string,
    responderId: string,
    location: { coordinates: [number, number]; accuracy: number }
  ) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const [latitude, longitude] = location.coordinates;
      
      // 1. Get user details
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }
      
      // 2. Check responder availability
      const responder = await Responder.findOne({
        userId: responderId,
        status: 'available',
        isActive: true,
        isVerified: true,
      }).session(session);
      
      if (!responder) {
        throw new Error('Selected responder is not available');
      }
      
      // 3. Calculate distance if responder has location
      let distance: number | undefined;
      let routeInfo: any;
      let isSameLocation = false;
      
      if (responder.currentLocation?.coordinates) {
        const [respLat, respLng] = responder.currentLocation.coordinates;
        console.log("Responder coordinates:", respLat, respLng);
        console.log("User coordinates:", latitude, longitude);
        
        distance = GeocodingService.calculateDistance(
          latitude,
          longitude,
          respLat,
          respLng
        );

        console.log("Calculated distance:", distance);
        
        if (distance === undefined || distance === null) {
          throw new Error('Distance calculation failed');
        }
        
        // Check if distance is effectively 0 (same location)
        isSameLocation = distance < 0.001; // Less than 1 meter
        
        // Check if within responder's max distance
        if (distance > responder.maxDistance && !isSameLocation) {
          throw new Error(`Responder is ${distance.toFixed(1)}km away, outside their maximum range of ${responder.maxDistance}km`);
        }
        
        // Only get route info if locations are different
        if (!isSameLocation && distance > 0) {
          try {
            routeInfo = await GeocodingServiceInstance.getRoute(
              { latitude: respLat, longitude: respLng },
              { latitude, longitude },
              responder.vehicleType === 'car' ? 'driving' : 
              responder.vehicleType === 'bicycle' ? 'bicycling' : 'walking'
            );
            
            if (!routeInfo) {
              console.warn('Route info could not be retrieved, using fallback estimates');
              // Create fallback route info based on distance
              routeInfo = this.createFallbackRouteInfo(distance, responder.vehicleType);
            }
          } catch (routeError) {
            console.warn('Failed to get route info:', routeError);
            // Create fallback route info
            routeInfo = this.createFallbackRouteInfo(distance, responder.vehicleType);
          }
        } else if (isSameLocation) {
          // Create immediate arrival route info for same location
          routeInfo = {
            distance: { text: '0 km', value: 0 },
            duration: { text: 'Immediate', value: 0 },
            polyline: undefined
          };
        }
      }
      
      // 4. Geocode the location
      const geocodedAddress = await GeocodingServiceInstance.reverseGeocode({
        latitude,
        longitude,
      });
      
      // 5. Generate static map
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude, longitude },
        [
          {
            coordinates: { latitude, longitude },
            label: '📍',
            color: 'blue',
          },
        ],
        14,
        '600x400'
      );
      
      // 6. Create the alert
      const alert = await Alert.create([{
        userId,
        type: 'manual',
        status: 'active',
        location: {
          type: 'Point',
          coordinates: location.coordinates,
          accuracy: location.accuracy,
          address: geocodedAddress?.formattedAddress,
          geocodedData: geocodedAddress,
          staticMapUrl,
        },
        assignedResponder: {
          responderId: responder.userId,
          assignedAt: new Date(),
          status: isSameLocation ? 'on-scene' : 'assigned', // If same location, responder is already there
          acknowledgedAt: isSameLocation ? new Date() : undefined, // Auto-acknowledge if same location
          estimatedDistance: distance,
          routeInfo: routeInfo ? {
            distance: routeInfo.distance,
            duration: routeInfo.duration,
            estimatedArrival: isSameLocation ? new Date() : new Date(Date.now() + (routeInfo.duration?.value || 0) * 1000),
          } : undefined,
        },
        tracking: {
          lastUserLocation: location.coordinates,
          lastUpdated: new Date(),
        },
      }], { session });
      
      // 7. Update responder status
      responder.status = 'busy';
      responder.assignedAlertId = alert[0]._id;
      
      // If same location, update responder's location to match alert location
      if (isSameLocation) {
        responder.currentLocation = {
          type: 'Point',
          coordinates: location.coordinates,
          updatedAt: new Date(),
        };
      }
      
      await responder.save({ session });
      
      // 8. Save initial location to history
      await LocationHistory.create([{
        userId,
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        alertId: alert[0]._id,
        address: geocodedAddress?.formattedAddress,
        timestamp: new Date(),
      }], { session });
      
      // 9. If same location, auto-acknowledge the alert
      if (isSameLocation) {
        await Alert.findByIdAndUpdate(
          alert[0]._id,
          {
            $set: {
              status: 'acknowledged',
              'assignedResponder.status': 'on-scene',
              'assignedResponder.acknowledgedAt': new Date(),
            },
          },
          { session }
        );
      }
      
      await session.commitTransaction();
      
      logger.info(`Manual alert created: ${alert[0]._id} for user ${userId}, assigned to responder ${responderId}, distance: ${distance}km, sameLocation: ${isSameLocation}`);
      
      return {
        alert: alert[0],
        distance,
        isSameLocation,
        estimatedTime: isSameLocation ? 'Immediate' : routeInfo?.duration?.text,
        locationDetails: {
          address: geocodedAddress?.formattedAddress,
          staticMapUrl,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Manual alert creation error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Add this helper method to create fallback route info
  private static createFallbackRouteInfo(distance: number, vehicleType?: string): {
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  } {
    // Average speeds based on vehicle type (km/h)
    const averageSpeeds: Record<string, number> = {
      'car': 40,
      'motorcycle': 50,
      'bicycle': 15,
      'foot': 5,
      'ambulance': 60,
      'default': 30
    };
  
    const speed = averageSpeeds[vehicleType || 'default'] || averageSpeeds.default;
    const durationHours = distance / speed;
    const durationMinutes = Math.ceil(durationHours * 60);
    
    return {
      distance: {
        text: `${distance.toFixed(1)} km`,
        value: distance * 1000 // Convert to meters
      },
      duration: {
        text: durationMinutes > 60 
          ? `${Math.ceil(durationHours)} hours`
          : `${durationMinutes} minutes`,
        value: durationMinutes * 60 // Convert to seconds
      }
    };
  }
    
  static async createPanicAlert(
    userId: string,
    location: { coordinates: [number, number]; accuracy: number }
  ) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const [latitude, longitude] = location.coordinates;
      
      // 1. Get user details
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      console.log('User:', user)
      
      // 2. Find nearest available responders
      const nearestResponders = await GeocodingServiceInstance.findNearestResponders(
        { latitude, longitude },
        10, // 10km max distance
        5   // Get top 5
      );
      
      if (nearestResponders.length === 0) {
        throw new Error('No responders available in your area');
      }
      
      // 3. Select best responder (closest + highest rating)
      const bestResponder = nearestResponders
        .sort((a, b) => {
          // If within 1km, prioritize rating
          if (Math.abs(a.distance - b.distance) < 1) {
            return b.rating - a.rating;
          }
          return a.distance - b.distance;
        })[0];
      
      // 4. Get responder details
      const responder = await Responder.findOne({
        userId: bestResponder.responderId,
      }).session(session);
      
      if (!responder) {
        throw new Error('Selected responder not found');
      }
      
      // 5. Get route information
      let routeInfo: any;
      if (bestResponder.coordinates) {
        routeInfo = await GeocodingServiceInstance.getRoute(
          bestResponder.coordinates,
          { latitude, longitude },
          responder.vehicleType === 'car' ? 'driving' : 
          responder.vehicleType === 'bicycle' ? 'bicycling' : 'walking'
        );
      }
      
      // 6. Geocode the location
      const geocodedAddress = await GeocodingServiceInstance.reverseGeocode({
        latitude,
        longitude,
      });

      console.log("Geocoded Address:", geocodedAddress)
      
      const zoom = 14
      // 7. Generate static map
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude: parseFloat(latitude as unknown as string), longitude: parseFloat(longitude as unknown as string) },
        [
          {
            coordinates: { latitude, longitude },
            label: '📍',
            color: 'red',
          },
        ],
        parseInt(zoom as unknown as string),
        '600x400',
      );
      
      // 8. Create the alert
      const alert = await Alert.create([{
        userId,
        type: 'panic',
        status: 'active',
        location: {
          type: 'Point',
          coordinates: location.coordinates,
          accuracy: location.accuracy,
          address: geocodedAddress?.formattedAddress,
          geocodedData: geocodedAddress,
          staticMapUrl,
        },
        assignedResponder: {
          responderId: responder.userId,
          assignedAt: new Date(),
          status: 'assigned',
          estimatedDistance: bestResponder.distance,
          routeInfo: routeInfo ? {
            distance: routeInfo.distance,
            duration: routeInfo.duration,
            estimatedArrival: new Date(Date.now() + routeInfo.duration.value * 1000),
          } : undefined,
        },
        tracking: {
          lastUserLocation: location.coordinates,
          lastUpdated: new Date(),
        },
      }], { session });
      
      // 9. Update responder status
      responder.status = 'busy';
      responder.totalAssignments += 1
      responder.assignedAlertId = alert[0]._id;
      await responder.save({ session });
      
      // 10. Save to location history
      await LocationHistory.create([{
        userId,
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        alertId: alert[0]._id,
        address: geocodedAddress?.formattedAddress,
        timestamp: new Date(),
      }], { session });
      
      await session.commitTransaction();
      
      logger.info(`Panic alert created: ${alert[0]._id} for user ${userId}, auto-assigned to responder ${responder.userId}, distance: ${bestResponder.distance.toFixed(2)}km`);
      
      return {
        alert: alert[0],
        assignedResponder: {
          id: responder.userId,
          name: `${responder.fullName}`,
          distance: bestResponder.distance,
          estimatedTime: routeInfo?.duration.text,
          vehicleType: responder.vehicleType,
        },
        locationDetails: {
          address: geocodedAddress?.formattedAddress,
          staticMapUrl,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Panic alert creation error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // In createPanicAlert method, add this debug logging:
  // static async createPanicAlert(
  //   userId: string,
  //   location: { coordinates: [number, number]; accuracy: number }
  // ) {
  //   const session = await mongoose.startSession();
    
  //   try {
  //     session.startTransaction();
      
  //     const [longitude, latitude] = location.coordinates;
      
  //     // 1. Get user details
  //     const user = await User.findById(userId).session(session);
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     console.log('Creating panic alert at coordinates:', { latitude, longitude });
      
  //     // 2. First, check if any responders exist at all
  //     const allResponders = await Responder.find({}).session(session);
  //     console.log('Total responders in database:', allResponders.length);
  //     console.log('Responders details:', allResponders.map(r => ({
  //       id: r._id,
  //       userId: r.userId,
  //       status: r.status,
  //       isVerified: r.isVerified,
  //       currentLocation: r.currentLocation
  //     })));
      
  //     // 3. Check what findNearestResponders is returning
  //     console.log('Calling findNearestResponders...');
  //     const nearestResponders = await GeocodingServiceInstance.findNearestResponders(
  //       { latitude, longitude },
  //       100, // Increase max distance to 100km for testing
  //       10   // Get top 10
  //     );
      
  //     console.log('Nearest responders found:', nearestResponders.length);
  //     console.log('Nearest responders details:', nearestResponders);
      
  //     if (nearestResponders.length === 0) {
  //       // Check why no responders are found
  //       const availableResponders = await Responder.find({
  //         status: 'available',
  //         isActive: true,
  //         isVerified: true,
  //       }).session(session);
        
  //       console.log('Available responders in database:', availableResponders.length);
  //       console.log('Available responders details:', availableResponders.map(r => ({
  //         id: r._id,
  //         userId: r.userId,
  //         status: r.status,
  //         isVerified: r.isVerified,
  //         currentLocation: r.currentLocation
  //       })));
        
  //       throw new Error('No responders available in your area');
  //     }
      
  //     // ... rest of your code
  //   } catch (error) {
  //     await session.abortTransaction();
  //     logger.error('Panic alert creation error:', error);
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }
  
  static async getAvailableResponders(latitude?: number, longitude?: number) {
    try {
      let query: any = {
        status: 'available',
        isActive: true,
        isVerified: true,
      };
      
      const responders = await Responder.find(query)
        .populate('userId', 'fullName profileImage')
        .lean();
      
      // If location provided, calculate distances
      if (latitude !== undefined && longitude !== undefined) {
        const respondersWithDistance = await Promise.all(
          responders.map(async (responder) => {
            let distance: number | null = null;
            
            if (responder.currentLocation?.coordinates) {
              const [respLng, respLat] = responder.currentLocation.coordinates;
              distance = GeocodingService.calculateDistance(
                latitude,
                longitude,
                respLat,
                respLng
              );
            }
            
            return {
              ...responder,
              distance,
              isWithinRange: distance !== null && distance <= (responder.maxDistance || 10),
            };
          })
        );
        
        return respondersWithDistance.sort((a: { distance: number | null; }, b: { distance: number | null; }) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      }
      
      return responders;
    } catch (error: any) {
      logger.error('Get available responders error:', error);
      throw error;
    }
  }
  
  static async acknowledgeAlert(alertId: string, responderId: string) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // 1. Find and update alert
      const alert = await Alert.findOneAndUpdate(
        {
          _id: alertId,
          'assignedResponder.responderId': responderId,
          status: 'active',
        },
        {
          $set: {
            status: 'acknowledged',
            'assignedResponder.status': 'enroute',
            'assignedResponder.acknowledgedAt': new Date(),
          },
        },
        { new: true, session }
      );
      
      if (!alert) {
        throw new Error('Alert not found or not assigned to you');
      }
      
      // 2. Update responder's response time (simplified)
      const responder = await Responder.findOne({ userId: responderId }).session(session);
      if (responder) {
        const responseTime = (new Date().getTime() - new Date(alert.assignedResponder!.assignedAt).getTime()) / 1000;
        
        // Update average response time
        const newAvg = (responder.responseTimeAvg * responder.totalAssignments + responseTime) / 
                      (responder.totalAssignments + 1);
        
        responder.responseTimeAvg = newAvg;
        responder.totalAssignments += 1;
        await responder.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info(`Alert ${alertId} acknowledged by responder ${responderId}`);
      
      return alert;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Acknowledge alert error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  static async cancelAlert(alertId: string, responderId: string, reason?: string) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // 1. Update alert status
      const alert = await Alert.findOneAndUpdate(
        {
          _id: alertId,
          'assignedResponder.responderId': responderId,
          status: { $in: ['active', 'acknowledged'] },
        },
        {
          $set: {
            status: 'cancelled',
            'assignedResponder.cancelledAt': new Date(),
          },
        },
        { new: true, session }
      );
      
      if (!alert) {
        throw new Error('Alert not found or not assigned to you');
      }
      
      // 2. Free up responder
      const responder = await Responder.findOneAndUpdate(
        { userId: responderId },
        {
          $set: {
            status: 'available',
            assignedAlertId: null,
          },
        },
        { session }
      );
      
      if (!responder) {
        throw new Error('Responder not found');
      }
      
      // 3. Try to reassign to another responder
      if (alert.location.coordinates) {
        const [longitude, latitude] = alert.location.coordinates;
        
        const nearestResponders = await GeocodingServiceInstance.findNearestResponders(
          { latitude, longitude },
          10,
          3
        ).then(responders => 
          responders.filter(r => r.responderId !== responderId)
        );
        
        if (nearestResponders.length > 0) {
          const newResponderId = nearestResponders[0].responderId;
          const newResponder = await Responder.findOne({
            userId: newResponderId,
            status: 'available',
          }).session(session);
          
          if (newResponder) {
            // Update alert with new responder
            await Alert.findByIdAndUpdate(
              alertId,
              {
                $set: {
                  'assignedResponder.responderId': newResponder.userId,
                  'assignedResponder.assignedAt': new Date(),
                  'assignedResponder.status': 'assigned',
                  status: 'active',
                },
              },
              { session }
            );
            
            newResponder.status = 'busy';
            newResponder.assignedAlertId = alert._id;
            await newResponder.save({ session });
            
            logger.info(`Alert ${alertId} reassigned from ${responderId} to ${newResponderId}`);
          }
        }
      }
      
      await session.commitTransaction();
      
      logger.info(`Alert ${alertId} cancelled by responder ${responderId}, reason: ${reason || 'not specified'}`);
      
      return alert;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Cancel alert error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  static async resolveAlert(alertId: string, responderId: string) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // 1. Update alert status
      const alert = await Alert.findOneAndUpdate(
        {
          _id: alertId,
          'assignedResponder.responderId': responderId,
          status: { $in: ['active', 'acknowledged'] },
        },
        {
          $set: {
            status: 'resolved',
            'assignedResponder.status': 'on-scene',
            'assignedResponder.arrivedAt': new Date(),
            resolvedAt: new Date(),
          },
        },
        { new: true, session }
      );
      
      if (!alert) {
        throw new Error('Alert not found or not assigned to you');
      }
      
      // 2. Update responder stats
      const responder = await Responder.findOne({ userId: responderId }).session(session);
      if (responder) {
        responder.successfulAssignments += 1;
        
        // Simple rating update (in real app, use user feedback)
        const newRating = (responder.rating * responder.totalAssignments + 4.5) / (responder.totalAssignments + 1);
        responder.rating = Math.min(5, newRating);
        
        responder.status = 'available';
        responder.assignedAlertId = undefined;
        await responder.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info(`Alert ${alertId} resolved by responder ${responderId}`);
      
      return alert;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Resolve alert error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  static async updateUserLocation(
    alertId: string,
    coordinates: [number, number],
    accuracy: number
  ) {
    try {
      const [longitude, latitude] = coordinates;
      
      // Geocode new location
      const geocodedAddress = await GeocodingServiceInstance.reverseGeocode({
        latitude,
        longitude,
      });
      
      // Update alert tracking
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          $set: {
            'tracking.lastUserLocation': coordinates,
            'tracking.lastUpdated': new Date(),
          },
        },
        { new: true }
      );
      
      // Save to location history
      await LocationHistory.create({
        userId: alert?.userId,
        alertId,
        coordinates,
        accuracy,
        address: geocodedAddress?.formattedAddress,
        timestamp: new Date(),
      });
      
      return {
        alert,
        address: geocodedAddress?.formattedAddress,
      };
    } catch (error: any) {
      logger.error('Update user location error:', error);
      throw error;
    }
  }
  
  static async updateResponderLocation(
    alertId: string,
    responderId: string,
    coordinates: [number, number],
    accuracy: number
  ) {
    try {
      // Update responder's current location
      await Responder.findOneAndUpdate(
        { userId: responderId },
        {
          $set: {
            'currentLocation.coordinates': coordinates,
            'currentLocation.updatedAt': new Date(),
            lastPing: new Date(),
          },
        }
      );
      
      // Update alert tracking
      const alert = await Alert.findOneAndUpdate(
        {
          _id: alertId,
          'assignedResponder.responderId': responderId,
        },
        {
          $set: {
            'tracking.lastResponderLocation': coordinates,
            'tracking.lastUpdated': new Date(),
          },
        },
        { new: true }
      );
      
      // Save to location history
      await LocationHistory.create({
        userId: responderId,
        alertId,
        coordinates,
        accuracy,
        isResponder: true,
        timestamp: new Date(),
      });
      
      return alert;
    } catch (error: any) {
      logger.error('Update responder location error:', error);
      throw error;
    }
  }
  
  static async getLiveTracking(alertId: string, userId: string) {
    try {
      const alert = await Alert.findById(alertId)
        .populate('userId', 'fullName phone')
        .populate('assignedResponder.responderId', 'fullName phone vehicleType');
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check permissions
      const isUser = alert.userId._id.toString() === userId;
      const isResponder = alert.assignedResponder?.responderId?._id.toString() === userId;
      
      if (!isUser && !isResponder) {
        throw new Error('Not authorized to view this alert');
      }
      
      const result: any = {
        alertId,
        status: alert.status,
        lastUpdated: alert.tracking.lastUpdated,
      };
      
      // User location
      if (alert.tracking.lastUserLocation) {
        const [lng, lat] = alert.tracking.lastUserLocation;
        
        const address = await GeocodingServiceInstance.reverseGeocode({ latitude: lat, longitude: lng });
        
        result.userLocation = {
          coordinates: alert.tracking.lastUserLocation,
          address: address?.formattedAddress,
          accuracy: alert.location.accuracy,
        };
      }
      
      // Responder location
      if (alert.tracking.lastResponderLocation) {
        const [lng, lat] = alert.tracking.lastResponderLocation;
        
        const address = await GeocodingServiceInstance.reverseGeocode({ latitude: lat, longitude: lng });
        
        result.responderLocation = {
          coordinates: alert.tracking.lastResponderLocation,
          address: address?.formattedAddress,
          accuracy: 15, // Default responder accuracy
        };
        
        // Calculate distance
        if (result.userLocation?.coordinates) {
          const [userLng, userLat] = result.userLocation.coordinates;
          const distance = GeocodingService.calculateDistance(
            userLat,
            userLng,
            lat,
            lng
          );
          
          result.distance = distance;
          
          // Estimate arrival time
          if (alert.assignedResponder?.responderId && 
              (alert.assignedResponder.responderId as any).vehicleType) {
            
            const vehicleType = (alert.assignedResponder.responderId as any).vehicleType;
            const avgSpeed = this.getAverageSpeed(vehicleType);
            
            if (avgSpeed > 0 && distance > 0) {
              const estimatedMinutes = Math.ceil((distance / avgSpeed) * 60);
              result.estimatedArrival = estimatedMinutes <= 60 
                ? `${estimatedMinutes} minutes`
                : `${Math.ceil(distance / avgSpeed)} hours`;
            }
          }
        }
      }
      
      // Generate map
      if (result.userLocation?.coordinates) {
        const [lng, lat] = result.userLocation.coordinates;
        
        const markers = [{
          coordinates: { latitude: lat, longitude: lng },
          label: 'U',
          color: 'blue',
        }];
        
        if (result.responderLocation?.coordinates) {
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
  
  static async getUserAlerts(userId: string, status?: string) {
    try {
      const query: any = { userId };
      
      if (status) {
        query.status = status;
      }
      
      const alerts = await Alert.find(query)
        .populate('assignedResponder.responderId', 'fullName phone rating vehicleType')
        .sort({ createdAt: -1 })
        .limit(50);
      
      return alerts;
    } catch (error: any) {
      logger.error('Get user alerts error:', error);
      throw error;
    }
  }
  
  // Get responder's assigned alerts
  static async getResponderAlerts(responderId: string, status?: string) {
    try {
      const query: any = { 'assignedResponder.responderId': responderId };
      
      if (status) {
        query.status = status;
      }
      
      const alerts = await Alert.find(query)
        .populate('userId', 'fullName phone medicalInfo')
        .sort({ createdAt: -1 })
        .limit(50);
      
      return alerts;
    } catch (error: any) {
      logger.error('Get responder alerts error:', error);
      throw error;
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

  static async getUserAlertss(userId: string): Promise<IAlert[]> {
    try {
      const alerts = await Alert.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('assignedResponders.responderId', 'fullName phone');

      return alerts;
    } catch (error: any) {
      logger.error('Get user alerts error:', error);
      throw error;
    }
  }
}

export default AlertService;



// import mongoose from 'mongoose';
// import Alert, { IAlert } from '../models/alert.model';
// import User from '../models/user.model';
// import ResponderAvailability from '../models/responderAvailability.model';
// import GeocodingService from './geocoding.service';
// import LocationService from './location.service';
// import config from '../config/env';
// import logger from '../utils/logger';
// import NotificationService from './notification.service';

// export interface CreateAlertData {
//   userId: string;
//   type: 'panic' | 'fall-detection' | 'timer-expired';
//   location: {
//     coordinates: [number, number];
//     accuracy: number;
//   };
//   fallDetectionData?: {
//     acceleration: number;
//     timestamp: Date;
//   };
//   deviceInfo?: {
//     batteryLevel?: number;
//     osVersion?: string;
//     appVersion?: string;
//   };
// }

// export interface NearbyResponder {
//   responderId: string;
//   distance: number;
//   status: string;
// }

// export type AssignedResponder = {
//   responderId: mongoose.Types.ObjectId;
//   assignedAt: Date;
//   status: 'assigned' | 'enroute' | 'on-scene';
//   arrivedAt?: Date;
// };

// export class AlertService {

//   static async createAlert(data: CreateAlertData): Promise<IAlert> {
//     const session = await mongoose.startSession();
    
//     try {
//       session.startTransaction();

//       // Get user details
//       const user = await User.findById(data.userId).session(session);
//       if (!user) {
//         throw new Error('User not found');
//       }

//       const [_longitude, _latitude] = data.location.coordinates;
      
//       // ✅ STEP 1: Enrich location with geocoding data
//       const enrichedLocation = await this.enrichAlertLocation(
//         data.location.coordinates,
//         data.location.accuracy
//       );

//       // ✅ STEP 2: Create alert with enriched location data
//       const alert = new Alert({
//         userId: data.userId,
//         type: data.type,
//         location: {
//           type: 'Point',
//           coordinates: data.location.coordinates,
//           accuracy: data.location.accuracy,
//           ...enrichedLocation, // Add enriched data
//         },
//         fallDetectionData: data.fallDetectionData,
//         status: 'active',
//         deviceInfo: data.deviceInfo,
//       });

//       await alert.save({ session });

//       // ✅ STEP 3: Update user's last known location with enriched data
//       await User.findByIdAndUpdate(
//         data.userId,
//         {
//           lastKnownLocation: {
//             type: 'Point',
//             coordinates: data.location.coordinates,
//             timestamp: new Date(),
//             accuracy: data.location.accuracy,
//             enrichedData: {
//               address: enrichedLocation.address,
//               placeId: enrichedLocation.placeId,
//               staticMapUrl: enrichedLocation.staticMapUrl,
//             },
//           },
//           ...(data.deviceInfo && { deviceInfo: data.deviceInfo }),
//         },
//         { session }
//       );

//       // ✅ STEP 4: Save initial location to history
//       await LocationService.updateUserLocation({
//         userId: data.userId,
//         coordinates: data.location.coordinates,
//         accuracy: data.location.accuracy,
//         batteryLevel: data.deviceInfo?.batteryLevel,
//         alertId: alert._id.toString(),
//       });

//       // ✅ STEP 5: Find and assign nearby responders
//       const assignedResponders = await this.assignNearbyResponders(
//         alert,
//         data.location.coordinates,
//         enrichedLocation
//       );

//       alert.assignedResponders = assignedResponders as any;
//       await alert.save({ session });

//       // ✅ STEP 6: Send notifications with enriched location
//       await NotificationService.sendEmergencyNotifications(
//         alert, 
//         user, 
//         enrichedLocation
//       );

//       // ✅ STEP 7: Log for analytics
//       logger.info(`Alert created: ${alert._id}`, {
//         userId: data.userId,
//         location: enrichedLocation.address?.formatted,
//         coordinates: data.location.coordinates,
//         type: data.type,
//       });

//       await session.commitTransaction();

//       return alert;

//     } catch (error: any) {
//       await session.abortTransaction();
//       logger.error('Create alert error:', error);
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   }

//   private static async enrichAlertLocation(
//     coordinates: [number, number],
//     _accuracy: number
//   ): Promise<{
//     address?: {
//       formatted: string;
//       street?: string;
//       city?: string;
//       state?: string;
//       country?: string;
//       postalCode?: string;
//       neighborhood?: string;
//     };
//     placeId?: string;
//     staticMapUrl: string;
//     nearbyEmergencyServices?: {
//       hospitals: Array<{
//         name: string;
//         address: string;
//         coordinates: [number, number];
//         distance: number;
//       }>;
//       policeStations: Array<{
//         name: string;
//         address: string;
//         coordinates: [number, number];
//         distance: number;
//       }>;
//     };
//   }> {
//     try {
//       const [longitude, latitude] = coordinates;
      
//       // 1. Reverse geocode to get address
//       const geocodingResult = await GeocodingService.reverseGeocode({
//         latitude,
//         longitude,
//       });

//       // 2. Generate static map URL
//       const staticMapUrl = GeocodingService.getStaticMapUrl(
//         { latitude, longitude },
//         [
//           {
//             coordinates: { latitude, longitude },
//             label: '🚨', // Emergency marker
//             color: 'red',
//           },
//         ],
//         16, // Slightly zoomed in for detail
//         '600x400'
//       );

//       // 3. Get nearby emergency services (async - don't block if slow)
//       let nearbyEmergencyServices;
//       try {
//         const [hospitals, policeStations] = await Promise.all([
//           GeocodingService.getNearbyPlaces(
//             { latitude, longitude },
//             2000, // 2km radius
//             'hospital'
//           ),
//           GeocodingService.getNearbyPlaces(
//             { latitude, longitude },
//             2000,
//             'police'
//           ),
//         ]);

//         nearbyEmergencyServices = {
//           hospitals: hospitals.slice(0, 3).map(h => ({
//             name: h.name,
//             address: h.address,
//             coordinates: [h.coordinates.longitude, h.coordinates.latitude] as [number, number],
//             distance: h.distance,
//           })),
//           policeStations: policeStations.slice(0, 2).map(p => ({
//             name: p.name,
//             address: p.address,
//             coordinates: [p.coordinates.longitude, p.coordinates.latitude] as [number, number],
//             distance: p.distance,
//           })),
//         };
//       } catch (error) {
//         logger.warn('Failed to get nearby emergency services:', error);
//       }

//       return {
//         address: geocodingResult ? {
//           formatted: geocodingResult.formattedAddress,
//           street: geocodingResult.street,
//           city: geocodingResult.city,
//           state: geocodingResult.state,
//           country: geocodingResult.country,
//           postalCode: geocodingResult.postalCode,
//           neighborhood: geocodingResult.neighborhood,
//         } : undefined,
//         placeId: geocodingResult?.placeId,
//         staticMapUrl,
//         nearbyEmergencyServices,
//       };

//     } catch (error: any) {
//       logger.error('Enrich alert location error:', error);
      
//       // Fallback: basic static map even if geocoding fails
//       const [longitude, latitude] = coordinates;
//       const staticMapUrl = GeocodingService.getStaticMapUrl(
//         { latitude, longitude },
//         [{ coordinates: { latitude, longitude }, label: 'E', color: 'red' }]
//       );

//       return {
//         address: {
//           formatted: `Near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
//         },
//         staticMapUrl,
//       };
//     }
//   }

//   static async assignNearbyResponders(
//     alert: IAlert,
//     coordinates: [number, number],
//     enrichedLocation?: any
//   ): Promise<Array<{
//     responderId: mongoose.Types.ObjectId;
//     assignedAt: Date;
//     status: 'assigned' | 'enroute' | 'on-scene';
//     routeInfo?: {
//       distance: { text: string; value: number };
//       duration: { text: string; value: number };
//       estimatedArrival: Date;
//     };
//   }>> {
//     try {
//       const [longitude, latitude] = coordinates;

//       // Find available responders within radius
//       const responders = await ResponderAvailability.aggregate([
//         {
//           $match: {
//             status: 'available',
//             isActive: true,
//             currentLocation: {
//               $ne: null,
//             },
//           },
//         },
//         {
//           $geoNear: {
//             near: {
//               type: 'Point',
//               coordinates: [longitude, latitude],
//             },
//             distanceField: 'distance',
//             maxDistance: config.geolocation.maxResponseDistanceKm * 1000,
//             spherical: true,
//           },
//         },
//         {
//           $sort: {
//             distance: 1, // Closest first
//           },
//         },
//         {
//           $limit: 5, // Assign to up to 5 responders
//         },
//         {
//           $lookup: {
//             from: 'users',
//             localField: 'responderId',
//             foreignField: '_id',
//             as: 'user',
//           },
//         },
//         {
//           $unwind: '$user',
//         },
//       ]);

//       const assignedResponders = await Promise.all(
//         responders.map(async (responder) => {
//           let routeInfo;
          
//           // ✅ Calculate route for each responder
//           if (responder.currentLocation?.coordinates) {
//             try {
//               const [responderLng, responderLat] = responder.currentLocation.coordinates;
//               const route = await GeocodingService.getRoute(
//                 { latitude: responderLat, longitude: responderLng },
//                 { latitude, longitude },
//                 'driving'
//               );

//               if (route) {
//                 const estimatedArrival = new Date(Date.now() + route.duration.value * 1000);
//                 routeInfo = {
//                   distance: route.distance,
//                   duration: route.duration,
//                   estimatedArrival,
//                 };
//               }
//             } catch (error) {
//               logger.warn(`Failed to calculate route for responder ${responder.responderId}:`, error);
//             }
//           }

//           return {
//             responderId: responder.responderId,
//             assignedAt: new Date(),
//             status: 'assigned' as const,
//             routeInfo,
//           };
//         })
//       );

//       // Update responder statuses
//       if (assignedResponders.length > 0) {
//         await ResponderAvailability.updateMany(
//           {
//             responderId: { $in: assignedResponders.map(r => r.responderId) },
//           },
//           {
//             $set: {
//               status: 'busy',
//               assignedAlertId: alert._id,
//             },
//           }
//         );
//       }

//       return assignedResponders;
//     } catch (error: any) {
//       logger.error('Assign responders error:', error);
//       return [];
//     }
//   }

//   static async getEnrichedAlertDetails(alertId: string): Promise<any> {
//     try {
//       const alert = await Alert.findById(alertId)
//         .populate('userId', 'firstName lastName phone email profileImage medicalInfo')
//         .populate('assignedResponders.responderId', 'firstName lastName phone')
//         .lean();

//       if (!alert) {
//         throw new Error('Alert not found');
//       }

//       // If location already has enriched data, return as-is
//       if (alert.location.address) {
//         return alert;
//       }

//       // Otherwise, enrich on the fly
//       const [longitude, latitude] = alert.location.coordinates;
//       const enrichedLocation = await this.enrichAlertLocation(
//         [longitude, latitude],
//         alert.location.accuracy
//       );

//       return {
//         ...alert,
//         location: {
//           ...alert.location,
//           ...enrichedLocation,
//         },
//       };
//     } catch (error: any) {
//       logger.error('Get enriched alert details error:', error);
//       throw error;
//     }
//   }

//   static async updateAlertLocation(
//     alertId: string,
//     coordinates: [number, number],
//     accuracy: number
//   ): Promise<IAlert | null> {
//     try {
//       // Enrich the new location
//       const enrichedLocation = await this.enrichAlertLocation(coordinates, accuracy);
      
//       const alert = await Alert.findByIdAndUpdate(
//         alertId,
//         {
//           $set: {
//             'location.coordinates': coordinates,
//             'location.accuracy': accuracy,
//             'location.address': enrichedLocation.address,
//             'location.staticMapUrl': enrichedLocation.staticMapUrl,
//             'location.nearbyEmergencyServices': enrichedLocation.nearbyEmergencyServices,
//             'location.lastUpdated': new Date(),
//           },
//         },
//         { new: true }
//       );

//       if (alert) {
//         // Notify assigned responders about location update
//         for (const assignment of alert.assignedResponders) {
//           await NotificationService.sendPushNotificationToUser(
//             assignment.responderId.toString(),
//             {
//               title: '📍 Location Updated',
//               body: `User's location has been updated.`,
//               data: {
//                 alertId,
//                 type: 'location_update',
//                 coordinates,
//                 address: enrichedLocation.address?.formatted,
//               },
//             }
//           );
//         }
//       }

//       return alert;
//     } catch (error: any) {
//       logger.error('Update alert location error:', error);
//       return null;
//     }
//   }

//   static async getResponderRoute(
//     alertId: string,
//     responderId: string
//   ): Promise<{
//     route: any;
//     alertLocation: any;
//     estimatedArrival: Date;
//   } | null> {
//     try {
//       const alert = await Alert.findById(alertId);
//       if (!alert) return null;

//       const responder = await ResponderAvailability.findOne({ responderId })
//         .populate('responderId', 'firstName lastName phone');
      
//       if (!responder || !responder.currentLocation?.coordinates) {
//         return null;
//       }

//       const [alertLng, alertLat] = alert.location.coordinates;
//       const [responderLng, responderLat] = responder.currentLocation.coordinates;

//       const route = await GeocodingService.getRoute(
//         { latitude: responderLat, longitude: responderLng },
//         { latitude: alertLat, longitude: alertLng },
//         'driving'
//       );

//       if (!route) return null;

//       const estimatedArrival = new Date(Date.now() + route.duration.value * 1000);

//       // Get enriched alert location if not already enriched
//       let alertLocation = alert.location;
//       if (!alert.location.address) {
//         const enriched = await this.enrichAlertLocation(
//           [alertLng, alertLat],
//           alert.location.accuracy
//         );
//         alertLocation = { ...alertLocation, ...enriched };
//       }

//       return {
//         route,
//         alertLocation,
//         estimatedArrival,
//       };
//     } catch (error: any) {
//       logger.error('Get responder route error:', error);
//       return null;
//     }
//   }

  // static async updateAlertStatus(
  //   alertId: string,
  //   status: 'acknowledged' | 'resolved' | 'cancelled',
  //   responderId?: string
  // ): Promise<IAlert | null> {
  //   const session = await mongoose.startSession();
    
  //   try {
  //     session.startTransaction();

  //     const updateData: any = { status };
      
  //     if (status === 'resolved') {
  //       updateData.resolvedAt = new Date();
  //     }

  //     const alert = await Alert.findByIdAndUpdate(
  //       alertId,
  //       { $set: updateData },
  //       { new: true, session }
  //     );

  //     if (!alert) {
  //       throw new Error('Alert not found');
  //     }

  //     // If responder is acknowledging, add route calculation
  //     if (responderId && status === 'acknowledged') {
  //       await this.updateResponderAlertStatus(alertId, responderId, 'enroute');
        
  //       // Get and store route info
  //       const routeInfo = await this.getResponderRoute(alertId, responderId);
  //       if (routeInfo) {
  //         await Alert.updateOne(
  //           {
  //             _id: alertId,
  //             'assignedResponders.responderId': responderId,
  //           },
  //           {
  //             $set: {
  //               'assignedResponders.$.routeInfo': {
  //                 distance: routeInfo.route.distance,
  //                 duration: routeInfo.route.duration,
  //                 estimatedArrival: routeInfo.estimatedArrival,
  //               },
  //             },
  //           }
  //         );
  //       }
  //     }

  //     // If alert is resolved, free up responders
  //     if (status === 'resolved' || status === 'cancelled') {
  //       await this.freeResponders(alertId);
  //     }

  //     await session.commitTransaction();
  //     return alert;
  //   } catch (error: any) {
  //     await session.abortTransaction();
  //     logger.error('Update alert status error:', error);
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }

//   static async updateResponderAlertStatus(
//     alertId: string,
//     responderId: string,
//     status: 'assigned' | 'enroute' | 'on-scene'
//   ): Promise<void> {
//     try {
//       await Alert.updateOne(
//         {
//           _id: alertId,
//           'assignedResponders.responderId': responderId,
//         },
//         {
//           $set: {
//             'assignedResponders.$.status': status,
//           },
//         }
//       );

//       if (status === 'on-scene') {
//         await Alert.updateOne(
//           { _id: alertId, 'assignedResponders.responderId': responderId },
//           {
//             $set: {
//               'assignedResponders.$.arrivedAt': new Date(),
//             },
//           }
//         );
//       }
//     } catch (error: any) {
//       logger.error('Update responder alert status error:', error);
//       throw error;
//     }
//   }

//   static async freeResponders(alertId: string): Promise<void> {
//     try {
//       // Get alert to find assigned responders
//       const alert = await Alert.findById(alertId);
//       if (!alert) return;

//       const responderIds = alert.assignedResponders.map(r => r.responderId);

//       // Update responder availability
//       await ResponderAvailability.updateMany(
//         {
//           responderId: { $in: responderIds },
//         },
//         {
//           $set: {
//             status: 'available',
//             assignedAlertId: null,
//           },
//         }
//       );
//     } catch (error: any) {
//       logger.error('Free responders error:', error);
//       throw error;
//     }
//   }

//   static async getActiveAlerts(
//     filters?: {
//       type?: string;
//       status?: string;
//       location?: {
//         coordinates: [number, number];
//         radius: number;
//       };
//     }
//   ): Promise<IAlert[]> {
//     try {
//       const query: any = {};

//       if (filters?.status) {
//         query.status = filters.status;
//       }

//       if (filters?.type) {
//         query.type = filters.type;
//       }

//       if (filters?.location) {
//         query.location = {
//           $near: {
//             $geometry: {
//               type: 'Point',
//               coordinates: filters.location.coordinates,
//             },
//             $maxDistance: filters.location.radius * 1000,
//           },
//         };
//       }

//       const alerts = await Alert.find(query)
//         .populate('userId', 'firstName lastName phone email profileImage')
//         .populate('assignedResponders.responderId', 'firstName lastName phone')
//         .sort({ createdAt: -1 })
//         .limit(100);

//       return alerts;
//     } catch (error: any) {
//       logger.error('Get active alerts error:', error);
//       throw error;
//     }
//   }

  // static async getUserAlerts(userId: string): Promise<IAlert[]> {
  //   try {
  //     const alerts = await Alert.find({ userId })
  //       .sort({ createdAt: -1 })
  //       .limit(50)
  //       .populate('assignedResponders.responderId', 'firstName lastName phone');

  //     return alerts;
  //   } catch (error: any) {
  //     logger.error('Get user alerts error:', error);
  //     throw error;
  //   }
  // }

//   static async addMessage(
//     alertId: string,
//     senderId: string,
//     content: string,
//     type: 'text' | 'system' = 'text'
//   ): Promise<IAlert | null> {
//     try {
//       const alert = await Alert.findByIdAndUpdate(
//         alertId,
//         {
//           $push: {
//             messages: {
//               senderId,
//               content,
//               type,
//               timestamp: new Date(),
//             },
//           },
//         },
//         { new: true }
//       );

//       return alert;
//     } catch (error: any) {
//       logger.error('Add message error:', error);
//       throw error;
//     }
//   }
// }

// export default AlertService;