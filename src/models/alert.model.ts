import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled';
  type: 'panic' | 'fall-detection' | 'timer-expired';
  location: {
    coordinates: {
      type: [Number],
      required: true,
    },
    accuracy: {
      type: Number,
      required: true,
    },
    address: {
      formatted: String,
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    placeId: String,
    staticMapUrl: String, // For quick visualization
  },
  // location: {
  //   type: 'Point';
  //   coordinates: [number, number];
  //   accuracy: number;
  // };
  audioRecordingUrl?: string;
  photoUrl?: string;
  fallDetectionData?: {
    acceleration: number;
    timestamp: Date;
  };
  assignedResponders: Array<{
    responderId: mongoose.Types.ObjectId;
    assignedAt: Date;
    status: 'assigned' | 'enroute' | 'on-scene';
    arrivedAt?: Date;
  }>;
  messages: Array<{
    senderId: mongoose.Types.ObjectId;
    content: string;
    timestamp: Date;
    type: 'text' | 'system';
  }>;
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
    enum: ['panic', 'fall-detection', 'timer-expired'],
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
  },
  audioRecordingUrl: {
    type: String,
  },
  photoUrl: {
    type: String,
  },
  fallDetectionData: {
    acceleration: {
      type: Number,
    },
    timestamp: {
      type: Date,
    },
  },
  assignedResponders: [{
    responderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['assigned', 'enroute', 'on-scene'],
      default: 'assigned',
    },
    arrivedAt: {
      type: Date,
    },
  }],
  messages: [{
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['text', 'system'],
      default: 'text',
    },
  }],
  resolvedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
AlertSchema.index({ location: '2dsphere' });
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ userId: 1, createdAt: -1 });

// Update status when resolvedAt is set
AlertSchema.pre('save', function(next) {
  if (this.isModified('resolvedAt') && this.resolvedAt) {
    this.status = 'resolved';
  }
  next();
});

export default mongoose.model<IAlert>('Alert', AlertSchema);