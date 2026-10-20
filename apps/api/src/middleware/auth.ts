import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User.js';
import { Role } from '../types/auth.js';
import { verifyToken } from '../services/token.service.js';
export interface AuthRequest extends Request {
  auth?: {
    sub: string;
    id: string;
    role: Role;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
  };
}

export function requireAuth(allowed?: Role[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const header = req.header('Authorization');
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const token = header.slice(7);
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub)
        .select('name email phone address city role isActive')
        .lean();

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Account is unavailable' });
      }

      if (allowed && !allowed.includes(user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      req.auth = {
        sub: user._id.toString(),
        id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city
      };

      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}