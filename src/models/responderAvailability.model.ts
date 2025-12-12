import mongoose, { Schema, Document } from 'mongoose';

export interface IResponderAvailability extends Document {
  responderId: mongoose.Types.ObjectId;
  status: 'available' | 'busy' | 'offline';
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
    updatedAt: Date;
  };
  assignedAlertId?: mongoose.Types.ObjectId;
  lastPing: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResponderAvailabilitySchema: Schema = new Schema({
  responderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
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
  lastPing: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
ResponderAvailabilitySchema.index({ currentLocation: '2dsphere' });
ResponderAvailabilitySchema.index({ status: 1, lastPing: -1 });

// Update lastPing on save
ResponderAvailabilitySchema.pre('save', function(next) {
  this.lastPing = new Date();
  next();
});

export default mongoose.model<IResponderAvailability>('ResponderAvailability', ResponderAvailabilitySchema);