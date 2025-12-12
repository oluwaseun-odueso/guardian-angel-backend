import { Socket } from 'socket.io';
import { IUser } from '../models/User.model';

export interface SocketWithUser extends Socket {
  user?: IUser;
  userId?: string;
}

export interface LocationUpdateData {
  userId: string;
  coordinates: [number, number];
  accuracy: number;
  batteryLevel?: number;
  alertId?: string;
}

export interface AlertStatusUpdate {
  alertId: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled';
  responderId?: string;
}

export interface ResponderStatusUpdate {
  responderId: string;
  status: 'available' | 'busy' | 'offline';
  location?: {
    coordinates: [number, number];
    accuracy: number;
  };
}

export interface ChatMessage {
  alertId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
}