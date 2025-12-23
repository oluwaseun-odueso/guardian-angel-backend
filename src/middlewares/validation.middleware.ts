import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import ResponseHandler from '../utils/response';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      ResponseHandler.validationError(res, errors);
      return;
    }

    req.body = value;
    next();
  };
};

export const AuthSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().min(8).required(),
    fullName: Joi.string().required().trim(),
    phone: Joi.string().required().trim(),
    role: Joi.string().valid('user', 'admin', 'responder').default('user'),
  }),

  login: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().required(),
  }),
};

export const AlertSchemas = {
  createAlert: Joi.object({
    type: Joi.string().valid('panic', 'fall-detection', 'timer-expired').required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      accuracy: Joi.number().min(0).required(),
    }).required(),
    fallDetectionData: Joi.object({
      acceleration: Joi.number().required(),
      timestamp: Joi.date().required(),
    }).optional(),
  }),

  updateAlert: Joi.object({
    status: Joi.string().valid('acknowledged', 'resolved', 'cancelled'),
    assignedResponders: Joi.array().items(
      Joi.object({
        responderId: Joi.string().required(),
        status: Joi.string().valid('assigned', 'enroute', 'on-scene'),
      })
    ),
  }),
};

export const LocationSchemas = {
  updateLocation: Joi.object({
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    accuracy: Joi.number().min(0).required(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    alertId: Joi.string().optional(),
  }),

  trustedLocation: Joi.object({
    name: Joi.string().required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    radius: Joi.number().min(10).max(1000).default(100),
  }),
};

export const UserSchemas = {
  updateProfile: Joi.object({
    fullName: Joi.string().trim(),
    lastName: Joi.string().trim(),
    phone: Joi.string().trim(),
  }),

  emergencyContact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    relationship: Joi.string().required(),
  }),

  medicalInfo: Joi.object({
    bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    allergies: Joi.array().items(Joi.string()),
    conditions: Joi.array().items(Joi.string()),
  }),
};

export const ResponderSchemas = {
  updateStatus: Joi.object({
    status: Joi.string().valid('available', 'busy', 'offline').required(),
  }),

  updateLocation: Joi.object({
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    accuracy: Joi.number().min(0).required(),
  }),
};