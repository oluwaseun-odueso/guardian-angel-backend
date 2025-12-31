// scripts/test-hospitals.js
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
// const Hospital = require('@models/hospital.model');
const Hospital = require('../src/models/hospital.model.ts')

async function testHospitals() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/guardian-angel');
    console.log('✅ Connected to MongoDB');
    
    // Count hospitals by country
    const ukCount = await Hospital.countDocuments({ country: 'United Kingdom' });
    const nigeriaCount = await Hospital.countDocuments({ country: 'Nigeria' });
    
    console.log('\n📊 Hospital Counts:');
    console.log('==================');
    console.log(`🇬🇧 UK Hospitals: ${ukCount}`);
    console.log(`🇳🇬 Nigeria Hospitals: ${nigeriaCount}`);
    console.log(`🏥 Total: ${ukCount + nigeriaCount}`);
    
    // Sample a few hospitals
    console.log('\n📋 Sample Hospitals:');
    console.log('===================');
    
    const sampleHospitals = await Hospital.find()
      .select('name city country emergencyServices totalBeds')
      .limit(5)
      .lean();
    
    sampleHospitals.forEach((hospital, index) => {
      console.log(`${index + 1}. ${hospital.name}`);
      console.log(`   📍 ${hospital.city}, ${hospital.country}`);
      console.log(`   🏥 Emergency: ${hospital.emergencyServices ? '✅' : '❌'}`);
      console.log(`   🛏️  Beds: ${hospital.totalBeds || 'N/A'}`);
      console.log();
    });
    
    // Test geospatial query
    console.log('🗺️ Testing geospatial query (London area):');
    console.log('=========================================');
    
    const londonHospitals = await Hospital.find({
      coordinates: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [-0.118092, 51.498838] // St Thomas' location
          },
          $maxDistance: 10000 // 10km
        }
      }
    })
    .select('name distance')
    .lean();
    
    console.log(`Found ${londonHospitals.length} hospitals within 10km of London`);
    londonHospitals.forEach(hospital => {
      console.log(`📍 ${hospital.name}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testHospitals();