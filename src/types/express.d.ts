// import { Request } from 'express';
// import { IUser } from '../models/User.model';
// import { IResponder } from '../models/Responder.model';

// declare global {
//   namespace Express {
//     interface Request {
//       user?: IUser;
//     }
//   }
// }

// export interface AuthRequest extends Request {
//   user: IUser;
// }


// types/express.d.ts
import { IUser } from '../models/User.model';
import { IResponder } from '../models/Responder.model';

declare global {
  namespace Express {
    interface Request {
      // For user authentication
      user?: IUser;
      // For responder authentication  
      responder?: IResponder;
      // Common fields
      userId?: string;
      responderId?: string;
      userType?: 'user' | 'responder';
    }
  }
}

// Base request interface for controllers
export interface BaseRequest extends Request {
  user?: IUser;
  responder?: IResponder;
  userId?: string;
  responderId?: string;
  userType?: 'user' | 'responder';
}

// Specific interfaces for type safety
export interface UserRequest extends BaseRequest {
  user: IUser;
  userType: 'user';
}

export interface ResponderRequest extends BaseRequest {
  responder: IResponder;
  userType: 'responder';
}