import { Response } from 'express';
import User from '../models/user.model';
import ResponseHandler from '../utils/response';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';

export class UserController {
  static async getProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      return ResponseHandler.success(res, req.user, 'Profile retrieved');
    } catch (error: any) {
      logger.error('Get profile error:', error);
      return ResponseHandler.error(res, 'Failed to get profile');
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      const { fullName, phone } = req.body;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { fullName, phone },
        { new: true }
      );
      return ResponseHandler.success(res, user, 'Profile updated');
    } catch (error: any) {
      logger.error('Update profile error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async updateSettings(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      const { settings } = req.body;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { settings },
        { new: true }
      );
      return ResponseHandler.success(res, user, 'Settings updated');
    } catch (error: any) {
      logger.error('Update settings error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async addEmergencyContact(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { name, phone, relationship } = req.body;
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            emergencyContacts: { name, phone, relationship },
          },
        },
        { new: true }
      );
      return ResponseHandler.success(res, user, 'Emergency contact added');
    } catch (error: any) {
      logger.error('Add emergency contact error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async editEmergencyContact(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { contactId } = req.params;
      const { name, phone, relationship } = req.body;
      
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      
      // Validate required fields
      if (!name && !phone && !relationship) {
        return ResponseHandler.error(res, 'At least one field (name, phone, or relationship) must be provided for update', 400);
      }
      
      // Find the user first to check if the contact exists
      const user = await User.findById(req.user._id);
      if (!user) {
        return ResponseHandler.error(res, 'User not found', 404);
      }
      
      // Check if the emergency contact exists
      const contactExists = user.emergencyContacts?.some(
        contact => contact._id.toString() === contactId
      );
      
      if (!contactExists) {
        return ResponseHandler.error(res, 'Emergency contact not found', 404);
      }
      
      // Build update object dynamically
      const updateFields: any = {};
      
      if (name !== undefined) {
        updateFields['emergencyContacts.$.name'] = name;
      }
      
      if (phone !== undefined) {
        updateFields['emergencyContacts.$.phone'] = phone;
      }
      
      if (relationship !== undefined) {
        updateFields['emergencyContacts.$.relationship'] = relationship;
      }
      
      // Update the specific contact using positional operator $
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          'emergencyContacts._id': contactId
        },
        {
          $set: updateFields
        },
        {
          new: true,
          runValidators: true // Ensure validation runs on update
        }
      );
      
      if (!updatedUser) {
        return ResponseHandler.error(res, 'Failed to update emergency contact', 400);
      }
      
      return ResponseHandler.success(res, updatedUser, 'Emergency contact updated successfully');
    } catch (error: any) {
      logger.error('Edit emergency contact error:', error);
      
      // Handle specific error cases
      if (error.name === 'CastError') {
        return ResponseHandler.error(res, 'Invalid contact ID format', 400);
      }
      
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async removeEmergencyContact(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      const { contactId } = req.params;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          $pull: {
            emergencyContacts: { _id: contactId },
          },
        },
        { new: true }
      );
      return ResponseHandler.success(res, user, 'Emergency contact removed');
    } catch (error: any) {
      logger.error('Remove emergency contact error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async updateMedicalInfo(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return ResponseHandler.error(res, 'User not authenticated', 401);
      }
      const { medicalInfo } = req.body;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        // { medicalInfo },
        { $set: medicalInfo },
        { new: true, runValidators: true }
      );
      return ResponseHandler.success(res, user, 'Medical info updated');
    } catch (error: any) {
      logger.error('Update medical info error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async getAllUsers(_req: AuthRequest, res: Response): Promise<Response> {
    try {
      const users = await User.find().select('-password');
      return ResponseHandler.success(res, users, 'Users retrieved');
    } catch (error: any) {
      logger.error('Get all users error:', error);
      return ResponseHandler.error(res, 'Failed to get users');
    }
  }

  static async updateUserRole(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!['user', 'responder', 'admin'].includes(role)) {
        return ResponseHandler.error(res, 'Invalid role', 400);
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true }
      ).select('-password');

      if (!user) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      return ResponseHandler.success(res, user, 'User role updated');
    } catch (error: any) {
      logger.error('Update user role error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }

  static async updateUserStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { isActive },
        { new: true }
      ).select('-password');

      if (!user) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      return ResponseHandler.success(res, user, 'User status updated');
    } catch (error: any) {
      logger.error('Update user status error:', error);
      return ResponseHandler.error(res, error.message, 400);
    }
  }
}

export default UserController;