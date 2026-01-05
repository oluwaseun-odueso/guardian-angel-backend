// services/HospitalRegistrationService.ts
import Hospital, { IHospital } from '../models/hospital.model';
import GeocodingService from './geocoding.service';
import logger from '../utils/logger';
import mongoose from 'mongoose';

class HospitalRegistrationService {
  static async findAndRegisterNearbyHospitals(
    coordinates: { latitude: number; longitude: number },
    radius: number = 5000, // 5km default
  ): Promise<IHospital[]> {
    try {
      // Step 1: Get nearby hospitals from Google Places
      const nearbyPlaces = await GeocodingService.getNearbyPlaces(
        coordinates,
        radius,
        'hospital'
      );

      const registeredHospitals: IHospital[] = [];

      // Step 2: For each place, check if exists or create new
      for (const place of nearbyPlaces) {
        const existingHospital = await Hospital.findOne({
          googlePlaceId: place.placeId,
        });

        if (existingHospital) {
          // Already exists, update if needed
          if (existingHospital.registrationStatus === 'verified') {
            registeredHospitals.push(existingHospital);
          }
          continue;
        }

        // Step 3: Create new hospital record
        // Extract city from address (simplified - you might want to use geocoding reverse)
        const city = await this.extractCityFromAddress(place.address, place.coordinates);
        const country = await this.extractCountryFromAddress(place.address, place.coordinates);

        const newHospital = new Hospital({
          name: place.name,
          googlePlaceId: place.placeId,
          address: place.address,
          coordinates: {
            type: 'Point',
            coordinates: [place.coordinates.longitude, place.coordinates.latitude],
          },
          type: 'hospital',
          emergencyServices: true, // Assume yes for hospitals
          registrationStatus: 'pending',
          country,
          city,
          isActive: true,
        });

        await newHospital.save();
        
        // Auto-verify based on certain criteria (optional)
        if (this.shouldAutoVerify(newHospital, country)) {
          newHospital.registrationStatus = 'verified';
          newHospital.verifiedAt = new Date();
          await newHospital.save();
        }

        if (newHospital.registrationStatus === 'verified') {
          registeredHospitals.push(newHospital);
        }
      }

      return registeredHospitals;
    } catch (error) {
      logger.error('Error finding and registering hospitals:', error);
      return [];
    }
  }

  static async findOrCreateHospital(
    hospitalName: string,
    coordinates?: { latitude: number; longitude: number }
  ): Promise<IHospital> {
    try {
      // First, try to find by name (case-insensitive)
      const existingHospital = await Hospital.findOne({
        name: { $regex: new RegExp(`^${hospitalName}$`, 'i') }
      });

      if (existingHospital) {
        return existingHospital;
      }

      // If coordinates provided, try to find nearby hospitals with similar names
      if (coordinates) {
        const nearbyHospitals = await Hospital.find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [coordinates.longitude, coordinates.latitude]
              },
              $maxDistance: 5000 // 5km
            }
          },
          name: { $regex: hospitalName, $options: 'i' }
        }).limit(1);

        if (nearbyHospitals.length > 0) {
          return nearbyHospitals[0];
        }
      }

      // Create a new hospital
      const newHospitalData: any = {
        name: hospitalName,
        address: coordinates 
          ? await this.generateAddressFromCoordinates(coordinates)
          : `${hospitalName}, Unknown Location`,
        coordinates: coordinates 
          ? {
              type: 'Point' as const,
              coordinates: [coordinates.longitude, coordinates.latitude]
            }
          : undefined,
        type: 'hospital' as const,
        emergencyServices: true,
        registrationStatus: 'pending',
        isActive: true,
        city: 'Unknown',
        country: 'Unknown'
      };

      // Try to get location details from coordinates
      if (coordinates) {
        try {
          const reverseGeocode = await GeocodingService.reverseGeocode(coordinates);
          if (reverseGeocode) {
            newHospitalData.city = reverseGeocode.city || 'Unknown';
            newHospitalData.country = reverseGeocode.country || 'Unknown';
            newHospitalData.address = reverseGeocode.formattedAddress || newHospitalData.address;
          }
        } catch (error) {
          logger.warn('Could not reverse geocode hospital location:', error);
        }
      }

      const newHospital = await Hospital.create(newHospitalData);
      logger.info(`Created new hospital: ${hospitalName} (${newHospital._id})`);

      return newHospital;
    } catch (error) {
      logger.error('Error in findOrCreateHospital:', error);
      throw new Error(`Could not find or create hospital: ${hospitalName}`);
    }
  }

  static async getHospitalByIdOrName(
    hospitalIdentifier: string
  ): Promise<IHospital | null> {
    try {
      // Check if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(hospitalIdentifier)) {
        const hospital = await Hospital.findById(hospitalIdentifier);
        if (hospital) return hospital;
      }

      // If not an ObjectId, search by name
      const hospital = await Hospital.findOne({
        name: { $regex: new RegExp(`^${hospitalIdentifier}$`, 'i') }
      });

      return hospital;
    } catch (error) {
      logger.error('Error getting hospital:', error);
      return null;
    }
  }

  static async getHospitalsForSelection(
    search?: string,
    limit: number = 20
  ): Promise<Array<{ _id: string; name: string; city: string; country: string }>> {
    const query: any = { registrationStatus: 'verified', isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const hospitals = await Hospital.find(query)
      .select('name city country')
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    return hospitals.map(h => ({
      _id: h._id.toString(),
      name: h.name,
      city: h.city,
      country: h.country
    }));
  }

  private static async generateAddressFromCoordinates(
    coordinates: { latitude: number; longitude: number }
  ): Promise<string> {
    try {
      const reverseGeocode = await GeocodingService.reverseGeocode(coordinates);
      return reverseGeocode?.formattedAddress || `${coordinates.latitude}, ${coordinates.longitude}`;
    } catch (error) {
      return `${coordinates.latitude}, ${coordinates.longitude}`;
    }
  }

  private static async extractCityFromAddress(address: string, coordinates: { latitude: number; longitude: number }): Promise<string> {
    try {
      // Use reverse geocoding to get city
      const reverseGeocode = await GeocodingService.reverseGeocode(coordinates);

      if (!reverseGeocode) throw new Error("Reverse Geocode failed")
      return reverseGeocode.city || 'Unknown';
    } catch (error) {
      // Fallback: extract from address
      const addressParts = address.split(',');
      return addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'Unknown';
    }
  }

  private static async extractCountryFromAddress(
    address: string, 
    coordinates: { latitude: number; longitude: number }
  ): Promise<string> {
    try {
      // First, try to get country from reverse geocoding
      const reverseGeocode = await GeocodingService.reverseGeocode(coordinates);
      
      if (reverseGeocode && reverseGeocode.country) {
        return reverseGeocode.country;
      }
      
      // Fallback: extract from address (last part usually)
      const addressParts = address.split(',');
      if (addressParts.length > 0) {
        const lastPart = addressParts[addressParts.length - 1].trim();
        
        // Common country names to look for
        const countryKeywords = [
          'Nigeria', 'United Kingdom', 'UK', 'England', 'Scotland', 
          'Wales', 'Northern Ireland', 'Ireland', 'USA', 'United States',
          'Canada', 'Australia', 'France', 'Germany', 'Italy', 'Spain'
        ];
        
        // Check if last part contains a country name
        for (const country of countryKeywords) {
          if (lastPart.toLowerCase().includes(country.toLowerCase())) {
            // Standardize country names
            if (country === 'UK' || country === 'United Kingdom') return 'United Kingdom';
            if (country === 'USA' || country === 'United States') return 'United States';
            return country;
          }
        }
        
        return lastPart;
      }
      
      return 'Unknown';
    } catch (error) {
      console.error('Error extracting country from address:', error);
      
      // Final fallback: extract last part of address
      const addressParts = address.split(',');
      return addressParts.length > 0 ? addressParts[addressParts.length - 1].trim() : 'Unknown';
    }
  }

  private static shouldAutoVerify(hospital: IHospital, country: string): boolean {
    // Auto-verify criteria
    const keywords = ['hospital', 'medical center', 'health centre', 'clinic'];
    const nameLower = hospital.name.toLowerCase();
    
    // Check if name contains hospital-related keywords
    const isLikelyHospital = keywords.some(keyword => nameLower.includes(keyword));
    
    // Country-specific criteria
    if (country === 'UK') {
      // NHS hospitals in UK
      return nameLower.includes('nhs') || isLikelyHospital;
    } else if (country === 'Nigeria') {
      // Federal/Teaching hospitals in Nigeria
      return nameLower.includes('teaching') || 
             nameLower.includes('federal') || 
             nameLower.includes('general hospital') ||
             isLikelyHospital;
    }
    
    return isLikelyHospital;
  }

  // Seed database with known hospitals
  // static async seedHospitals(country: string): Promise<void> {
  //   const hospitals = country === 'UK' ? this.getUKHospitals() : this.getNigeriaHospitals();
    
  //   for (const hospital of hospitals) {
  //     const exists = await Hospital.findOne({
  //       $or: [
  //       //   { googlePlaceId: hospital.googlePlaceId },
  //         { name: hospital.name, city: hospital.city }
  //       ]
  //     });

  //     if (!exists) {
  //       await Hospital.create({
  //         ...hospital,
  //         registrationStatus: 'verified',
  //         verifiedAt: new Date(),
  //         isActive: true,
  //         emergencyServices: true,
  //       });
  //     }
  //   }
  // }

  // private static getUKHospitals() {
  //   return [
  //     {
  //       name: 'St Thomas\' Hospital',
  //       address: 'Westminster Bridge Rd, London SE1 7EH',
  //       coordinates: {
  //         type: 'Point',
  //         coordinates: [-0.118092, 51.498838]
  //       },
  //       city: 'London',
  //       country: 'UK',
  //       emergencyServices: true,
  //     },
  //     // Add more UK hospitals...
  //   ];
  // }

  // private static getNigeriaHospitals() {
  //   return [
  //     {
  //       name: 'University College Hospital Ibadan',
  //       address: 'Queen Elizabeth Rd, Ibadan',
  //       coordinates: {
  //         type: 'Point',
  //         coordinates: [3.898, 7.439]
  //       },
  //       city: 'Ibadan',
  //       country: 'Nigeria',
  //       emergencyServices: true,
  //     },
  //     {
  //       name: 'Lagos University Teaching Hospital',
  //       address: 'Idi-Araba, Lagos',
  //       coordinates: {
  //         type: 'Point',
  //         coordinates: [3.355, 6.519]
  //       },
  //       city: 'Lagos',
  //       country: 'Nigeria',
  //       emergencyServices: true,
  //     },
  //     // Add more Nigeria hospitals...
  //   ];
  // }
}

export default HospitalRegistrationService;