import Agenda from 'agenda';
import ResponderService from '../services/responder.service';
import config from '../config/env';
import logger from '../utils/logger';

export class ResponderStatusJob {
  private agenda: Agenda;

  constructor() {
    this.agenda = new Agenda({
      db: { address: config.database.uri ?? 'mongodb://localhost:27017', collection: 'agendaJobs' },
      defaultConcurrency: 3,
    });

    this.defineJobs();
  }

  private defineJobs(): void {
    this.agenda.define('check responder activity', async () => {
      await this.checkResponderActivity();
    });

    this.agenda.define('update responder stats', async () => {
      await this.updateResponderStats();
    });

    this.agenda.on('ready', () => this.startJobs());
    this.agenda.on('error', (err) => logger.error('Agenda error:', err));
  }

  private async startJobs(): Promise<void> {
    await this.agenda.start();

    // Schedule jobs
    await this.agenda.every('5 minutes', 'check responder activity');
    await this.agenda.every('1 hour', 'update responder stats');

    logger.info('Responder status jobs scheduled');
  }

  private async checkResponderActivity(): Promise<void> {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      // Find responders who haven't pinged in 15 minutes
      const inactiveResponders = await (await import('../models/responderAvailability.model')).default.find({
        isActive: true,
        lastPing: { $lt: fifteenMinutesAgo },
      });

      for (const responder of inactiveResponders) {
        // Mark as offline
        await ResponderService.updateResponderStatus(
          responder.responderId.toString(),
          'offline'
        );

        logger.info(`Marked responder ${responder.responderId} as offline due to inactivity`);
        
        // If they had an assigned alert, reassign it
        if (responder.assignedAlertId) {
          await this.reassignAlert(responder.assignedAlertId.toString());
        }
      }

      logger.info(`Checked activity for ${inactiveResponders.length} responders`);
    } catch (error: any) {
      logger.error('Check responder activity error:', error);
    }
  }

  private async reassignAlert(alertId: string): Promise<void> {
    try {
      const Alert = await import('../models/alert.model');
      const alert = await Alert.default.findById(alertId);
      
      if (alert && alert.status === 'active') {
        // Remove inactive responder
        await Alert.default.findByIdAndUpdate(alertId, {
          $pull: {
            assignedResponders: { status: 'assigned' },
          },
        });

        // Find new responders (this would use AlertService in production)
        logger.info(`Alert ${alertId} needs reassignment`);
      }
    } catch (error: any) {
      logger.error('Reassign alert error:', error);
    }
  }

  private async updateResponderStats(): Promise<void> {
    try {
      const stats = await ResponderService.getResponderStats();
      
      // Store stats in database or cache
      logger.info('Responder stats updated:', stats);
      
      // Could send stats to monitoring service
      // await this.sendStatsToMonitoring(stats);
    } catch (error: any) {
      logger.error('Update responder stats error:', error);
    }
  }

  async stop(): Promise<void> {
    await this.agenda.stop();
    logger.info('Responder status jobs stopped');
  }
}

export default new ResponderStatusJob();
