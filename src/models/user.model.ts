import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'user' | 'responder' | 'admin';
  fullName: string;
  phone: string;
  profileImage?: string;
  emergencyContacts?: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
  medicalInfo?: {
    bloodType: string;
    allergies: string[];
    conditions: string[];
  };
  settings: {
    enableFallDetection: boolean;
    alertPreferences: {
      sms: boolean;
      push: boolean;
      email: boolean;
    };
    trustedLocations: Array<{
      name: string;
      coordinates: {
        type: 'Point';
        coordinates: [number, number];
      };
      radius: number;
    }>;
  };
  isActive: boolean;
  lastKnownLocation?: {
    type: 'Point';
    coordinates: [number, number];
    timestamp: Date;
    accuracy: number;
    enrichedData?: {
      address?: {
        formatted: string;
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
        neighborhood?: string;
      };
      placeId?: string;
      staticMapUrl?: string;
    };
  };
  deviceInfo?: {
    batteryLevel?: number;
    batteryHealth?: 'good' | 'fair' | 'poor' | 'critical';
    lastBatteryUpdate?: Date;
    averageDrainRate?: number;
    osVersion?: string;
    appVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'responder', 'admin'],
    default: 'user',
    required: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'],
  },
  profileImage: {
    type: String,
  },
  emergencyContacts: [{
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    relationship: {
      type: String,
      required: true,
    },
  }],
  medicalInfo: {
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
    },
    allergies: [String],
    conditions: [String],
  },
  settings: {
    enableFallDetection: {
      type: Boolean,
      default: false,
    },
    alertPreferences: {
      sms: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
    },
    trustedLocations: [{
      name: String,
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          required: true,
        },
      },
      radius: {
        type: Number,
        default: 100,
      },
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // lastKnownLocation: {
  //   type: {
  //     type: String,
  //     enum: ['Point'],
  //     default: 'Point',
  //   },
  //   coordinates: {
  //     type: [Number],
  //     required: false,
  //   },
  //   timestamp: {
  //     type: Date,
  //     required: false,
  //   },
  //   accuracy: {
  //     type: Number,
  //     required: false,
  //   },
  //   enrichedData: {
  //     address: {
  //       formatted: String,
  //       street: String,
  //       city: String,
  //       state: String,
  //       country: String,
  //       postalCode: String,
  //       neighborhood: String,
  //     },
  //     placeId: String,
  //     staticMapUrl: String,
  //   },
  // },
  deviceInfo: {
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    batteryHealth: {
      type: String,
      enum: ['good', 'fair', 'poor', 'critical'],
      default: 'good',
    },
    lastBatteryUpdate: Date,
    averageDrainRate: Number,
    osVersion: String,
    appVersion: String,
  },
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
UserSchema.index({ 'lastKnownLocation': '2dsphere' });
UserSchema.index({ 'settings.trustedLocations.coordinates': '2dsphere' });

// Password hashing middleware
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

UserSchema.pre('save', function(next) {
  if (!this.settings) {
    this.settings = {
      enableFallDetection: false,
      alertPreferences: {
        sms: true,
        push: true,
        email: true,
      },
      trustedLocations: [],
    };
  }
  
  if (!this.medicalInfo) {
    this.medicalInfo = {
      bloodType: null,
      allergies: [],
      conditions: [],
    };
  }
  
  next();
});

export default mongoose.model<IUser>('User', UserSchema);
