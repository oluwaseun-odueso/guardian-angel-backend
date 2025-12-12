// import { Router } from 'express';
// import FileUploadController from '../controllers/fileUpload.controller';
// import { authenticate } from '../middleware/auth.middleware';
// import fileUploadService from '../services/fileUpload.service';

// const router = Router();

// router.use(authenticate);

// // Upload emergency photo/audio
// router.post('/emergency', fileUploadService.getMulterConfig('file', 10), FileUploadController.uploadEmergencyFile);

// // Upload profile picture
// router.post('/profile', fileUploadService.getMulterConfig('avatar', 5), FileUploadController.uploadProfilePicture);

// // Get upload URL for direct upload (S3)
// router.get('/signed-url', authorize('admin'), FileUploadController.getSignedUrl);

// export default router;