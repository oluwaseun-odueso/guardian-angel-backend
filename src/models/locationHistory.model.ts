import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationHistory extends Document {
  userId: mongoose.Types.ObjectId;
  alertId?: mongoose.Types.ObjectId;
  coordinates: [number, number];
  accuracy: number;
  batteryLevel?: number;
  isResponder?: boolean;
  address?: string;
  timestamp: Date;
  createdAt: Date;
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
  isResponder: {
    type: Boolean,
    default: false,
  },
  address: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

LocationHistorySchema.index({ userId: 1, timestamp: -1 });
LocationHistorySchema.index({ alertId: 1, timestamp: 1 });

export default mongoose.model<ILocationHistory>('LocationHistory', LocationHistorySchema);


// import mongoose, { Schema, Document } from 'mongoose';

// export interface ILocationHistory extends Document {
//   userId: mongoose.Types.ObjectId;
//   alertId?: mongoose.Types.ObjectId;
//   coordinates: [number, number];
//   accuracy: number;
//   batteryLevel?: number;
//   address?: string; 
//   enrichedData?: { 
//     formattedAddress?: string;
//     city?: string;
//     neighborhood?: string;
//     placeId?: string;
//     staticMapUrl?: string;
//   };
//   timestamp: Date;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const LocationHistorySchema: Schema = new Schema({
//   userId: {
//     type: Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     index: true,
//   },
//   alertId: {
//     type: Schema.Types.ObjectId,
//     ref: 'Alert',
//     index: true,
//   },
//   coordinates: {
//     type: [Number],
//     required: true,
//     index: '2dsphere',
//   },
//   accuracy: {
//     type: Number,
//     required: true,
//   },
//   batteryLevel: {
//     type: Number,
//     min: 0,
//     max: 100,
//   },
//   address: {
//     type: String,
//   },
//   enrichedData: {
//     formattedAddress: String,
//     city: String,
//     neighborhood: String,
//     placeId: String,
//     staticMapUrl: String,
//   },
//   timestamp: {
//     type: Date,
//     default: Date.now,
//     index: true,
//   },
// }, {
//   timestamps: true,
// });

// LocationHistorySchema.index({ userId: 1, timestamp: -1 });
// LocationHistorySchema.index({ alertId: 1, timestamp: 1 });

// export default mongoose.model<ILocationHistory>('LocationHistory', LocationHistorySchema);