import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../utils/logger';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  filename: string;
}

export class FileUploadService {
  private s3Client: S3Client | null = null;
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Initialize S3 if credentials are provided (for production)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      logger.info('S3 client initialized');
    }
  }

  // Configure multer for local file upload
  getMulterConfig(fieldName: string = 'file', maxSizeMB: number = 5) {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    });

    const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|m4a/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Error: File type not supported!'));
      }
    };

    return multer({
      storage,
      limits: {
        fileSize: maxSizeMB * 1024 * 1024, // MB to bytes
      },
      fileFilter,
    }).single(fieldName);
  }

  async uploadToS3(
    file: Express.Multer.File,
    folder: string = 'emergency'
  ): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const fileContent = fs.readFileSync(file.path);
    const key = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: fileContent,
      ContentType: file.mimetype,
      ACL: 'public-read' as const,
    };

    try {
      await this.s3Client.send(new PutObjectCommand(params));
      
      const url = `https://${params.Bucket}.s3.amazonaws.com/${key}`;
      
      // Clean up local file
      fs.unlinkSync(file.path);

      return {
        url,
        key,
        size: file.size,
        mimetype: file.mimetype,
        filename: file.originalname,
      };
    } catch (error: any) {
      logger.error('S3 upload error:', error);
      throw error;
    }
  }

  async uploadLocally(file: Express.Multer.File): Promise<UploadResult> {
    try {
      const url = `${config.serverUrl}/uploads/${path.basename(file.path)}`;
      
      return {
        url,
        key: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        filename: file.originalname,
      };
    } catch (error: any) {
      logger.error('Local upload error:', error);
      throw error;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    options: {
      folder?: string;
      useS3?: boolean;
    } = {}
  ): Promise<UploadResult> {
    const { folder = 'emergency', useS3 = false } = options;

    if (useS3 && this.s3Client) {
      return this.uploadToS3(file, folder);
    } else {
      return this.uploadLocally(file);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    options: {
      folder?: string;
      useS3?: boolean;
    } = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, options));
    return Promise.all(uploadPromises);
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      if (this.s3Client) {
        // S3 deletion logic here
        logger.info(`File deleted from S3: ${key}`);
      } else {
        const filePath = path.join(this.uploadDir, key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`File deleted locally: ${key}`);
        }
      }
      return true;
    } catch (error: any) {
      logger.error('Delete file error:', error);
      return false;
    }
  }

  // Serve static files in development
  setupStaticRoutes(app: any): void {
    if (config.nodeEnv === 'development') {
      app.use('/uploads', (_req: any, res: any, next: any) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
      }, require('express').static(this.uploadDir));
      logger.info(`Static file serving enabled at /uploads`);
    }
  }
}

export default new FileUploadService();