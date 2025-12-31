// scripts/seed-hospitals.js
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const path = require('path');

// Add project root to path to find models
require('module-alias/register');
// const Hospital = require('@models/hospital.model');
const Hospital = require('../src/models/hospital.model.ts')

// Sample hospital data for UK and Nigeria
const UK_HOSPITALS = [
  {
    name: "St Thomas' Hospital",
    address: "Westminster Bridge Rd, London SE1 7EH, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-0.118092, 51.498838] // [longitude, latitude]
    },
    phone: "+44 20 7188 7188",
    type: "hospital",
    services: ["Emergency", "ICU", "Surgery", "Maternity", "Cardiology"],
    emergencyServices: true,
    totalBeds: 840,
    emergencyBeds: 120,
    country: "United Kingdom",
    city: "London",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Guy's Hospital",
    address: "Great Maze Pond, London SE1 9RT, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-0.0889, 51.5044]
    },
    phone: "+44 20 7188 7188",
    type: "hospital",
    services: ["Emergency", "Cancer Care", "Surgery", "Neurology"],
    emergencyServices: true,
    totalBeds: 1100,
    emergencyBeds: 150,
    country: "United Kingdom",
    city: "London",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "King's College Hospital",
    address: "Denmark Hill, London SE5 9RS, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-0.1028, 51.4687]
    },
    phone: "+44 20 3299 9000",
    type: "hospital",
    services: ["Emergency", "Trauma", "Liver", "Neurosurgery"],
    emergencyServices: true,
    totalBeds: 950,
    emergencyBeds: 130,
    country: "United Kingdom",
    city: "London",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Royal London Hospital",
    address: "Whitechapel Rd, London E1 1FR, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-0.0577, 51.5192]
    },
    phone: "+44 20 7377 7000",
    type: "hospital",
    services: ["Emergency", "Trauma", "Helipad", "Major Incident"],
    emergencyServices: true,
    totalBeds: 875,
    emergencyBeds: 110,
    country: "United Kingdom",
    city: "London",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Queen Elizabeth Hospital Birmingham",
    address: "Mindelsohn Way, Birmingham B15 2GW, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-1.9441, 52.4486]
    },
    phone: "+44 121 371 2000",
    type: "hospital",
    services: ["Emergency", "Major Trauma", "Burns", "Transplant"],
    emergencyServices: true,
    totalBeds: 1213,
    emergencyBeds: 180,
    country: "United Kingdom",
    city: "Birmingham",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Manchester Royal Infirmary",
    address: "Oxford Rd, Manchester M13 9WL, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-2.2350, 53.4620]
    },
    phone: "+44 161 276 1234",
    type: "hospital",
    services: ["Emergency", "Cardiac", "Stroke", "Renal"],
    emergencyServices: true,
    totalBeds: 750,
    emergencyBeds: 100,
    country: "United Kingdom",
    city: "Manchester",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "John Radcliffe Hospital",
    address: "Headley Way, Headington, Oxford OX3 9DU, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-1.2172, 51.7639]
    },
    phone: "+44 1865 741166",
    type: "hospital",
    services: ["Emergency", "Major Trauma", "Neurosciences", "Heart Centre"],
    emergencyServices: true,
    totalBeds: 900,
    emergencyBeds: 125,
    country: "United Kingdom",
    city: "Oxford",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Addenbrooke's Hospital",
    address: "Hills Rd, Cambridge CB2 0QQ, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [0.1389, 52.1768]
    },
    phone: "+44 1223 245151",
    type: "hospital",
    services: ["Emergency", "Trauma", "Transplant", "Oncology"],
    emergencyServices: true,
    totalBeds: 1100,
    emergencyBeds: 140,
    country: "United Kingdom",
    city: "Cambridge",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Royal Infirmary of Edinburgh",
    address: "51 Little France Cres, Edinburgh EH16 4SA, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-3.1347, 55.9217]
    },
    phone: "+44 131 242 1000",
    type: "hospital",
    services: ["Emergency", "Trauma", "Cardiac", "Neurosurgery"],
    emergencyServices: true,
    totalBeds: 900,
    emergencyBeds: 120,
    country: "United Kingdom",
    city: "Edinburgh",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Royal Victoria Hospital Belfast",
    address: "274 Grosvenor Rd, Belfast BT12 6BA, United Kingdom",
    coordinates: {
      type: "Point",
      coordinates: [-5.9596, 54.5870]
    },
    phone: "+44 28 9024 0503",
    type: "hospital",
    services: ["Emergency", "ICU", "Maternity", "Surgery"],
    emergencyServices: true,
    totalBeds: 800,
    emergencyBeds: 110,
    country: "United Kingdom",
    city: "Belfast",
    registrationStatus: "verified",
    isActive: true
  }
];

const NIGERIA_HOSPITALS = [
  {
    name: "University College Hospital Ibadan",
    address: "Queen Elizabeth Rd, Ibadan, Oyo State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [3.8980, 7.4390]
    },
    phone: "+234 802 223 4368",
    type: "hospital",
    services: ["Emergency", "Teaching", "Research", "Specialist Care"],
    emergencyServices: true,
    totalBeds: 1000,
    emergencyBeds: 150,
    country: "Nigeria",
    city: "Ibadan",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Lagos University Teaching Hospital (LUTH)",
    address: "Idi-Araba, Lagos, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [3.3550, 6.5190]
    },
    phone: "+234 1 774 7422",
    type: "hospital",
    services: ["Emergency", "Teaching", "Trauma", "ICU"],
    emergencyServices: true,
    totalBeds: 850,
    emergencyBeds: 120,
    country: "Nigeria",
    city: "Lagos",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "National Hospital Abuja",
    address: "Plot 132 Central District, Garki, Abuja, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [7.4913, 9.0579]
    },
    phone: "+234 9 234 1000",
    type: "hospital",
    services: ["Emergency", "Cardiac", "Cancer", "Neurosurgery"],
    emergencyServices: true,
    totalBeds: 650,
    emergencyBeds: 100,
    country: "Nigeria",
    city: "Abuja",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Ahmadu Bello University Teaching Hospital (ABUTH)",
    address: "Zaria-Kaduna Expressway, Shika, Zaria, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [7.6650, 11.1270]
    },
    phone: "+234 69 550 777",
    type: "hospital",
    services: ["Emergency", "Teaching", "Surgery", "Maternity"],
    emergencyServices: true,
    totalBeds: 700,
    emergencyBeds: 90,
    country: "Nigeria",
    city: "Zaria",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "University of Nigeria Teaching Hospital (UNTH)",
    address: "Ituku/Ozalla, Enugu State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [7.5500, 6.4330]
    },
    phone: "+234 42 771 111",
    type: "hospital",
    services: ["Emergency", "Cardiac", "Teaching", "Research"],
    emergencyServices: true,
    totalBeds: 800,
    emergencyBeds: 110,
    country: "Nigeria",
    city: "Enugu",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "University of Calabar Teaching Hospital (UCTH)",
    address: "Marian Rd, Calabar, Cross River State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [8.3417, 4.9757]
    },
    phone: "+234 87 232 350",
    type: "hospital",
    services: ["Emergency", "Teaching", "Maternity", "Surgery"],
    emergencyServices: true,
    totalBeds: 600,
    emergencyBeds: 80,
    country: "Nigeria",
    city: "Calabar",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Aminu Kano Teaching Hospital (AKTH)",
    address: "Zaria Rd, Kano, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [8.5330, 12.0022]
    },
    phone: "+234 64 647 777",
    type: "hospital",
    services: ["Emergency", "Teaching", "Trauma", "ICU"],
    emergencyServices: true,
    totalBeds: 750,
    emergencyBeds: 100,
    country: "Nigeria",
    city: "Kano",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Federal Medical Centre Abeokuta",
    address: "Idi-Aba, Abeokuta, Ogun State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [3.3819, 7.1470]
    },
    phone: "+234 803 702 8474",
    type: "hospital",
    services: ["Emergency", "Maternity", "Surgery", "Pediatrics"],
    emergencyServices: true,
    totalBeds: 500,
    emergencyBeds: 70,
    country: "Nigeria",
    city: "Abeokuta",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "St. Nicholas Hospital Lagos",
    address: "57 Campbell St, Lagos Island, Lagos, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [3.3950, 6.4510]
    },
    phone: "+234 1 263 2450",
    type: "hospital",
    services: ["Emergency", "Cardiac", "Dialysis", "ICU"],
    emergencyServices: true,
    totalBeds: 150,
    emergencyBeds: 30,
    country: "Nigeria",
    city: "Lagos",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Reddington Hospital Lagos",
    address: "12 Idowu Martins St, Victoria Island, Lagos, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [3.4230, 6.4300]
    },
    phone: "+234 700 733 3846",
    type: "hospital",
    services: ["Emergency", "ICU", "Cardiology", "Oncology"],
    emergencyServices: true,
    totalBeds: 120,
    emergencyBeds: 25,
    country: "Nigeria",
    city: "Lagos",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Garki Hospital Abuja",
    address: "Area 11, Garki, Abuja, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [7.4880, 9.0530]
    },
    phone: "+234 9 780 0000",
    type: "hospital",
    services: ["Emergency", "Maternity", "Surgery", "ICU"],
    emergencyServices: true,
    totalBeds: 200,
    emergencyBeds: 40,
    country: "Nigeria",
    city: "Abuja",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Federal Teaching Hospital Ido-Ekiti",
    address: "Ido-Ekiti, Ekiti State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [5.1130, 7.6170]
    },
    phone: "+234 803 722 3355",
    type: "hospital",
    services: ["Emergency", "Teaching", "Maternity", "Surgery"],
    emergencyServices: true,
    totalBeds: 450,
    emergencyBeds: 65,
    country: "Nigeria",
    city: "Ido-Ekiti",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Irrua Specialist Teaching Hospital",
    address: "Irrua, Edo State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [6.2330, 6.7500]
    },
    phone: "+234 55 250 000",
    type: "hospital",
    services: ["Emergency", "Teaching", "Infectious Diseases", "Research"],
    emergencyServices: true,
    totalBeds: 400,
    emergencyBeds: 60,
    country: "Nigeria",
    city: "Irrua",
    registrationStatus: "verified",
    isActive: true
  },
  {
    name: "Braithwaite Memorial Specialist Hospital",
    address: "Moscow Rd, Port Harcourt, Rivers State, Nigeria",
    coordinates: {
      type: "Point",
      coordinates: [7.0130, 4.8170]
    },
    phone: "+234 84 237 373",
    type: "hospital",
    services: ["Emergency", "Specialist", "Surgery", "Maternity"],
    emergencyServices: true,
    totalBeds: 300,
    emergencyBeds: 50,
    country: "Nigeria",
    city: "Port Harcourt",
    registrationStatus: "verified",
    isActive: true
  }
];

async function seedHospitals() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/guardian-angel';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Clear existing hospitals (optional - comment out if you want to keep existing)
    // console.log('🗑️ Clearing existing hospitals...');
    // await Hospital.deleteMany({});
    // console.log('✅ Existing hospitals cleared');
    
    // Seed UK hospitals
    console.log('🇬🇧 Seeding UK hospitals...');
    let ukCreated = 0;
    let ukUpdated = 0;
    
    for (const hospitalData of UK_HOSPITALS) {
      // Check if hospital already exists (by name and city)
      const existingHospital = await Hospital.findOne({
        name: hospitalData.name,
        city: hospitalData.city,
        country: hospitalData.country
      });
      
      if (existingHospital) {
        // Update existing hospital
        existingHospital.set({
          ...hospitalData,
          verifiedAt: new Date(),
          updatedAt: new Date()
        });
        await existingHospital.save();
        ukUpdated++;
        console.log(`🔄 Updated: ${hospitalData.name}`);
      } else {
        // Create new hospital
        await Hospital.create({
          ...hospitalData,
          verifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        ukCreated++;
        console.log(`✅ Created: ${hospitalData.name}`);
      }
    }
    
    // Seed Nigeria hospitals
    console.log('🇳🇬 Seeding Nigeria hospitals...');
    let ngCreated = 0;
    let ngUpdated = 0;
    
    for (const hospitalData of NIGERIA_HOSPITALS) {
      // Check if hospital already exists (by name and city)
      const existingHospital = await Hospital.findOne({
        name: hospitalData.name,
        city: hospitalData.city,
        country: hospitalData.country
      });
      
      if (existingHospital) {
        // Update existing hospital
        existingHospital.set({
          ...hospitalData,
          verifiedAt: new Date(),
          updatedAt: new Date()
        });
        await existingHospital.save();
        ngUpdated++;
        console.log(`🔄 Updated: ${hospitalData.name}`);
      } else {
        // Create new hospital
        await Hospital.create({
          ...hospitalData,
          verifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        ngCreated++;
        console.log(`✅ Created: ${hospitalData.name}`);
      }
    }
    
    console.log('\n📊 Seeding Summary:');
    console.log('==================');
    console.log(`🇬🇧 UK Hospitals: ${ukCreated} created, ${ukUpdated} updated`);
    console.log(`🇳🇬 Nigeria Hospitals: ${ngCreated} created, ${ngUpdated} updated`);
    console.log(`📈 Total: ${ukCreated + ngCreated} created, ${ukUpdated + ngUpdated} updated`);
    
    // Get total count
    const totalHospitals = await Hospital.countDocuments();
    console.log(`🏥 Total hospitals in database: ${totalHospitals}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding hospitals:', error);
    process.exit(1);
  }
}

// Run the seed function
seedHospitals();