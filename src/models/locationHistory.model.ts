import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationHistory extends Document {
  userId: mongoose.Types.ObjectId;
  alertId?: mongoose.Types.ObjectId;
  coordinates: [number, number];
  accuracy: number;
  batteryLevel?: number;
  timestamp: Date;
}

const LocationHistorySchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
    index: true,
  },
  coordinates: {
    type: [Number],
    required: true,
    index: '2dsphere',
  },
  accuracy: {
    type: Number,
    required: true,
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
LocationHistorySchema.index({ userId: 1, timestamp: -1 });
LocationHistorySchema.index({ alertId: 1, timestamp: 1 });

export default mongoose.model<ILocationHistory>('LocationHistory', LocationHistorySchema);