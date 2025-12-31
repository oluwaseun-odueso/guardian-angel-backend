// models/Hospital.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IHospital extends Document {
  name: string;
  googlePlaceId: string; // For cross-referencing with Google Places
  address: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number];
  };
  phone?: string;
  email?: string;
  website?: string;
  type: 'hospital' | 'medical_center' | 'clinic' | 'pharmacy';
  services: string[];
  emergencyServices: boolean;
  totalBeds?: number;
  emergencyBeds?: number;
  isActive: boolean;
  registrationStatus: 'pending' | 'verified' | 'rejected';
  registeredBy?: mongoose.Types.ObjectId; // User who registered this hospital
  verificationNotes?: string;
  verifiedAt?: Date;
  country: string;
  city: string;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
  },
  googlePlaceId: {
    type: String,
    unique: true,
    sparse: true, // Some might not have Google Place ID
  },
  address: {
    type: String,
    required: true,
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: [Number], // [longitude, latitude]
  },
  phone: String,
  email: String,
  website: String,
  type: {
    type: String,
    enum: ['hospital', 'medical_center', 'clinic', 'pharmacy'],
    default: 'hospital',
  },
  services: {
    type: [String],
    default: [],
  },
  emergencyServices: {
    type: Boolean,
    default: false,
  },
  totalBeds: Number,
  emergencyBeds: Number,
  isActive: {
    type: Boolean,
    default: true,
  },
  registrationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    // default: 'pending',
    default: 'verified',
  },
  registeredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationNotes: String,
  verifiedAt: Date,
  country: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// Create geospatial index
HospitalSchema.index({ coordinates: '2dsphere' });
HospitalSchema.index({ registrationStatus: 1, isActive: 1 });
HospitalSchema.index({ googlePlaceId: 1 }, { unique: true, sparse: true });

export default mongoose.model<IHospital>('Hospital', HospitalSchema);