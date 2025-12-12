import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/env';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'user' | 'responder' | 'admin';
  firstName: string;
  lastName: string;
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
  settings?: {
    enableFallDetection: boolean;
    alertPreferences: {
      sms: boolean;
      push: boolean;
      email: boolean;
    };
    trustedLocations?: Array<{
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
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
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
      default: null,
    },
    allergies: {
      type: [String],
      default: [],
    },
    conditions: {
      type: [String],
      default: [],
    },
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
        default: 100, // meters
      },
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastKnownLocation: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
    timestamp: {
      type: Date,
    },
    accuracy: {
      type: Number,
    },
  },
}, {
  timestamps: true,
});

// Create sparse 2dsphere indexes - THIS IS THE KEY FIX
UserSchema.index({ 'lastKnownLocation': '2dsphere' }, { sparse: true });
UserSchema.index({ 'settings.trustedLocations.coordinates': '2dsphere' }, { sparse: true });

// Also add regular indexes
UserSchema.index({ email: 1 }, { unique: true });

// Password hashing middleware
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
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

// Set defaults for nested objects
UserSchema.pre('save', function(next) {
  if (!this.settings) {
    this.settings = {
      enableFallDetection: false,
      alertPreferences: {
        sms: true,
        push: true,
        email: true,
      },
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