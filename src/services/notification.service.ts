import twilio from 'twilio';
import nodemailer from 'nodemailer';
import User from '../models/user.model';
import Alert from '../models/alert.model';
import config from '../config/env';
import logger from '../utils/logger';

// Mock push notification service (replace with actual FCM/APNS in production)
class PushNotificationService {
  static async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    _data?: any
  ): Promise<boolean> {
    // In production, implement Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS)
    logger.info(`[Mock Push] To: ${deviceToken}, Title: ${title}, Body: ${body}`);
    return true;
  }
}

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  priority?: 'normal' | 'high';
}

export class NotificationService {
  private static twilioClient: twilio.Twilio | null = null;
  private static emailTransporter: nodemailer.Transporter | null = null;

  static initialize() {
    // Initialize Twilio if credentials are provided
    if (config.twilio.accountSid && config.twilio.authToken) {
      this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
      logger.info('Twilio client initialized');
    }

    // Initialize email transporter if credentials are provided
    if (config.smtp.host && config.smtp.user && config.smtp.pass) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
      logger.info('Email transporter initialized');
    }
  }

  static async sendEmergencyNotifications(alert: any, user: any): Promise<void> {
    try {
      const alertLocation = `https://maps.google.com/?q=${alert.location.coordinates[1]},${alert.location.coordinates[0]}`;
      
      // Notification message
      const message = `EMERGENCY: ${user.firstName} ${user.lastName} needs help! Location: ${alertLocation}`;

      // 1. Notify assigned responders
      for (const assignment of alert.assignedResponders) {
        await this.notifyResponder(assignment.responderId, message, alert._id.toString());
      }

      // 2. Notify emergency contacts via SMS
      if (user.emergencyContacts && user.emergencyContacts.length > 0) {
        for (const contact of user.emergencyContacts) {
          await this.sendSMS(contact.phone, message);
        }
      }

      // 3. Send push notification to user (acknowledgment)
      await this.sendPushNotificationToUser(user._id.toString(), {
        title: 'Emergency Alert Sent',
        body: 'Help is on the way! Your location has been shared with responders.',
        data: { alertId: alert._id.toString() },
      });

      logger.info(`Emergency notifications sent for alert: ${alert._id}`);
    } catch (error: any) {
      logger.error('Send emergency notifications error:', error);
      throw error;
    }
  }

  static async sendSMS(to: string, body: string): Promise<boolean> {
    try {
      if (!this.twilioClient) {
        logger.warn('Twilio not configured, SMS not sent');
        return false;
      }

      const message = await this.twilioClient.messages.create({
        body,
        from: config.twilio.phoneNumber,
        to,
      });

      logger.info(`SMS sent to ${to}: ${message.sid}`);
      return true;
    } catch (error: any) {
      logger.error('Send SMS error:', error);
      return false;
    }
  }

  static async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        logger.warn('Email transporter not configured, email not sent');
        return false;
      }

      const info = await this.emailTransporter.sendMail({
        from: `"Guardian Angel" <${config.smtp.user}>`,
        to,
        subject,
        html,
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (error: any) {
      logger.error('Send email error:', error);
      return false;
    }
  }

  static async sendPushNotificationToUser(
    userId: string,
    notification: NotificationData
  ): Promise<boolean> {
    try {
      // In a real app, you would fetch the user's device tokens from database
      // For now, we'll mock it
      const user = await User.findById(userId);
      if (!user) {
        logger.error(`User not found for push notification: ${userId}`);
        return false;
      }

      // Mock: Assume we have a device token stored somewhere
      const mockDeviceToken = `mock_device_token_${userId}`;
      
      return await PushNotificationService.sendPushNotification(
        mockDeviceToken,
        notification.title,
        notification.body,
        notification.data
      );
    } catch (error: any) {
      logger.error('Send push notification error:', error);
      return false;
    }
  }

  static async notifyResponder(
    responderId: string,
    message: string,
    alertId: string
  ): Promise<void> {
    try {
      const responder = await User.findById(responderId);
      if (!responder) {
        logger.error(`Responder not found: ${responderId}`);
        return;
      }

      // 1. Send SMS to responder
      if (responder.settings?.alertPreferences?.sms) {
        await this.sendSMS(responder.phone, message);
      }

      // 2. Send push notification to responder app
      if (responder.settings?.alertPreferences?.push) {
        await this.sendPushNotificationToUser(responderId, {
          title: 'New Emergency Alert',
          body: message,
          data: { alertId, type: 'emergency' },
          priority: 'high',
        });
      }

      // 3. Send email to responder
      if (responder.settings?.alertPreferences?.email) {
        const emailHtml = `
          <h2>🚨 New Emergency Alert</h2>
          <p>${message}</p>
          <p>Alert ID: ${alertId}</p>
          <p>Please respond immediately through the Guardian Angel app.</p>
          <p><a href="${config.serverUrl}/alerts/${alertId}">View Alert Details</a></p>
        `;
        
        await this.sendEmail(responder.email, 'New Emergency Alert', emailHtml);
      }

      logger.info(`Responder ${responderId} notified about alert ${alertId}`);
    } catch (error: any) {
      logger.error('Notify responder error:', error);
      throw error;
    }
  }

  static async sendAlertStatusUpdate(
    alertId: string,
    status: string,
    recipients: string[]
  ): Promise<void> {
    try {
      const alert = await Alert.findById(alertId).populate('userId');
      if (!alert) {
        logger.error(`Alert not found: ${alertId}`);
        return;
      }

      // Type guard for populated userId
      const userDoc = typeof alert.userId === 'object' && 'firstName' in alert.userId ? alert.userId as unknown as { firstName: string; lastName: string } : null;
      const userName = userDoc ? `${userDoc.firstName} ${userDoc.lastName}` : 'Unknown User';

      const title = `Alert Status Updated`;
      const body = `Alert for ${userName} is now ${status}`;

      for (const recipientId of recipients) {
        // Send push notification
        await this.sendPushNotificationToUser(recipientId, {
          title,
          body,
          data: { alertId, status },
        });

        // Optionally send email
        const user = await User.findById(recipientId);
        if (user?.settings?.alertPreferences?.email) {
          const emailHtml = `
            <h2>📢 Alert Status Update</h2>
            <p>Alert ID: ${alertId}</p>
            <p>Status: ${status}</p>
            <p>User: ${userName}</p>
          `;
          
          await this.sendEmail(user.email, title, emailHtml);
        }
      }

      logger.info(`Alert status update sent for alert: ${alertId}`);
    } catch (error: any) {
      logger.error('Send alert status update error:', error);
      throw error;
    }
  }

  static async sendWelcomeEmail(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || !this.emailTransporter) {
        return false;
      }

      const html = `
        <h1>Welcome to Guardian Angel! 🛡️</h1>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for joining Guardian Angel. Your safety is our priority.</p>
        
        <h3>Getting Started:</h3>
        <ul>
          <li>Add emergency contacts in your profile</li>
          <li>Set up trusted locations (home, work, etc.)</li>
          <li>Enable fall detection in settings</li>
          <li>Test the panic button in a safe environment</li>
        </ul>
        
        <p>If you need help, visit our <a href="${config.serverUrl}/help">help center</a>.</p>
        
        <p>Stay safe,<br>The Guardian Angel Team</p>
      `;

      return await this.sendEmail(user.email, 'Welcome to Guardian Angel!', html);
    } catch (error: any) {
      logger.error('Send welcome email error:', error);
      return false;
    }
  }

  static async sendSafetyCheckNotification(
    userId: string,
    checkInTime: Date
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      const message = `Safety Check: Are you okay? Your safety timer expired at ${checkInTime.toLocaleTimeString()}. Please confirm your safety.`;
      
      // Send push notification
      await this.sendPushNotificationToUser(userId, {
        title: 'Safety Check Required',
        body: message,
        data: { type: 'safety_check', timestamp: checkInTime.toISOString() },
      });

      // Send SMS to emergency contacts
      if (user.emergencyContacts && user.emergencyContacts.length > 0) {
        for (const contact of user.emergencyContacts) {
          await this.sendSMS(
            contact.phone,
            `Safety Alert: ${user.firstName} ${user.lastName} has not checked in as scheduled. Last known location has been shared with responders.`
          );
        }
      }

      logger.info(`Safety check notification sent for user: ${userId}`);
      return true;
    } catch (error: any) {
      logger.error('Send safety check notification error:', error);
      return false;
    }
  }
}

// Initialize notification service
NotificationService.initialize();

export default NotificationService;