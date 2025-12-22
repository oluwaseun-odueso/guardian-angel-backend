import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled';
  type: 'manual' | 'panic' | 'fall-detection';
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
    accuracy: number;
    address?: string;
    geocodedData?: {
      formattedAddress: string;
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      neighborhood?: string;
      placeId?: string;
    };
    staticMapUrl?: string;
  };
  assignedResponder?: {
    responderId: mongoose.Types.ObjectId;
    assignedAt: Date;
    status: 'assigned' | 'enroute' | 'on-scene';
    acknowledgedAt?: Date;
    cancelledAt?: Date;
    arrivedAt?: Date;
    estimatedDistance?: number; // km
    routeInfo?: {
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      estimatedArrival: Date;
    };
  };
  tracking: {
    lastUserLocation?: [number, number];
    lastResponderLocation?: [number, number];
    lastUpdated: Date;
  };
  deviceInfo?: {
    batteryLevel?: number;
    osVersion?: string;
    appVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

const AlertSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'cancelled'],
    default: 'active',
    index: true,
  },
  type: {
    type: String,
    enum: ['manual', 'panic', 'fall-detection'],
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    accuracy: {
      type: Number,
      required: true,
    },
    address: String,
    geocodedData: {
      formattedAddress: String,
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
      neighborhood: String,
      placeId: String,
    },
    staticMapUrl: String,
  },
  assignedResponder: {
    responderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: Date,
    status: {
      type: String,
      enum: ['assigned', 'enroute', 'on-scene'],
      default: 'assigned',
    },
    acknowledgedAt: Date,
    cancelledAt: Date,
    arrivedAt: Date,
    estimatedDistance: Number,
    routeInfo: {
      distance: {
        text: String,
        value: Number,
      },
      duration: {
        text: String,
        value: Number,
      },
      estimatedArrival: Date,
    },
  },
  tracking: {
    lastUserLocation: [Number],
    lastResponderLocation: [Number],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  deviceInfo: {
    batteryLevel: Number,
    osVersion: String,
    appVersion: String,
  },
  resolvedAt: Date,
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
AlertSchema.index({ location: '2dsphere' });
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IAlert>('Alert', AlertSchema);