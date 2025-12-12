// Create src/controllers/notification.controller.ts
import { Response } from 'express';
import NotificationService from '../services/notification.service';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class NotificationController {
  static async testSMS(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { phoneNumber, message } = req.body;
      
      const success = await NotificationService.sendSMS(
        phoneNumber,
        message || 'Test SMS from Guardian Angel'
      );
      
      if (success) {
        return ResponseHandler.success(res, null, 'Test SMS sent successfully');
      } else {
        return ResponseHandler.error(res, 'Failed to send SMS. Check Twilio configuration.');
      }
    } catch (error: any) {
      logger.error('Test SMS error:', error);
      return ResponseHandler.error(res, error.message);
    }
  }

  static async testEmail(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { email, subject, message } = req.body;
      
      const html = `
        <h2>Test Email from Guardian Angel</h2>
        <p>${message || 'This is a test email to verify email notifications are working.'}</p>
        <p>If you received this, email notifications are configured correctly.</p>
      `;
      
      const success = await NotificationService.sendEmail(
        email || req.user?.email,
        subject || 'Test Email - Guardian Angel',
        html
      );
      
      if (success) {
        return ResponseHandler.success(res, null, 'Test email sent successfully');
      } else {
        return ResponseHandler.error(res, 'Failed to send email. Check SMTP configuration.');
      }
    } catch (error: any) {
      logger.error('Test email error:', error);
      return ResponseHandler.error(res, error.message);
    }
  }
}

export default NotificationController;