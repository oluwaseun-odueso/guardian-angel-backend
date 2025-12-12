import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000'),
  serverUrl: process.env.SERVER_URL,
  clientUrl: process.env.CLIENT_URL,
  
  database: {
    uri: process.env.MONGODB_URI,
  },
  
  redis: {
    url: process.env.REDIS_URL,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRE!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE!,
  },
  
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS!),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!),
  },
  
  geolocation: {
    maxResponseDistanceKm: parseFloat(process.env.MAX_RESPONSE_DISTANCE_KM!),
    locationUpdateIntervalMs: parseInt(process.env.LOCATION_UPDATE_INTERVAL_MS!),
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

export default config;
