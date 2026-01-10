import mongoose, { Schema, Document } from 'mongoose';

export interface IResponder extends Document {
  userDetails: { fullName: string; email: string; phone: string; role: string; };
  userId: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  role: 'respondent';
  phone: string;
  hospital: mongoose.Types.ObjectId;
  certifications: string[];
  experienceYears: number;
  vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'ambulance';
  licenseNumber?: string;
  availability: {
    monday: boolean[];
    tuesday: boolean[];
    wednesday: boolean[];
    thursday: boolean[];
    friday: boolean[];
    saturday: boolean[];
    sunday: boolean[];
  };
  maxDistance: number; // km
  bio?: string;
  hourlyRate?: number;
  status: 'available' | 'busy' | 'offline';
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
    updatedAt: Date;
  };
  assignedAlertId?: mongoose.Types.ObjectId;
  rating: number;
  totalAssignments: number;
  successfulAssignments: number;
  responseTimeAvg: number; // seconds
  lastPing: Date;
  isActive: boolean;
  isVerified: boolean;
  verificationNotes?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}



const ResponderSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  hospital: {
    type: Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  role: {
    type: String,
    // enum: ['user', 'responder', 'admin'],
    default: 'respondent',
    required: true,
  },
  certifications: {
    type: [String],
    default: [],
  },
  experienceYears: {
    type: Number,
    default: 0,
    min: 0,
  },
  vehicleType: {
    type: String,
    enum: ['car', 'motorcycle', 'bicycle', 'foot', 'ambulance'],
  },
  licenseNumber: String,
  availability: {
    monday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    tuesday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    wednesday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    thursday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    friday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    saturday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
    sunday: {
      type: [Boolean],
      default: Array(24).fill(false),
    },
  },
  maxDistance: {
    type: Number,
    default: 10, // 10km default
    min: 1,
    max: 100,
  },
  bio: String,
  hourlyRate: {
    type: Number,
    min: 0,
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
    index: true,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: [Number],
    updatedAt: Date,
  },
  assignedAlertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
  },
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5,
  },
  totalAssignments: {
    type: Number,
    default: 0,
  },
  successfulAssignments: {
    type: Number,
    default: 0,
  },
  responseTimeAvg: {
    type: Number,
    default: 0,
  },
  lastPing: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  verificationNotes: String,
  verifiedAt: Date,
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
ResponderSchema.index({ currentLocation: '2dsphere' });
ResponderSchema.index({ status: 1, rating: -1 });
ResponderSchema.index({ isVerified: 1, isActive: 1 });

export default mongoose.model<IResponder>('Responder', ResponderSchema);