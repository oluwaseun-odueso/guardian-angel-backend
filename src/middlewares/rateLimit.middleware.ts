import rateLimit from 'express-rate-limit';
import config from '../config/env';
import logger from '../utils/logger';

export const generalRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health';
  },
  handler: (req, res, _next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, 
});

export const emergencyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Only 5 emergency alerts per hour
  message: {
    success: false,
    message: 'Emergency alert rate limit exceeded. Please contact support if this is a real emergency.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  keyGenerator: (req) => {
    return (req.headers['x-api-key'] as string) || req.ip || 'unknown';
  },
  message: {
    success: false,
    message: 'API rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default generalRateLimiter;