// scripts/migrate-trusted-locations.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const GeocodingService = require('../src/services/geocoding.service');

async function migrateTrustedLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find({
      'settings.trustedLocations': { $exists: true, $not: { $size: 0 } }
    });
    
    console.log(`Found ${users.length} users with trusted locations`);
    
    for (const user of users) {
      console.log(`Processing user: ${user._id}`);
      
      for (const location of user.settings.trustedLocations) {
        try {
          // Skip if already migrated
          if (location.address && location.staticMapUrl) {
            console.log(`  Location ${location._id} already migrated, skipping`);
            continue;
          }
          
          // Extract coordinates (MongoDB format: [lng, lat])
          const [longitude, latitude] = location.coordinates.coordinates;
          
          // Get address details
          const addressData = await GeocodingService.reverseGeocode({
            latitude,
            longitude
          });
          
          // Generate static map URL
          const staticMapUrl = GeocodingService.getStaticMapUrl(
            { latitude, longitude },
            [
              {
                coordinates: { latitude, longitude },
                label: '🏠',
                color: 'green',
              },
            ],
            15,
            '300x200'
          );
          
          // Update the location
          location.address = {
            formatted: addressData?.formattedAddress || 'Address not available',
            street: addressData?.street || '',
            city: addressData?.city || '',
            state: addressData?.state || '',
            country: addressData?.country || '',
            postalCode: addressData?.postalCode || '',
            neighborhood: addressData?.neighborhood || '',
            placeId: addressData?.placeId || '',
          };
          
          location.staticMapUrl = staticMapUrl;
          
          console.log(`  Migrated location: ${location.name}`);
        } catch (error) {
          console.error(`  Error migrating location ${location._id}:`, error.message);
          // Set defaults if geocoding fails
          location.address = {
            formatted: 'Address not available',
            street: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            neighborhood: '',
            placeId: '',
          };
          location.staticMapUrl = '';
        }
      }
      
      await user.save();
      console.log(`  Saved user ${user._id}`);
    }
    
    console.log('Migration completed successfully');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateTrustedLocations();