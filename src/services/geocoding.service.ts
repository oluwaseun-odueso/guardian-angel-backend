import axios from 'axios';
import NodeCache from 'node-cache';
import logger from '../utils/logger';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeoAddress {
  formattedAddress: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  neighborhood?: string;
  placeId?: string;
}

export class GeocodingService {
  private static instance: GeocodingService;
  private cache: NodeCache;
  private googleApiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  private constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 86400, // 24 hours cache
      checkperiod: 600 // Check every 10 minutes
    });
    this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!this.googleApiKey) {
      logger.warn('Google Maps API key not configured. Geocoding will be limited.');
    }
  }

  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c

    return Math.round(distance * 100) / 100; // Distance in km
  }

  private static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Find nearest responders with distance calculation
  async findNearestResponders(
    coordinates: GeoCoordinates,
    maxDistanceKm: number = 10,
    limit: number = 10
  ): Promise<Array<{
    responderId: string;
    distance: number;
    coordinates: GeoCoordinates;
    rating: number;
    vehicleType?: string;
  }>> {
    try {
      // Import here to avoid circular dependency
      const Responder = await import('../models/responder.model');
      
      // Get all available responders
      const responders = await Responder.default.find({
        status: 'available',
        isActive: true,
        isVerified: true,
        currentLocation: { $ne: null },
      }).lean();

      // Calculate distance for each responder
      const respondersWithDistance = responders
        .map(responder => {
          if (responder.currentLocation?.coordinates) {
            const [latitude, longitude] = responder.currentLocation.coordinates;
            const distance = GeocodingService.calculateDistance(
              coordinates.latitude,
              coordinates.longitude,
              latitude,
              longitude
            );
            
            return {
              responderId: responder.userId.toString(),
              distance,
              coordinates: { latitude, longitude },
              rating: responder.rating,
              vehicleType: responder.vehicleType,
              maxDistance: responder.maxDistance,
            };
          }
          return null;
        })
        .filter(item => 
          item !== null && 
          item.distance <= maxDistanceKm &&
          item.distance <= item.maxDistance
        )
        .sort((a, b) => a!.distance - b!.distance)
        .slice(0, limit);

      return respondersWithDistance as any[];
    } catch (error: any) {
      logger.error('Find nearest responders error:', error);
      return [];
    }
  }

  async reverseGeocode(coordinates: GeoCoordinates): Promise<GeoAddress | null> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google Maps API key missing for reverse geocoding');
        return null;
      }

      const cacheKey = `reverse:${coordinates.latitude},${coordinates.longitude}`;
      const cached = this.cache.get<GeoAddress>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${coordinates.latitude},${coordinates.longitude}`,
          key: this.googleApiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const address = this.parseAddressComponents(result.address_components);
        address.formattedAddress = result.formatted_address;
        address.placeId = result.place_id;

        this.cache.set(cacheKey, address);
        logger.info(`Reverse geocoded: ${coordinates.latitude}, ${coordinates.longitude}`);
        
        return address;
      }

      logger.warn(`Reverse geocoding failed for coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
      return null;
    } catch (error: any) {
      logger.error('Reverse geocoding error:', error);
      return null;
    }
  }

  async getRoute(
    origin: GeoCoordinates,
    destination: GeoCoordinates,
    mode: 'driving' | 'walking' | 'bicycling' = 'driving'
  ): Promise<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    polyline?: string;
  } | null> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google Maps API key missing for route calculation');
        return null;
      }

      const cacheKey = `route:${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}:${mode}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const response = await axios.get(`${this.baseUrl}/directions/json`, {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          mode,
          key: this.googleApiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0].legs[0];
        const result = {
          distance: route.distance,
          duration: route.duration,
          polyline: response.data.routes[0].overview_polyline?.points,
        };

        this.cache.set(cacheKey, result, 300); // Cache routes for 5 minutes
        return result;
      }

      return null;
    } catch (error: any) {
      logger.error('Route calculation error:', error);
      return null;
    }
  }

  async getNearbyPlaces(
    coordinates: GeoCoordinates,
    radius: number = 500, // meters
    type?: string // e.g., 'hospital', 'police', 'pharmacy'
  ): Promise<Array<{
    name: string;
    address: string;
    coordinates: GeoCoordinates;
    distance: number;
    placeId: string;
  }>> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google Maps API key missing for nearby places');
        return [];
      }

      const cacheKey = `nearby:${coordinates.latitude},${coordinates.longitude}:${radius}:${type}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached as any[];
      }

      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
        params: {
          location: `${coordinates.latitude},${coordinates.longitude}`,
          radius,
          type: type || 'point_of_interest',
          key: this.googleApiKey,
        },
      });

      if (response.data.status === 'OK') {
        const places = response.data.results.map((place: any) => ({
          name: place.name,
          address: place.vicinity,
          coordinates: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
          },
          distance: place.distance || 0,
          placeId: place.place_id,
        }));

        this.cache.set(cacheKey, places, 300); // Cache for 5 minutes
        return places;
      }

      return [];
    } catch (error: any) {
      logger.error('Nearby places error:', error);
      return [];
    }
  }

  async geocodeAddress(address: string): Promise<GeoCoordinates | null> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google Maps API key missing for geocoding');
        return null;
      }

      const cacheKey = `geocode:${address}`;
      const cached = this.cache.get<GeoCoordinates>(cacheKey);
      if (cached) {
        logger.debug(`Geocode cache hit for: ${address}`);
        return cached;
      }

      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address,
          key: this.googleApiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        const coordinates: GeoCoordinates = {
          latitude: location.lat,
          longitude: location.lng,
        };

        this.cache.set(cacheKey, coordinates);
        logger.info(`Geocoded address: ${address} → ${coordinates.latitude}, ${coordinates.longitude}`);
        
        return coordinates;
      }

      logger.warn(`Geocoding failed for address: ${address}`, response.data);
      return null;
    } catch (error: any) {
      logger.error('Geocoding error:', error);
      return null;
    }
  }

  getStaticMapUrl(
    coordinates: GeoCoordinates,
    markers?: Array<{
      coordinates: GeoCoordinates;
      label?: string;
      color?: string;
    }>,
    zoom: number = 14,
    size: string = '600x400'
  ): string {
    let url = `${this.baseUrl}/staticmap?center=${coordinates.latitude},${coordinates.longitude}&zoom=${zoom}&size=${size}&key=${this.googleApiKey}`;
    
    if (markers && markers.length > 0) {
      markers.forEach((marker, _index) => {
        const markerParams = [];
        if (marker.color) markerParams.push(`color:${marker.color}`);
        if (marker.label) markerParams.push(`label:${marker.label}`);
        markerParams.push(`${marker.coordinates.latitude},${marker.coordinates.longitude}`);
        
        url += `&markers=${markerParams.join('|')}`;
      });
    }

    return url;
  }

  private parseAddressComponents(components: any[]): GeoAddress {
    const address: Partial<GeoAddress> = {};

    components.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        address.street = component.long_name;
      }
      if (types.includes('route')) {
        address.street = address.street ? `${address.street} ${component.long_name}` : component.long_name;
      }
      if (types.includes('neighborhood')) {
        address.neighborhood = component.long_name;
      }
      if (types.includes('locality')) {
        address.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        address.state = component.long_name;
      }
      if (types.includes('country')) {
        address.country = component.long_name;
      }
      if (types.includes('postal_code')) {
        address.postalCode = component.long_name;
      }
    });

    return address as GeoAddress;
  }
}

export default GeocodingService.getInstance();

// import axios from 'axios';
// import NodeCache from 'node-cache';
// import logger from '../utils/logger';

// export interface GeoCoordinates {
//   latitude: number;
//   longitude: number;
//   accuracy?: number;
// }

// export interface GeoAddress {
//   formattedAddress: string;
//   street?: string;
//   city?: string;
//   state?: string;
//   country?: string;
//   postalCode?: string;
//   neighborhood?: string;
//   placeId?: string;
// }

// export interface GeoResult {
//   coordinates: GeoCoordinates;
//   address: GeoAddress;
//   timestamp: Date;
// }

// export class GeocodingService {
//   private static instance: GeocodingService;
//   private cache: NodeCache;
//   private googleApiKey: string;
//   private baseUrl = 'https://maps.googleapis.com/maps/api';

//   private constructor() {
//     this.cache = new NodeCache({ 
//       stdTTL: 86400, // 24 hours cache
//       checkperiod: 600 // Check every 10 minutes
//     });
//     this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
//     if (!this.googleApiKey) {
//       logger.warn('Google Maps API key not configured. Geocoding will be limited.');
//     }
//   }

//   static getInstance(): GeocodingService {
//     if (!GeocodingService.instance) {
//       GeocodingService.instance = new GeocodingService();
//     }
//     return GeocodingService.instance;
//   }

  // async geocodeAddress(address: string): Promise<GeoCoordinates | null> {
  //   try {
  //     if (!this.googleApiKey) {
  //       logger.warn('Google Maps API key missing for geocoding');
  //       return null;
  //     }

  //     const cacheKey = `geocode:${address}`;
  //     const cached = this.cache.get<GeoCoordinates>(cacheKey);
  //     if (cached) {
  //       logger.debug(`Geocode cache hit for: ${address}`);
  //       return cached;
  //     }

  //     const response = await axios.get(`${this.baseUrl}/geocode/json`, {
  //       params: {
  //         address,
  //         key: this.googleApiKey,
  //       },
  //     });

  //     if (response.data.status === 'OK' && response.data.results.length > 0) {
  //       const location = response.data.results[0].geometry.location;
  //       const coordinates: GeoCoordinates = {
  //         latitude: location.lat,
  //         longitude: location.lng,
  //       };

  //       this.cache.set(cacheKey, coordinates);
  //       logger.info(`Geocoded address: ${address} → ${coordinates.latitude}, ${coordinates.longitude}`);
        
  //       return coordinates;
  //     }

  //     logger.warn(`Geocoding failed for address: ${address}`, response.data);
  //     return null;
  //   } catch (error: any) {
  //     logger.error('Geocoding error:', error);
  //     return null;
  //   }
  // }

//   async reverseGeocode(coordinates: GeoCoordinates): Promise<GeoAddress | null> {
//     try {
//       if (!this.googleApiKey) {
//         logger.warn('Google Maps API key missing for reverse geocoding');
//         return null;
//       }

//       const cacheKey = `reverse:${coordinates.latitude},${coordinates.longitude}`;
//       const cached = this.cache.get<GeoAddress>(cacheKey);
//       if (cached) {
//         logger.debug(`Reverse geocode cache hit for coordinates`);
//         return cached;
//       }

//       const response = await axios.get(`${this.baseUrl}/geocode/json`, {
//         params: {
//           latlng: `${coordinates.latitude},${coordinates.longitude}`,
//           key: this.googleApiKey,
//         },
//       });

//       if (response.data.status === 'OK' && response.data.results.length > 0) {
//         const result = response.data.results[0];
//         const address = this.parseAddressComponents(result.address_components);
//         address.formattedAddress = result.formatted_address;
//         address.placeId = result.place_id;

//         this.cache.set(cacheKey, address);
//         logger.info(`Reverse geocoded: ${coordinates.latitude}, ${coordinates.longitude} → ${address.formattedAddress}`);
        
//         return address;
//       }

//       logger.warn(`Reverse geocoding failed for coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
//       return null;
//     } catch (error: any) {
//       logger.error('Reverse geocoding error:', error);
//       return null;
//     }
//   }

//   private parseAddressComponents(components: any[]): GeoAddress {
//     const address: Partial<GeoAddress> = {};

//     components.forEach(component => {
//       const types = component.types;
      
//       if (types.includes('street_number')) {
//         address.street = component.long_name;
//       }
//       if (types.includes('route')) {
//         address.street = address.street ? `${address.street} ${component.long_name}` : component.long_name;
//       }
//       if (types.includes('neighborhood')) {
//         address.neighborhood = component.long_name;
//       }
//       if (types.includes('locality')) {
//         address.city = component.long_name;
//       }
//       if (types.includes('administrative_area_level_1')) {
//         address.state = component.long_name;
//       }
//       if (types.includes('country')) {
//         address.country = component.long_name;
//       }
//       if (types.includes('postal_code')) {
//         address.postalCode = component.long_name;
//       }
//     });

//     return address as GeoAddress;
//   }

//   async calculateDistance(
//     point1: GeoCoordinates,
//     point2: GeoCoordinates,
//     unit: 'km' | 'miles' = 'km'
//   ): Promise<number> {
//     // Haversine formula
//     const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
//     const dLat = this.toRadians(point2.latitude - point1.latitude);
//     const dLon = this.toRadians(point2.longitude - point1.longitude);
    
//     const a = 
//       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//       Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
//       Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     const distance = R * c;
    
//     return Math.round(distance * 100) / 100; // Round to 2 decimal places
//   }

//   async getRoute(
//     origin: GeoCoordinates,
//     destination: GeoCoordinates,
//     mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
//   ): Promise<{
//     distance: { text: string; value: number };
//     duration: { text: string; value: number };
//     polyline?: string;
//   } | null> {
//     try {
//       if (!this.googleApiKey) {
//         logger.warn('Google Maps API key missing for route calculation');
//         return null;
//       }

//       const cacheKey = `route:${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}:${mode}`;
//       const cached = this.cache.get(cacheKey);
//       if (cached) {
//         return cached as any;
//       }

//       const response = await axios.get(`${this.baseUrl}/directions/json`, {
//         params: {
//           origin: `${origin.latitude},${origin.longitude}`,
//           destination: `${destination.latitude},${destination.longitude}`,
//           mode,
//           key: this.googleApiKey,
//         },
//       });

//       if (response.data.status === 'OK' && response.data.routes.length > 0) {
//         const route = response.data.routes[0].legs[0];
//         const result = {
//           distance: route.distance,
//           duration: route.duration,
//           polyline: response.data.routes[0].overview_polyline?.points,
//         };

//         this.cache.set(cacheKey, result, 300); // Cache routes for 5 minutes
//         return result;
//       }

//       return null;
//     } catch (error: any) {
//       logger.error('Route calculation error:', error);
//       return null;
//     }
//   }

  // async getNearbyPlaces(
  //   coordinates: GeoCoordinates,
  //   radius: number = 500, // meters
  //   type?: string // e.g., 'hospital', 'police', 'pharmacy'
  // ): Promise<Array<{
  //   name: string;
  //   address: string;
  //   coordinates: GeoCoordinates;
  //   distance: number;
  //   placeId: string;
  // }>> {
  //   try {
  //     if (!this.googleApiKey) {
  //       logger.warn('Google Maps API key missing for nearby places');
  //       return [];
  //     }

  //     const cacheKey = `nearby:${coordinates.latitude},${coordinates.longitude}:${radius}:${type}`;
  //     const cached = this.cache.get(cacheKey);
  //     if (cached) {
  //       return cached as any[];
  //     }

  //     const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
  //       params: {
  //         location: `${coordinates.latitude},${coordinates.longitude}`,
  //         radius,
  //         type: type || 'point_of_interest',
  //         key: this.googleApiKey,
  //       },
  //     });

  //     if (response.data.status === 'OK') {
  //       const places = response.data.results.map((place: any) => ({
  //         name: place.name,
  //         address: place.vicinity,
  //         coordinates: {
  //           latitude: place.geometry.location.lat,
  //           longitude: place.geometry.location.lng,
  //         },
  //         distance: place.distance || 0,
  //         placeId: place.place_id,
  //       }));

  //       this.cache.set(cacheKey, places, 300); // Cache for 5 minutes
  //       return places;
  //     }

  //     return [];
  //   } catch (error: any) {
  //     logger.error('Nearby places error:', error);
  //     return [];
  //   }
  // }

//   private toRadians(degrees: number): number {
//     return degrees * (Math.PI / 180);
//   }

//   // Get static map image URL
//   getStaticMapUrl(
//     coordinates: GeoCoordinates,
//     markers?: Array<{
//       coordinates: GeoCoordinates;
//       label?: string;
//       color?: string;
//     }>,
//     zoom: number = 14,
//     size: string = '600x400'
//   ): string {
//     let url = `${this.baseUrl}/staticmap?center=${coordinates.latitude},${coordinates.longitude}&zoom=${zoom}&size=${size}&key=${this.googleApiKey}`;
    
//     if (markers && markers.length > 0) {
//       markers.forEach((marker, _index) => {
//         const markerParams = [];
//         if (marker.color) markerParams.push(`color:${marker.color}`);
//         if (marker.label) markerParams.push(`label:${marker.label}`);
//         markerParams.push(`${marker.coordinates.latitude},${marker.coordinates.longitude}`);
        
//         url += `&markers=${markerParams.join('|')}`;
//       });
//     }

//     return url;
//   }
// }

// export default GeocodingService.getInstance();