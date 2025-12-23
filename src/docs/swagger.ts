import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import config from '../config/env';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Guardian Angel API',
      version: '1.0.0',
      description: 'Emergency Response System API Documentation',
      contact: {
        name: 'API Support',
        email: 'support@guardianangel.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: config.serverUrl,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['email', 'fullName', 'phone'],
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            fullName: {
              type: 'string',
            },
            phone: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['user', 'responder', 'admin'],
              default: 'user',
            },
          },
        },
        Alert: {
          type: 'object',
          required: ['type', 'location'],
          properties: {
            _id: {
              type: 'string',
              description: 'Alert ID',
            },
            type: {
              type: 'string',
              enum: ['panic', 'fall-detection', 'timer-expired'],
            },
            status: {
              type: 'string',
              enum: ['active', 'acknowledged', 'resolved', 'cancelled'],
              default: 'active',
            },
            location: {
              type: 'object',
              properties: {
                coordinates: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                  description: '[longitude, latitude]',
                },
                accuracy: {
                  type: 'number',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              default: false,
            },
            error: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Unauthorized',
                message: 'No token provided',
                timestamp: '2024-01-15T10:30:00.000Z',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Validation Error',
                message: 'Validation failed',
                data: [
                  {
                    field: 'email',
                    message: 'Email is required',
                  },
                ],
                timestamp: '2024-01-15T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration',
      },
      {
        name: 'Alerts',
        description: 'Emergency alert management',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'Responders',
        description: 'Responder management and dispatch',
      },
      {
        name: 'Location',
        description: 'Location tracking and geofencing',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log(`📚 Swagger docs available at ${config.serverUrl}/api-docs`);
};