// utils/coordinates.ts
export class CoordinateUtils {
  /**
   * Convert [latitude, longitude] (client format) to MongoDB [longitude, latitude] format
   */
  static toMongoDBFormat(coordinates: [number, number]): [number, number] {
    const [lat, lng] = coordinates;
    return [lng, lat]; // Swap for MongoDB
  }

  /**
   * Convert MongoDB [longitude, latitude] format to [latitude, longitude] (client format)
   */
  static fromMongoDBFormat(coordinates: [number, number]): [number, number] {
    const [lng, lat] = coordinates;
    return [lat, lng]; // Swap for client
  }

  /**
   * Extract latitude and longitude from client format [lat, lng]
   */
  static extractLatLngFromClient(coordinates: [number, number]): { latitude: number; longitude: number } {
    const [latitude, longitude] = coordinates;
    return { latitude, longitude };
  }

  /**
   * Extract latitude and longitude from MongoDB format [lng, lat]
   */
  static extractLatLngFromMongo(coordinates: [number, number]): { latitude: number; longitude: number } {
    const [longitude, latitude] = coordinates;
    return { latitude, longitude };
  }

  /**
   * Validate coordinates are in client format [lat, lng]
   */
  static isValidClientCoordinates(coordinates: [number, number]): boolean {
    const [lat, lng] = coordinates;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Validate coordinates are in MongoDB format [lng, lat]
   */
  static isValidMongoDBCoordinates(coordinates: [number, number]): boolean {
    const [lng, lat] = coordinates;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
}