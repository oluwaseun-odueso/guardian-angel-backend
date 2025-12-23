// import Agenda from 'agenda';
// import mongoose from 'mongoose';
// import Alert from '../models/alert.model';
// import NotificationService from '../services/notification.service';
// import config from '../config/env';
// import logger from '../utils/logger';

// export class AlertExpirationJob {
//   private agenda: Agenda;

//   constructor() {
//     this.agenda = new Agenda({
//       db: { address: config.database.uri || 'mongodb://localhost:27017/guardian-angel', collection: 'agendaJobs' },
//       defaultConcurrency: 5,
//     });

//     this.defineJobs();
//   }

//   private defineJobs(): void {
//     this.agenda.define('expire old alerts', async () => {
//       await this.processExpiredAlerts();
//     });

//     this.agenda.define('check alert timeout', async () => {
//       await this.checkAlertTimeouts();
//     });

//     this.agenda.define('notify inactive alerts', async () => {
//       await this.notifyInactiveAlerts();
//     });

//     this.agenda.on('ready', () => this.startJobs());
//     this.agenda.on('error', (err) => logger.error('Agenda error:', err));
//   }

//   private async startJobs(): Promise<void> {
//     await this.agenda.start();

//     // Schedule jobs
//     await this.agenda.every('1 hour', 'expire old alerts');
//     await this.agenda.every('30 minutes', 'check alert timeout');
//     await this.agenda.every('15 minutes', 'notify inactive alerts');

//     logger.info('Alert expiration jobs scheduled');
//   }

//   private async processExpiredAlerts(): Promise<void> {
//     try {
//       const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
//       const expiredAlerts = await Alert.find({
//         status: 'active',
//         createdAt: { $lt: twentyFourHoursAgo },
//       });

//       for (const alert of expiredAlerts) {
//         alert.status = 'resolved';
//         alert.resolvedAt = new Date();
//         await alert.save();

//         logger.info(`Alert ${alert._id} auto-resolved due to expiration`);
        
//         // Notify user and responders
//         await NotificationService.sendAlertStatusUpdate(
//           alert._id.toString(),
//           'auto-resolved',
//           [alert.userId.toString(), ...alert.assignedResponders.map(r => r.responderId.toString())]
//         );
//       }

//       logger.info(`Processed ${expiredAlerts.length} expired alerts`);
//     } catch (error: any) {
//       logger.error('Process expired alerts error:', error);
//     }
//   }

//   private async checkAlertTimeouts(): Promise<void> {
//     try {
//       const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
//       const timeoutAlerts = await Alert.find({
//         status: 'active',
//         updatedAt: { $lt: fifteenMinutesAgo },
//         'assignedResponders.status': 'assigned',
//       }).populate('assignedResponders.responderId', 'firstName lastName');

//       for (const alert of timeoutAlerts) {
//         // Find responders who haven't acknowledged
//         const unacknowledgedResponders = alert.assignedResponders.filter(
//           r => r.status === 'assigned'
//         );

//         if (unacknowledgedResponders.length > 0) {
//           // Escalate to other responders or admins
//           await this.escalateAlert(alert, unacknowledgedResponders);
//         }
//       }

//       logger.info(`Checked timeouts for ${timeoutAlerts.length} alerts`);
//     } catch (error: any) {
//       logger.error('Check alert timeouts error:', error);
//     }
//   }

//   private async escalateAlert(alert: any, unacknowledgedResponders: any[]): Promise<void> {
//     try {
//       // Remove unresponsive responders
//       const unresponsiveIds = unacknowledgedResponders.map(r => r.responderId.toString());
      
//       await Alert.findByIdAndUpdate(alert._id, {
//         $pull: {
//           assignedResponders: { responderId: { $in: unresponsiveIds } },
//         },
//       });

//       // Find new responders
//       const newResponders = await this.findNewResponders(alert.location.coordinates);
      
//       if (newResponders.length > 0) {
//         await Alert.findByIdAndUpdate(alert._id, {
//           $push: {
//             assignedResponders: newResponders.map(responderId => ({
//               responderId,
//               assignedAt: new Date(),
//               status: 'assigned',
//             })),
//           },
//         });

//         // Notify new responders
//         for (const responderId of newResponders) {
//           await NotificationService.notifyResponder(
//             responderId.toString(),
//             `ESCALATED ALERT: Previous responders did not respond. ${alert.userId.firstName} needs help!`,
//             alert._id.toString()
//           );
//         }

//         logger.info(`Alert ${alert._id} escalated to ${newResponders.length} new responders`);
//       } else {
//         // No responders available, notify admins
//         await this.notifyAdmins(alert);
//       }
//     } catch (error: any) {
//       logger.error('Escalate alert error:', error);
//     }
//   }

//   private async findNewResponders(_coordinates: [number, number]): Promise<mongoose.Types.ObjectId[]> {
//     // This would use the ResponderService to find available responders
//     // For now, return empty array
//     return [];
//   }

//   private async notifyAdmins(alert: any): Promise<void> {
//     try {
//       const admins = await mongoose.model('User').find({ role: 'admin' });
      
//       for (const admin of admins) {
//         await NotificationService.sendEmail(
//           admin.email,
//           'URGENT: No Responders Available',
//           `
//             <h2>🚨 CRITICAL ALERT</h2>
//             <p>No responders are available for alert ${alert._id}.</p>
//             <p>User: ${alert.userId.firstName} ${alert.userId.lastName}</p>
//             <p>Location: ${alert.location.coordinates}</p>
//             <p>Time: ${alert.createdAt}</p>
//             <p>Please take immediate action!</p>
//           `
//         );
//       }

//       logger.info(`Admins notified about alert ${alert._id} with no responders`);
//     } catch (error: any) {
//       logger.error('Notify admins error:', error);
//     }
//   }

//   private async notifyInactiveAlerts(): Promise<void> {
//     try {
//       const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
//       const inactiveAlerts = await Alert.find({
//         status: 'active',
//         updatedAt: { $lt: oneHourAgo },
//       }).populate('userId', 'firstName lastName');

//       for (const alert of inactiveAlerts) {
//         // Send reminder to assigned responders
//         const user = alert.userId as { fullName?: string; lastName?: string };
//         const userName = user && user.fullName ? user.firstName : 'the user';
//         for (const assignment of alert.assignedResponders) {
//           await NotificationService.sendPushNotificationToUser(
//             assignment.responderId.toString(),
//             {
//               title: 'Alert Still Active',
//               body: `Alert for ${userName} is still active. Please check status.`,
//               data: { alertId: alert._id.toString(), type: 'reminder' },
//             }
//           );
//         }
//       }

//       logger.info(`Sent reminders for ${inactiveAlerts.length} inactive alerts`);
//     } catch (error: any) {
//       logger.error('Notify inactive alerts error:', error);
//     }
//   }

//   async stop(): Promise<void> {
//     await this.agenda.stop();
//     logger.info('Alert expiration jobs stopped');
//   }
// }

// export default new AlertExpirationJob();