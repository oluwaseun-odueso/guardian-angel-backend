import mongoose from 'mongoose';
import { GeocodingService } from './geocoding.service';
import GeocodingServiceInstance from '../services/geocoding.service';
import LocationHistory from '../models/locationHistory.model';
import User from '../models/user.model';
import Alert from '../models/alert.model';
import GeoUtils from '../utils/geospatial';
import logger from '../utils/logger';

export interface LocationUpdate {
  userId: string;
  coordinates: [number, number]; // [longitude, latitude]
  accuracy: number;
  batteryLevel?: number;
  alertId?: string;
  address?: string; // Optional: Frontend can provide approximate address
}

export interface LocationHistoryRecord {
  userId: string;
  coordinates: [number, number];
  accuracy: number;
  timestamp: Date;
  batteryLevel?: number;
  alertId?: string;
  address?: string;
  enrichedData?: {
    formattedAddress?: string;
    city?: string;
    neighborhood?: string;
    placeId?: string;
    staticMapUrl?: string;
  };
}

export interface GeofenceCheck {
  isInside: boolean;
  trustedLocation?: {
    name: string;
    distance: number; // meters
  };
}

export interface EnrichedLocation {
  coordinates: [number, number];
  accuracy: number;
  address?: {
    formatted: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    neighborhood?: string;
  };
  placeId?: string;
  staticMapUrl?: string;
  nearbyEmergencyServices?: {
    hospitals: Array<{
      name: string;
      address: string;
      coordinates: [number, number];
      distance: number;
    }>;
    policeStations: Array<{
      name: string;
      address: string;
      coordinates: [number, number];
      distance: number;
    }>;
  };
}

export interface TrustedLocationInput {
  name: string;
  address?: string;              // For frontend address input
  coordinates?: [number, number]; // For frontend coordinate input
  radius?: number;
  isHome?: boolean;
  isWork?: boolean;
  notes?: string;
}

export interface TrustedLocationResult {
  _id: string;
  name: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number];
  };
  address: {
    formatted: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    neighborhood?: string;
    placeId?: string;
  };
  radius: number;
  isHome: boolean;
  isWork: boolean;
  notes?: string;
  createdAt: Date;
  distanceFromCurrent?: number; // For sorting
  staticMapUrl?: string;        // Optional: map thumbnail
}

export class LocationService {
  static async updateUserLocation(data: LocationUpdate): Promise<EnrichedLocation> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const { userId, coordinates, accuracy, batteryLevel, alertId, address } = data;
      // const [longitude, latitude] = coordinates;

      // 1. Enrich location data with geocoding
      const enrichedLocation = await this.enrichLocationData(coordinates, accuracy);

      // 2. Update user's last known location with enriched data
      await User.findByIdAndUpdate(
        userId,
        {
          lastKnownLocation: {
            type: 'Point',
            coordinates,
            timestamp: new Date(),
            accuracy,
            enrichedData: {
              address: enrichedLocation.address,
              placeId: enrichedLocation.placeId,
              staticMapUrl: enrichedLocation.staticMapUrl,
            },
          },
        },
        { session }
      );

      // 3. Save enriched data to location history
      const locationHistory = new LocationHistory({
        userId,
        coordinates,
        accuracy,
        batteryLevel,
        alertId,
        address: address || enrichedLocation.address?.formatted,
        enrichedData: {
          formattedAddress: enrichedLocation.address?.formatted,
          city: enrichedLocation.address?.city,
          neighborhood: enrichedLocation.address?.neighborhood,
          placeId: enrichedLocation.placeId,
          staticMapUrl: enrichedLocation.staticMapUrl,
        },
        timestamp: new Date(),
      });

      await locationHistory.save({ session });

      // 4. If this location update is for an active alert, update alert with enriched data
      if (alertId) {
        await this.updateAlertWithEnrichedLocation(alertId, enrichedLocation);
      }

      // 5. Check if user is in a trusted location (for auto-silencing alerts)
      const geofenceCheck = await this.checkGeofence(userId, coordinates);
      
      if (geofenceCheck.isInside) {
        logger.info(`User ${userId} is in trusted location: ${geofenceCheck.trustedLocation?.name}`);
        // Could trigger auto-silence of alerts here
      }

      // 6. Check location accuracy and flag suspicious locations
      const locationVerification = await this.verifyLocationAccuracy(coordinates, accuracy);
      if (!locationVerification.isTrustworthy) {
        logger.warn(`Location accuracy issue for user ${userId}: ${locationVerification.issues?.join(', ')}`);
      }

      await session.commitTransaction();

      logger.debug(`Location updated for user: ${userId}`, {
        coordinates,
        address: enrichedLocation.address?.formatted,
        confidence: locationVerification.confidence,
      });

      return enrichedLocation;

    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Update user location error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async enrichLocationData(
    coordinates: [number, number],
    accuracy: number
  ): Promise<EnrichedLocation> {
    const [longitude, latitude] = coordinates;
    
    try {
      // 1. Reverse geocode to get address
      const geocodingResult = await GeocodingServiceInstance.reverseGeocode({
        latitude,
        longitude,
      });

      // 2. Get static map URL for visualization
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude, longitude },
        [
          {
            coordinates: { latitude, longitude },
            label: '📍',
            color: 'red',
          },
        ],
        15,
        '400x300'
      );

      // 3. Get nearby emergency services (async - don't wait if slow)
      let nearbyEmergencyServices;
      try {
        const hospitalsPromise = GeocodingServiceInstance.getNearbyPlaces(
          { latitude, longitude },
          2000, // 2km radius
          'hospital'
        );

        const policePromise = GeocodingServiceInstance.getNearbyPlaces(
          { latitude, longitude },
          2000,
          'police'
        );

        const [hospitals, policeStations] = await Promise.all([
          hospitalsPromise,
          policePromise,
        ]);

        nearbyEmergencyServices = {
          hospitals: hospitals.slice(0, 3).map(h => ({
            name: h.name,
            address: h.address,
            coordinates: [h.coordinates.longitude, h.coordinates.latitude] as [number, number],
            distance: h.distance,
          })),
          policeStations: policeStations.slice(0, 2).map(p => ({
            name: p.name,
            address: p.address,
            coordinates: [p.coordinates.longitude, p.coordinates.latitude] as [number, number],
            distance: p.distance,
          })),
        };
      } catch (error) {
        logger.warn('Failed to get nearby emergency services:', error);
      }

      return {
        coordinates,
        accuracy,
        address: geocodingResult ? {
          formatted: geocodingResult.formattedAddress,
          street: geocodingResult.street,
          city: geocodingResult.city,
          state: geocodingResult.state,
          country: geocodingResult.country,
          postalCode: geocodingResult.postalCode,
          neighborhood: geocodingResult.neighborhood,
        } : undefined,
        placeId: geocodingResult?.placeId,
        staticMapUrl,
        nearbyEmergencyServices,
      };

    } catch (error: any) {
      logger.error('Enrich location data error:', error);
      
      // Return basic location data if geocoding fails
      return {
        coordinates,
        accuracy,
        address: {
          formatted: `Near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        },
      };
    }
  }

  static async updateAlertWithEnrichedLocation(
    alertId: string,
    enrichedLocation: EnrichedLocation
  ): Promise<void> {
    try {
      await Alert.findByIdAndUpdate(
        alertId,
        {
          $set: {
            'location.enrichedData': {
              address: enrichedLocation.address,
              placeId: enrichedLocation.placeId,
              staticMapUrl: enrichedLocation.staticMapUrl,
              nearbyEmergencyServices: enrichedLocation.nearbyEmergencyServices,
              lastUpdated: new Date(),
            },
          },
        }
      );

      logger.debug(`Updated alert ${alertId} with enriched location data`);
    } catch (error: any) {
      logger.error('Update alert with enriched location error:', error);
    }
  }

  static async verifyLocationAccuracy(
    coordinates: [number, number],
    reportedAccuracy: number
  ): Promise<{
    isTrustworthy: boolean;
    confidence: number;
    issues?: string[];
  }> {
    const issues: string[] = [];
    let confidence = 100;
    
    const [lng, lat] = coordinates;

    // Check if coordinates are valid
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      issues.push('Invalid coordinate range');
      confidence -= 50;
    }

    // Check if accuracy is reasonable
    if (reportedAccuracy > 1000) { // More than 1km accuracy
      issues.push('Poor location accuracy (>1km)');
      confidence -= 30;
    } else if (reportedAccuracy > 500) {
      issues.push('Moderate location accuracy (>500m)');
      confidence -= 15;
    }

    // Check if location is in impossible places (ocean, etc.)
    // This would require additional APIs in production
    // For now, we'll check extreme coordinates
    
    if (Math.abs(lat) > 85) { // Near poles
      issues.push('Location near polar region - may be inaccurate');
      confidence -= 10;
    }

    // Check for zero or near-zero coordinates (common GPS errors)
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
      issues.push('Suspicious near-zero coordinates');
      confidence -= 40;
    }

    return {
      isTrustworthy: confidence > 70,
      confidence,
      issues: issues.length > 0 ? issues : undefined,
    };
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
    limit: number = 100,
    includeEnrichedData: boolean = false
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
        .select('coordinates accuracy batteryLevel alertId timestamp address enrichedData')
        .lean();

      return history.map((record: any): LocationHistoryRecord => ({
        userId,
        coordinates: record.coordinates,
        accuracy: record.accuracy,
        batteryLevel: record.batteryLevel,
        alertId: record.alertId?.toString(),
        timestamp: record.timestamp,
        address: record.address,
        enrichedData: includeEnrichedData ? record.enrichedData : undefined,
      }));
    } catch (error: any) {
      logger.error('Get user location history error:', error);
      throw error;
    }
  }

  static async getAlertLocationHistory(
    alertId: string,
    includeEnrichedData: boolean = true
  ): Promise<LocationHistoryRecord[]> {
    try {
      const history = await LocationHistory.find({ alertId })
        .sort({ timestamp: 1 })
        .select('userId coordinates accuracy batteryLevel timestamp address enrichedData')
        .populate('userId', 'fullName')
        .lean();

      return history.map((record: any) => ({
        userId: record.userId._id.toString(),
        coordinates: record.coordinates,
        accuracy: record.accuracy,
        batteryLevel: record.batteryLevel,
        alertId,
        timestamp: record.timestamp,
        address: record.address,
        enrichedData: includeEnrichedData ? record.enrichedData : undefined,
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
  ): Promise<{
    totalDistance: number;
    averageSpeed: number;
    locations: Array<{
      coordinates: [number, number];
      timestamp: Date;
      address?: string;
    }>;
  }> {
    try {
      const locations = await LocationHistory.find({
        userId,
        timestamp: { $gte: startDate, $lte: endDate },
      })
        .sort({ timestamp: 1 })
        .select('coordinates timestamp address')
        .lean();

      if (locations.length < 2) {
        return {
          totalDistance: 0,
          averageSpeed: 0,
          locations: locations.map(loc => ({
            coordinates: loc.coordinates,
            timestamp: loc.timestamp,
            address: loc.address,
          })),
        };
      }

      let totalDistance = 0;
      const speeds: number[] = [];

      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        
        const distance = GeoUtils.calculateDistance(
          prev.coordinates[1], // latitude
          prev.coordinates[0], // longitude
          curr.coordinates[1],
          curr.coordinates[0]
        );

        totalDistance += distance;

        // Calculate speed (km/h)
        const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60); // hours
        if (timeDiff > 0) {
          const speed = distance / timeDiff;
          speeds.push(speed);
        }
      }

      const averageSpeed = speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 0;

      return {
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        locations: locations.map(loc => ({
          coordinates: loc.coordinates,
          timestamp: loc.timestamp,
          address: loc.address,
        })),
      };
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
    endDate?: Date,
    includeAlerts: boolean = true
  ): Promise<Array<{
    coordinates: [number, number];
    intensity: number;
    type: 'location_update' | 'alert';
    address?: string;
  }>> {
    try {
      // Get location history points
      const locationQuery: any = {
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
        locationQuery.timestamp = {};
        if (startDate) locationQuery.timestamp.$gte = startDate;
        if (endDate) locationQuery.timestamp.$lte = endDate;
      }

      const locations = await LocationHistory.find(locationQuery)
        .select('coordinates address')
        .lean() as any[];

      // Get alert locations if requested
      let alerts: any[] = [];
      if (includeAlerts) {
        const alertQuery: any = {
          'location.coordinates': {
            $geoWithin: {
              $box: [
                [bounds.west, bounds.south],
                [bounds.east, bounds.north],
              ],
            },
          },
        };

        if (startDate || endDate) {
          alertQuery.createdAt = {};
          if (startDate) alertQuery.createdAt.$gte = startDate;
          if (endDate) alertQuery.createdAt.$lte = endDate;
        }

        alerts = await Alert.find(alertQuery)
          .select('location.coordinates location.address')
          .lean();
      }

      // Combine and cluster all points
      const allPoints = [
        ...locations.map((loc: any) => ({
          coordinates: loc.coordinates,
          type: 'location_update' as const,
          address: loc.address,
        })),
        ...alerts.map(alert => ({
          coordinates: alert.location.coordinates,
          type: 'alert' as const,
          address: alert.location.address?.formatted,
        })),
      ];

      // Cluster with adaptive precision based on bounds size
      const latRange = bounds.north - bounds.south;
      const precision = latRange > 1 ? 2 : 3; // More precise for smaller areas

      const clusters = new Map<string, {
        location_update: number;
        alert: number;
        addresses: Set<string>;
      }>();

      allPoints.forEach(point => {
        const [lon, lat] = point.coordinates;
        const key = `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
        
        if (!clusters.has(key)) {
          clusters.set(key, {
            location_update: 0,
            alert: 0,
            addresses: new Set(),
          });
        }

        const cluster = clusters.get(key)!;
        if (point.type === 'alert') {
          cluster.alert += 1;
        } else {
          cluster.location_update += 1;
        }

        if (point.address) {
          cluster.addresses.add(point.address.substring(0, 50)); // Limit address length
        }
      });

      return Array.from(clusters.entries()).map(([key, counts]) => {
        const [lat, lon] = key.split(',').map(Number);
        
        // Weight alerts more heavily
        const intensity = counts.alert * 3 + counts.location_update;
        
        // Get most common address
        const addresses = Array.from(counts.addresses);
        const address = addresses.length > 0 ? addresses[0] : undefined;

        return {
          coordinates: [lon, lat],
          intensity,
          type: counts.alert > counts.location_update ? 'alert' : 'location_update',
          address: address && addresses.length === 1 ? address : `${addresses.length} locations`,
        };
      });
    } catch (error: any) {
      logger.error('Get heatmap data error:', error);
      throw error;
    }
  }

  static async getRouteBetweenLocations(
    startCoordinates: [number, number],
    endCoordinates: [number, number],
    mode: 'driving' | 'walking' | 'bicycling' = 'driving'
  ): Promise<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    polyline?: string;
    staticMapUrl?: string;
  } | null> {
    try {
      const [startLng, startLat] = startCoordinates;
      const [endLng, endLat] = endCoordinates;

      const route = await GeocodingServiceInstance.getRoute(
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
        mode
      );

      if (!route) {
        return null;
      }

      // Generate route map
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude: startLat, longitude: startLng },
        [
          { coordinates: { latitude: startLat, longitude: startLng }, label: 'A', color: 'green' },
          { coordinates: { latitude: endLat, longitude: endLng }, label: 'B', color: 'red' },
        ],
        13,
        '600x400'
      );

      return {
        ...route,
        staticMapUrl,
      };
    } catch (error: any) {
      logger.error('Get route between locations error:', error);
      return null;
    }
  }

  static async batchUpdateLocations(updates: LocationUpdate[]): Promise<EnrichedLocation[]> {
    const session = await mongoose.startSession();
    const results: EnrichedLocation[] = [];
    
    try {
      session.startTransaction();

      for (const update of updates) {
        try {
          const enrichedLocation = await this.updateUserLocation(update);
          results.push(enrichedLocation);
        } catch (error: any) {
          logger.error(`Failed to update location for user ${update.userId}:`, error);
          // Continue with other updates
        }
      }

      await session.commitTransaction();
      logger.info(`Batch updated ${results.length}/${updates.length} locations`);
      
      return results;
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Batch update locations error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getLocationAnalytics(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    totalDistance: number;
    averageDailyDistance: number;
    mostFrequentLocations: Array<{
      coordinates: [number, number];
      address?: string;
      visitCount: number;
      lastVisit: Date;
    }>;
    travelPattern: 'stationary' | 'moderate' | 'active';
    safetyScore: number; // 0-100 based on location patterns
  }> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Get location history for period
      const history = await this.getUserLocationHistory(
        userId,
        startDate,
        now,
        1000 // Get up to 1000 records
      );

      if (history.length < 2) {
        return {
          totalDistance: 0,
          averageDailyDistance: 0,
          mostFrequentLocations: [],
          travelPattern: 'stationary',
          safetyScore: 80, // Default safe score
        };
      }

      // Calculate total distance
      const { totalDistance } = await this.calculateDistanceTraveled(
        userId,
        startDate,
        now
      );

      // Calculate average daily distance
      const days = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const averageDailyDistance = totalDistance / Math.max(1, days);

      // Find most frequent locations
      const locationFrequency = new Map<string, {
        coordinates: [number, number];
        address?: string;
        count: number;
        lastVisit: Date;
      }>();

      const precision = 3; // ~100m precision for clustering
      history.forEach(record => {
        const [lon, lat] = record.coordinates;
        const key = `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
        
        if (!locationFrequency.has(key)) {
          locationFrequency.set(key, {
            coordinates: record.coordinates,
            address: record.address,
            count: 0,
            lastVisit: record.timestamp,
          });
        }

        const location = locationFrequency.get(key)!;
        location.count += 1;
        if (record.timestamp > location.lastVisit) {
          location.lastVisit = record.timestamp;
        }
      });

      const mostFrequentLocations = Array.from(locationFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(loc => ({
          coordinates: loc.coordinates,
          address: loc.address,
          visitCount: loc.count,
          lastVisit: loc.lastVisit,
        }));

      // Determine travel pattern
      let travelPattern: 'stationary' | 'moderate' | 'active';
      if (averageDailyDistance < 2) {
        travelPattern = 'stationary';
      } else if (averageDailyDistance < 10) {
        travelPattern = 'moderate';
      } else {
        travelPattern = 'active';
      }

      // Calculate safety score (simplified)
      let safetyScore = 80; // Base score
      
      // Bonus for staying in trusted locations
      const geofenceChecks = await Promise.all(
        mostFrequentLocations.map(loc => 
          this.checkGeofence(userId, loc.coordinates)
        )
      );
      
      const trustedLocationRatio = geofenceChecks.filter(check => check.isInside).length / 
        Math.max(1, mostFrequentLocations.length);
      
      safetyScore += Math.round(trustedLocationRatio * 20); // Up to +20 points

      return {
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageDailyDistance: Math.round(averageDailyDistance * 100) / 100,
        mostFrequentLocations,
        travelPattern,
        safetyScore: Math.min(100, safetyScore),
      };
    } catch (error: any) {
      logger.error('Get location analytics error:', error);
      throw error;
    }
  }








  ///// TRUSTED LOCATION SERVICE METHODS


  static async addTrustedLocation(
    userId: string,
    data: TrustedLocationInput
  ): Promise<TrustedLocationResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      let coordinates: [number, number];
      let addressData: any;

      // CASE 1: Address provided (needs geocoding)
      if (data.address && !data.coordinates) {
        console.log('Geocoding address:', data.address);
        
        const geocodeResult = await GeocodingServiceInstance.geocodeAddress(data.address);
        if (!geocodeResult) {
          throw new Error('Could not geocode the provided address');
        }
        
        coordinates = [geocodeResult.longitude, geocodeResult.latitude];
        addressData = await this.getAddressDetails(geocodeResult.latitude, geocodeResult.longitude);
      }
      // CASE 2: Coordinates provided (needs reverse geocoding)
      else if (data.coordinates && !data.address) {
        console.log('Reverse geocoding coordinates:', data.coordinates);
        
        const [longitude, latitude] = data.coordinates;
        coordinates = [longitude, latitude];
        addressData = await this.getAddressDetails(latitude, longitude);
      }
      // CASE 3: Both provided (use coordinates, validate address)
      else if (data.coordinates && data.address) {
        console.log('Both coordinates and address provided, using coordinates');
        
        const [longitude, latitude] = data.coordinates;
        coordinates = [longitude, latitude];
        
        // Still get address details for consistency
        addressData = await this.getAddressDetails(latitude, longitude);
      }
      else {
        throw new Error('Either address or coordinates must be provided');
      }

      // Validate coordinates
      this.validateCoordinates(coordinates);

      // Check for duplicate locations (within 50 meters)
      const isDuplicate = await this.isDuplicateLocation(
        userId,
        coordinates,
        data.name
      );
      
      if (isDuplicate) {
        throw new Error('A similar trusted location already exists');
      }

      // Generate static map URL for thumbnail
      const staticMapUrl = GeocodingServiceInstance.getStaticMapUrl(
        { latitude: coordinates[1], longitude: coordinates[0] },
        [
          {
            coordinates: { latitude: coordinates[1], longitude: coordinates[0] },
            label: '🏠',
            color: 'green',
          },
        ],
        15,
        '300x200'
      );

      // Prepare the new location object
      const newLocation = {
        name: data.name,
        coordinates: {
          type: 'Point' as const,
          coordinates: coordinates,
        },
        address: {
          formatted: addressData.formattedAddress,
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          country: addressData.country,
          postalCode: addressData.postalCode,
          neighborhood: addressData.neighborhood,
          placeId: addressData.placeId,
        },
        radius: data.radius || 100,
        isHome: data.isHome || false,
        isWork: data.isWork || false,
        notes: data.notes,
        staticMapUrl: staticMapUrl,
      };

      // Update user's trusted locations
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            'settings.trustedLocations': newLocation,
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new Error('Failed to add trusted location');
      }

      // Return the newly added location
      const addedLocation = updatedUser.settings.trustedLocations[
        updatedUser.settings.trustedLocations.length - 1
      ];

      return {
        _id: addedLocation._id.toString(),
        name: addedLocation.name,
        coordinates: addedLocation.coordinates,
        address: addedLocation.address,
        radius: addedLocation.radius,
        isHome: addedLocation.isHome,
        isWork: addedLocation.isWork,
        notes: addedLocation.notes,
        createdAt: addedLocation.createdAt,
        staticMapUrl: staticMapUrl,
      };

    } catch (error: any) {
      logger.error('Add trusted location error:', error);
      throw error;
    }
  }

  /**
   * Get all trusted locations for a user
   * Optional: sort by distance from current location
   */
  static async getTrustedLocations(
    userId: string,
    currentLocation?: { latitude: number; longitude: number }
  ): Promise<TrustedLocationResult[]> {
    try {
      const user = await User.findById(userId).select('settings.trustedLocations');
      if (!user) {
        throw new Error('User not found');
      }

      const locations = user.settings.trustedLocations.map(loc => ({
        _id: loc._id.toString(),
        name: loc.name,
        coordinates: loc.coordinates,
        address: loc.address,
        radius: loc.radius,
        isHome: loc.isHome,
        isWork: loc.isWork,
        notes: loc.notes,
        createdAt: loc.createdAt,
        distanceFromCurrent: currentLocation
          ? GeocodingService.calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              loc.coordinates.coordinates[1],
              loc.coordinates.coordinates[0]
            )
          : undefined,
      }));

      // Sort by distance if current location provided
      if (currentLocation) {
        locations.sort((a, b) => {
          if (a.distanceFromCurrent === undefined) return 1;
          if (b.distanceFromCurrent === undefined) return -1;
          return a.distanceFromCurrent - b.distanceFromCurrent;
        });
      }

      return locations;
    } catch (error: any) {
      logger.error('Get trusted locations error:', error);
      throw error;
    }
  }

  /**
   * Search for addresses (for frontend autocomplete)
   */
  static async searchAddresses(query: string): Promise<Array<{
    formattedAddress: string;
    placeId: string;
    coordinates: { latitude: number; longitude: number };
    addressComponents: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      neighborhood?: string;
    };
  }>> {
    try {
      // This would integrate with Google Places API for autocomplete
      // For now, we'll use geocoding as a fallback
      const geocodeResult = await GeocodingServiceInstance.geocodeAddress(query);
      
      if (!geocodeResult) {
        return [];
      }

      const addressDetails = await this.getAddressDetails(
        geocodeResult.latitude,
        geocodeResult.longitude
      );

      return [{
        formattedAddress: addressDetails.formattedAddress,
        placeId: addressDetails.placeId || '',
        coordinates: {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
        },
        addressComponents: {
          street: addressDetails.street,
          city: addressDetails.city,
          state: addressDetails.state,
          country: addressDetails.country,
          postalCode: addressDetails.postalCode,
          neighborhood: addressDetails.neighborhood,
        },
      }];
    } catch (error) {
      logger.error('Search addresses error:', error);
      return [];
    }
  }

  /**
   * Helper: Get detailed address from coordinates
   */
  private static async getAddressDetails(
    latitude: number,
    longitude: number
  ): Promise<any> {
    const addressData = await GeocodingServiceInstance.reverseGeocode({
      latitude,
      longitude,
    });

    if (!addressData) {
      throw new Error('Could not get address details for coordinates');
    }

    return addressData;
  }

  /**
   * Helper: Validate coordinates
   */
  private static validateCoordinates(coordinates: [number, number]): void {
    const [longitude, latitude] = coordinates;
    
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
  }

  /**
   * Helper: Check for duplicate locations
   */
  private static async isDuplicateLocation(
    userId: string,
    coordinates: [number, number],
    name: string
  ): Promise<boolean> {
    const user = await User.findById(userId).select('settings.trustedLocations');
    
    if (!user || !user.settings.trustedLocations) {
      return false;
    }

    const duplicateThreshold = 0.05; // ~50 meters in decimal degrees

    return user.settings.trustedLocations.some(location => {
      // Check by name
      if (location.name.toLowerCase() === name.toLowerCase()) {
        return true;
      }

      // Check by proximity (if coordinates exist)
      if (location.coordinates?.coordinates) {
        const [lng1, lat1] = location.coordinates.coordinates;
        const [lng2, lat2] = coordinates;
        
        const distance = GeocodingService.calculateDistance(lat1, lng1, lat2, lng2);
        return distance < duplicateThreshold;
      }

      return false;
    });
  }

  static async updateTrustedLocation(
    userId: string,
    locationId: string,
    updates: Partial<TrustedLocationInput>
  ): Promise<TrustedLocationResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const locationIndex = user.settings.trustedLocations.findIndex(
        loc => loc._id.toString() === locationId
      );

      if (locationIndex === -1) {
        throw new Error('Trusted location not found');
      }

      const location = user.settings.trustedLocations[locationIndex];
      const updateData: any = { ...updates };

      // If address changed, need to re-geocode
      if (updates.address && updates.address !== location.address.formatted) {
        const geocodeResult = await GeocodingServiceInstance.geocodeAddress(updates.address);
        if (!geocodeResult) {
          throw new Error('Could not geocode the new address');
        }
        
        updateData.coordinates = [geocodeResult.longitude, geocodeResult.latitude];
        
        const addressData = await this.getAddressDetails(
          geocodeResult.latitude,
          geocodeResult.longitude
        );
        
        updateData.address = {
          formatted: addressData.formattedAddress,
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          country: addressData.country,
          postalCode: addressData.postalCode,
          neighborhood: addressData.neighborhood,
          placeId: addressData.placeId,
        };
      }

      // Apply updates
      Object.assign(location, updateData);

      await user.save();

      return {
        _id: location._id.toString(),
        name: location.name,
        coordinates: location.coordinates,
        address: location.address,
        radius: location.radius,
        isHome: location.isHome,
        isWork: location.isWork,
        notes: location.notes,
        createdAt: location.createdAt,
      };
    } catch (error: any) {
      logger.error('Update trusted location error:', error);
      throw error;
    }
  }

  /**
   * Delete a trusted location
   */
  static async deleteTrustedLocation(
    userId: string,
    locationId: string
  ): Promise<boolean> {
    try {
      const result = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            'settings.trustedLocations': { _id: locationId },
          },
        },
        { new: true }
      );

      return !!result;
    } catch (error: any) {
      logger.error('Delete trusted location error:', error);
      throw error;
    }
  }

  static async isAtTrustedLocation(
    userId: string,
    coordinates: [number, number]
  ): Promise<{
    isAtTrustedLocation: boolean;
    locationName?: string;
    trustedLocation?: TrustedLocationResult;
    distance?: number;
  }> {
    try {
      const user = await User.findById(userId).select('settings.trustedLocations');
      if (!user || !user.settings.trustedLocations) {
        return { isAtTrustedLocation: false };
      }

      const [longitude, latitude] = coordinates;

      for (const location of user.settings.trustedLocations) {
        if (!location.coordinates?.coordinates) continue;

        const [locLng, locLat] = location.coordinates.coordinates;
        const distance = GeocodingService.calculateDistance(latitude, longitude, locLat, locLng);
        
        // Convert radius from meters to kilometers
        const radiusKm = location.radius / 1000;
        
        if (distance <= radiusKm) {
          return {
            isAtTrustedLocation: true,
            locationName: location.name,
            trustedLocation: {
              _id: location._id.toString(),
              name: location.name,
              coordinates: location.coordinates,
              address: location.address,
              radius: location.radius,
              isHome: location.isHome,
              isWork: location.isWork,
              notes: location.notes,
              createdAt: location.createdAt,
            },
            distance: distance * 1000, // Return in meters
          };
        }
      }

      return { isAtTrustedLocation: false };
    } catch (error: any) {
      logger.error('Check trusted location error:', error);
      return { isAtTrustedLocation: false };
    }
  }
}

export default LocationService;