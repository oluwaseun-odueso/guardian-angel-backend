import { Response } from 'express';
import LocationService, { TrustedLocationInput } from '../services/location.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class LocationController {
  static async updateLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { coordinates, accuracy, batteryLevel, alertId } = req.body;
      
      await LocationService.updateUserLocation({
        userId: req.user._id.toString(),
        coordinates,
        accuracy,
        batteryLevel,
        alertId,
      });

      return ResponseHandler.success(res, null, 'Location updated');
    } catch (error: any) {
      logger.error('Update location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getLocationHistory(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { startDate, endDate, limit } = req.query;
      
      const history = await LocationService.getUserLocationHistory(
        req.user._id.toString(),
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );

      return ResponseHandler.success(res, history, 'Location history retrieved');
    } catch (error: any) {
      logger.error('Get location history error:', error);
      return ResponseHandler.error(res, 'Failed to get location history');
    }
  }

  static async getCurrentLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const user = req.user;
      
      if (!user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      if (!user.lastKnownLocation) {
        return ResponseHandler.notFound(res, 'No location data available');
      }

      return ResponseHandler.success(res, {
        coordinates: user.lastKnownLocation.coordinates,
        accuracy: user.lastKnownLocation.accuracy,
        timestamp: user.lastKnownLocation.timestamp,
      }, 'Current location retrieved');
    } catch (error: any) {
      logger.error('Get current location error:', error);
      return ResponseHandler.error(res, 'Failed to get current location');
    }
  }

  static async addTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { name, address, coordinates, radius, isHome, isWork, notes } = req.body;

      // Validate input
      if (!name) {
        return ResponseHandler.error(res, 'Location name is required', 400);
      }

      if (!address && !coordinates) {
        return ResponseHandler.error(res, 'Either address or coordinates must be provided', 400);
      }

      if (coordinates && (!Array.isArray(coordinates) || coordinates.length !== 2)) {
        return ResponseHandler.error(res, 'Coordinates must be an array [longitude, latitude]', 400);
      }

      const input: TrustedLocationInput = {
        name,
        address,
        coordinates: coordinates as [number, number],
        radius: radius || 100,
        isHome: isHome || false,
        isWork: isWork || false,
        notes,
      };

      const result = await LocationService.addTrustedLocation(
        req.user._id.toString(),
        input
      );

      return ResponseHandler.success(
        res, 
        result, 
        'Trusted location added successfully', 
        201
      );
    } catch (error: any) {
      logger.error('Add trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  /**
   * Get all trusted locations for the user
   * Optional: sort by distance from current location
   */
  static async getTrustedLocations(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { lat, lng } = req.query;
      
      let currentLocation;
      if (lat && lng) {
        currentLocation = {
          latitude: parseFloat(lat as string),
          longitude: parseFloat(lng as string),
        };
      }

      const locations = await LocationService.getTrustedLocations(
        req.user._id.toString(),
        currentLocation
      );

      return ResponseHandler.success(
        res, 
        { locations, count: locations.length }, 
        'Trusted locations retrieved'
      );
    } catch (error: any) {
      logger.error('Get trusted locations error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  /**
   * Search addresses for autocomplete
   */
  static async searchAddresses(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length < 3) {
        return ResponseHandler.error(res, 'Search query must be at least 3 characters', 400);
      }

      const results = await LocationService.searchAddresses(query.trim());

      return ResponseHandler.success(
        res, 
        { results }, 
        'Address search results'
      );
    } catch (error: any) {
      logger.error('Search addresses error:', error);
      return ResponseHandler.error(res, 'Failed to search addresses', 400);
    }
  }

  /**
   * Update a trusted location
   */
  static async updateTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { locationId } = req.params;
      const updates = req.body;

      if (!locationId) {
        return ResponseHandler.error(res, 'Location ID is required', 400);
      }

      const result = await LocationService.updateTrustedLocation(
        req.user._id.toString(),
        locationId,
        updates
      );

      return ResponseHandler.success(res, result, 'Trusted location updated');
    } catch (error: any) {
      logger.error('Update trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  /**
   * Delete a trusted location
   */
  static async deleteTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { locationId } = req.params;

      if (!locationId) {
        return ResponseHandler.error(res, 'Location ID is required', 400);
      }

      const success = await LocationService.deleteTrustedLocation(
        req.user._id.toString(),
        locationId
      );

      if (!success) {
        return ResponseHandler.error(res, 'Failed to delete trusted location', 400);
      }

      return ResponseHandler.success(res, null, 'Trusted location deleted');
    } catch (error: any) {
      logger.error('Delete trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async checkTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }

      const { lat, lng } = req.body;

      if (!lat || !lng) {
        return ResponseHandler.error(res, 'Current coordinates are required', 400);
      }

      const coordinates: [number, number] = [parseFloat(lng), parseFloat(lat)];

      const result = await LocationService.isAtTrustedLocation(
        req.user._id.toString(),
        coordinates
      );

      return ResponseHandler.success(res, result, 'Trusted location check completed');
    } catch (error: any) {
      logger.error('Check trusted location error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  // static async addTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     const { name, coordinates, radius } = req.body;
      
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }

  //     const user = await (await import('../models/user.model')).default.findByIdAndUpdate(
  //       req.user._id,
  //       {
  //         $push: {
  //           'settings.trustedLocations': {
  //             name,
  //             coordinates: {
  //               type: 'Point',
  //               coordinates,
  //             },
  //             radius: radius || 100,
  //           },
  //         },
  //       },
  //       { new: true }
  //     );

  //     return ResponseHandler.success(res, user, 'Trusted location added');
  //   } catch (error: any) {
  //     logger.error('Add trusted location error:', error);
  //     return ResponseHandler.error(res, error.message, 400);
  //   }
  // }

  // static async removeTrustedLocation(req: AuthRequest, res: Response): Promise<Response> {
  //   try {
  //     const { locationId } = req.params;
      
  //     if (!req.user) {
  //       return ResponseHandler.error(res, 'User not authenticated', 401);
  //     }

  //     const user = await (await import('../models/user.model')).default.findByIdAndUpdate(
  //       req.user._id,
  //       {
  //         $pull: {
  //           'settings.trustedLocations': { _id: locationId },
  //         },
  //       },
  //       { new: true }
  //     );

  //     return ResponseHandler.success(res, user, 'Trusted location removed');
  //   } catch (error: any) {
  //     logger.error('Remove trusted location error:', error);
  //     return ResponseHandler.error(res, error.message, 400);
  //   }
  // }
}

export default LocationController;