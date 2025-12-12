import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from './config/env';
import database from './config/database';
import logger from './utils/logger';
import routes from './routes/index.routes'
import errorMiddleware from './middlewares/error.middleware';
import rateLimitMiddleware from './middlewares/rateLimit.middleware';

// import SocketService from './services/socket.service';
// import { setupSwagger } from './docs/swagger'; // Uncomment when swagger is ready


class Application {
  public app: express.Application;
  public server: any;
  public io: Server;
  // private _socketService: SocketService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.clientUrl,
        credentials: true,
      },
    });
    // this._socketService = new SocketService(this.io);

    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    await database.connect();
  }

  private initializeMiddleware(): void {
    this.app.use(helmet());
    
    this.app.use(cors({
      origin: config.clientUrl,
      credentials: true,
    }));
    
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    this.app.use(rateLimitMiddleware);
    
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
        service: 'guardian-angel-backend',
        environment: config.nodeEnv,
      });
    });
  }

  private initializeRoutes(): void {
    this.app.use('/api/v1', routes)
    
    // try {
    //   const responderRoutes = require('./routes/responder.routes').default;
    //   this.app.use('/api/v1/responders', responderRoutes);
    // } catch (error) {
    //   logger.warn('Responder routes not available yet');
    // }
    
    this.app.use('*', (_req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date(),
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorMiddleware);
  }

  public start(): void {
    this.server.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 WebSocket server initialized 🛡️`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 Server URL: ${config.serverUrl}`);
      logger.info(`🔗 Client URL: ${config.clientUrl}`);
    });
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down server...');
    
    this.io.close();
    
    await database.disconnect();
    
    this.server.close(() => {
      logger.info('Server shut down successfully');
      process.exit(0);
    });
  }
}

export default Application;