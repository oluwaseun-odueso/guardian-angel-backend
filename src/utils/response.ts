import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: Date;
}

export class ResponseHandler {
  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Success',
    statusCode: number = 200
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date(),
    };
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    error: string = 'Internal Server Error',
    statusCode: number = 500
  ): Response {
    const response: ApiResponse = {
      success: false,
      error,
      timestamp: new Date(),
    };
    return res.status(statusCode).json(response);
  }

  static validationError(
    res: Response,
    errors: any[],
    message: string = 'Validation failed'
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: 'Validation Error',
      data: errors,
      timestamp: new Date(),
    };
    return res.status(400).json(response);
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found'
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: 'Not Found',
      timestamp: new Date(),
    };
    return res.status(404).json(response);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: 'Unauthorized',
      timestamp: new Date(),
    };
    return res.status(401).json(response);
  }

  static forbidden(
    res: Response,
    message: string = 'Forbidden'
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: 'Forbidden',
      timestamp: new Date(),
    };
    return res.status(403).json(response);
  }
}

export default ResponseHandler;