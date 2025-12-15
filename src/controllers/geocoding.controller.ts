import { Response } from 'express';
import GeocodingService from '../services/geocoding.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class GeocodingController {
  static async geocodeAddress(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { address } = req.body;
      
      if (!address) {
        return ResponseHandler.error(res, 'Address is required', 400);
      }

      const coordinates = await GeocodingService.geocodeAddress(address);
      
      if (!coordinates) {
        return ResponseHandler.error(res, 'Could not geocode address', 404);
      }

      return ResponseHandler.success(res, coordinates, 'Address geocoded successfully');
    } catch (error: any) {
      logger.error('Geocode address error:', error);
      return ResponseHandler.error(res, 'Failed to geocode address');
    }
  }

  static async reverseGeocode(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return ResponseHandler.error(res, 'Latitude and Longitude are required', 400);
      }

      const address = await GeocodingService.reverseGeocode({ latitude, longitude });
      
      if (!address) {
        return ResponseHandler.error(res, 'Could not reverse geocode coordinates', 404);
      }

      return ResponseHandler.success(res, address, 'Coordinates reverse geocoded');
    } catch (error: any) {
      logger.error('Reverse geocode error:', error);
      return ResponseHandler.error(res, 'Failed to reverse geocode');
    }
  }

  static async calculateDistance(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { point1, point2, unit = 'km' } = req.body;
      
      if (!point1 || !point2 || !point1.latitude || !point1.longitude || !point2.latitude || !point2.longitude) {
        return ResponseHandler.error(res, 'Valid coordinates are required', 400);
      }

      const distance = await GeocodingService.calculateDistance(point1, point2, unit);
      
      return ResponseHandler.success(res, { distance, unit }, 'Distance calculated');
    } catch (error: any) {
      logger.error('Calculate distance error:', error);
      return ResponseHandler.error(res, 'Failed to calculate distance');
    }
  }

  static async getRoute(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { origin, destination, mode = 'driving' } = req.body;
      
      if (!origin || !destination) {
        return ResponseHandler.error(res, 'Origin and destination are required', 400);
      }

      const route = await GeocodingService.getRoute(origin, destination, mode);
      
      if (!route) {
        return ResponseHandler.error(res, 'Could not calculate route', 404);
      }

      return ResponseHandler.success(res, route, 'Route calculated');
    } catch (error: any) {
      logger.error('Get route error:', error);
      return ResponseHandler.error(res, 'Failed to calculate route');
    }
  }

  static async getNearbyPlaces(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { latitude, longitude, radius = 500, type } = req.query;
      
      if (!latitude || !longitude) {
        return ResponseHandler.error(res, 'Latitude and longitude are required', 400);
      }

      const places = await GeocodingService.getNearbyPlaces(
        { latitude: parseFloat(latitude as string), longitude: parseFloat(longitude as string) },
        parseInt(radius as string),
        type as string
      );

      return ResponseHandler.success(res, places, 'Nearby places retrieved');
    } catch (error: any) {
      logger.error('Get nearby places error:', error);
      return ResponseHandler.error(res, 'Failed to get nearby places');
    }
  }

  static async getStaticMap(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { latitude, longitude, zoom = 14, size = '600x400' } = req.query;
      
      if (!latitude || !longitude) {
        return ResponseHandler.error(res, 'Latitude and longitude are required', 400);
      }

      const mapUrl = GeocodingService.getStaticMapUrl(
        { latitude: parseFloat(latitude as string), longitude: parseFloat(longitude as string) },
        undefined,
        parseInt(zoom as string),
        size as string
      );

      return ResponseHandler.success(res, { mapUrl }, 'Static map URL generated');
    } catch (error: any) {
      logger.error('Get static map error:', error);
      return ResponseHandler.error(res, 'Failed to generate static map');
    }
  }
}

export default GeocodingController;