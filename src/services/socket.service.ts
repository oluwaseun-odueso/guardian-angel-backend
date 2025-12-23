// import { Server } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import User from '../models/user.model';
// import AlertService from './alert.service';
// import ResponderService from './responder.service';
// import config from '../config/env';
// import logger from '../utils/logger';
// import { SocketWithUser } from '../types/socket';

// export class SocketService {
//   private io: Server;
//   private connectedUsers: Map<string, string> = new Map(); // socketId -> userId
//   private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

//   constructor(io: Server) {
//     this.io = io;
//     this.setupMiddleware();
//     this.setupEventHandlers();
//   }

//   private setupMiddleware(): void {
//     this.io.use(async (socket: SocketWithUser, next) => {
//       try {
//         const token = socket.handshake.auth.token;
        
//         if (!token) {
//           logger.warn('Socket connection attempt without token');
//           return next(new Error('Authentication required'));
//         }

//         const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
//         const user = await User.findById(decoded.id);

//         if (!user || !user.isActive) {
//           return next(new Error('User not found or inactive'));
//         }

//         socket.user = user;
//         socket.userId = user._id.toString();
        
//         next();
//       } catch (error: any) {
//         logger.error('Socket authentication error:', error);
//         next(new Error('Authentication failed'));
//       }
//     });
//   }

//   private setupEventHandlers(): void {
//     this.io.on('connection', (socket: SocketWithUser) => {
//       if (!socket.userId) {
//         socket.disconnect();
//         return;
//       }

//       this.handleConnection(socket);
//       this.setupAlertHandlers(socket);
//       this.setupLocationHandlers(socket);
//       this.setupResponderHandlers(socket);
//       this.setupChatHandlers(socket);

//       socket.on('disconnect', () => {
//         this.handleDisconnect(socket);
//       });
//     });
//   }

//   private handleConnection(socket: SocketWithUser): void {
//     const userId = socket.userId!;
//     const socketId = socket.id;

//     // Add to connected users maps
//     this.connectedUsers.set(socketId, userId);
    
//     if (!this.userSockets.has(userId)) {
//       this.userSockets.set(userId, new Set());
//     }
//     this.userSockets.get(userId)!.add(socketId);

//     // Join user room for private messages
//     socket.join(`user:${userId}`);

//     // Join role-specific room
//     socket.join(`role:${socket.user?.role}`);

//     logger.info(`Socket connected: ${socketId} for user: ${userId}`);
    
//     // Send connection confirmation
//     socket.emit('connection:established', {
//       userId,
//       timestamp: new Date(),
//       message: 'Connected to Guardian Angel network',
//     });
//   }

//   private handleDisconnect(socket: SocketWithUser): void {
//     const socketId = socket.id;
//     const userId = this.connectedUsers.get(socketId);

//     if (userId) {
//       this.connectedUsers.delete(socketId);
      
//       const userSockets = this.userSockets.get(userId);
//       if (userSockets) {
//         userSockets.delete(socketId);
//         if (userSockets.size === 0) {
//           this.userSockets.delete(userId);
//         }
//       }

//       logger.info(`Socket disconnected: ${socketId} for user: ${userId}`);
//     }
//   }

//   private setupAlertHandlers(socket: SocketWithUser): void {
//     socket.on('alert:create', async (data) => {
//       try {
//         const alert = await AlertService.createAlert({
//           userId: socket.userId!,
//           ...data,
//         });

//         // Broadcast to all responders
//         this.io.to('role:responder').to('role:admin').emit('alert:new', alert);

//         // Notify the user's emergency contacts
//         socket.emit('alert:created', alert);

//         logger.info(`Alert created via socket: ${alert._id}`);
//       } catch (error: any) {
//         logger.error('Socket alert creation error:', error);
//         socket.emit('error', { message: 'Failed to create alert' });
//       }
//     });

//     socket.on('alert:update', async (data) => {
//       try {
//         const { alertId, status } = data;
//         const alert = await AlertService.updateAlertStatus(alertId, status, socket.userId);

//         if (alert) {
//           // Broadcast update to all interested parties
//           this.io.to(`alert:${alertId}`).emit('alert:updated', alert);
          
//           // Notify specific user
//           this.io.to(`user:${alert.userId}`).emit('alert:status-updated', {
//             alertId,
//             status,
//             updatedAt: new Date(),
//           });

//           logger.info(`Alert ${alertId} status updated to ${status}`);
//         }
//       } catch (error: any) {
//         logger.error('Socket alert update error:', error);
//         socket.emit('error', { message: 'Failed to update alert' });
//       }
//     });

//     socket.on('alert:join', (alertId: string) => {
//       socket.join(`alert:${alertId}`);
//       logger.info(`User ${socket.userId} joined alert room: ${alertId}`);
//     });

//     socket.on('alert:leave', (alertId: string) => {
//       socket.leave(`alert:${alertId}`);
//     });
//   }

//   private setupLocationHandlers(socket: SocketWithUser): void {
//     socket.on('location:update', async (data) => {
//       try {
//         const { coordinates, accuracy, batteryLevel, alertId } = data;
        
//         // Update user's location in database
//         await User.findByIdAndUpdate(socket.userId, {
//           lastKnownLocation: {
//             type: 'Point',
//             coordinates,
//             timestamp: new Date(),
//             accuracy,
//           },
//         });

//         // If location update is for an active alert, broadcast to responders
//         if (alertId) {
//           const locationUpdate = {
//             userId: socket.userId,
//             alertId,
//             coordinates,
//             accuracy,
//             timestamp: new Date(),
//             batteryLevel,
//           };

//           this.io.to(`alert:${alertId}`).emit('location:tracking', locationUpdate);
//         }

//         // If user is a responder, update their availability
//         if (socket.user?.role === 'responder') {
//           await ResponderService.updateResponderLocation(
//             socket.userId!,
//             coordinates,
//             accuracy
//           );
//         }

//       } catch (error: any) {
//         logger.error('Socket location update error:', error);
//       }
//     });
//   }

//   private setupResponderHandlers(socket: SocketWithUser): void {
//     if (socket.user?.role !== 'responder') return;

//     socket.on('responder:status', async (status: 'available' | 'busy' | 'offline') => {
//       try {
//         await ResponderService.updateResponderStatus(socket.userId!, status);
        
//         // Broadcast to admins
//         this.io.to('role:admin').emit('responder:status-changed', {
//           responderId: socket.userId,
//           status,
//           timestamp: new Date(),
//         });

//         logger.info(`Responder ${socket.userId} status changed to ${status}`);
//       } catch (error: any) {
//         logger.error('Socket responder status update error:', error);
//       }
//     });

//     socket.on('responder:location', async (data) => {
//       try {
//         const { coordinates, accuracy } = data;
//         await ResponderService.updateResponderLocation(
//           socket.userId!,
//           coordinates,
//           accuracy
//         );
//       } catch (error: any) {
//         logger.error('Socket responder location update error:', error);
//       }
//     });
//   }

//   private setupChatHandlers(socket: SocketWithUser): void {
//     socket.on('chat:message', async (data) => {
//       try {
//         const { alertId, content, type = 'text' } = data;
        
//         const message = await AlertService.addMessage(
//           alertId,
//           socket.userId!,
//           content,
//           type
//         );

//         if (message) {
//           const chatMessage = {
//             alertId,
//             senderId: socket.userId,
//             senderName: `${socket.user?.fullName}`,
//             content,
//             type,
//             timestamp: new Date(),
//           };

//           // Broadcast to everyone in the alert room
//           this.io.to(`alert:${alertId}`).emit('chat:message', chatMessage);
//         }
//       } catch (error: any) {
//         logger.error('Socket chat message error:', error);
//         socket.emit('error', { message: 'Failed to send message' });
//       }
//     });
//   }

//   // Public methods for external use
//   public notifyUser(userId: string, event: string, data: any): void {
//     const userSockets = this.userSockets.get(userId);
//     if (userSockets) {
//       userSockets.forEach(socketId => {
//         this.io.to(socketId).emit(event, data);
//       });
//     }
//   }

//   public broadcastToRole(role: string, event: string, data: any): void {
//     this.io.to(`role:${role}`).emit(event, data);
//   }

//   public getConnectedUsers(): Map<string, string> {
//     return new Map(this.connectedUsers);
//   }
// }

// export default SocketService;