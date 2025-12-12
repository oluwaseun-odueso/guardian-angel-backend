export class GeoUtils {
  /**
   * Calculate distance between two points in kilometers
   * Using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if a point is within a radius of another point
   */
  static isWithinRadius(
    pointLat: number,
    pointLon: number,
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(pointLat, pointLon, centerLat, centerLon);
    return distance <= radiusKm;
  }

  /**
   * Calculate bounding box for geospatial queries
   */
  static getBoundingBox(
    lat: number,
    lon: number,
    radiusKm: number
  ): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
    const earthRadius = 6371;
    const latDelta = radiusKm / earthRadius * (180 / Math.PI);
    const lonDelta = latDelta / Math.cos(lat * Math.PI / 180);

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLon: lon - lonDelta,
      maxLon: lon + lonDelta,
    };
  }
}

export default GeoUtils;