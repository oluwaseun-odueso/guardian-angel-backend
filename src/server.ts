import Application from './app';
import logger from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle SIGTERM for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await app.shutdown();
});

const app = new Application();
app.start();

export default app;