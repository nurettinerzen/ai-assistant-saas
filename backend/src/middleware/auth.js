import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logAuthFailure, logCrossTenantAttempt } from './securityEventLogger.js';

const prisma = new PrismaClient();

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // Log auth failure
      await logAuthFailure(req, 'missing_token', 401);
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user with business details
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        business: {
          include: {
            subscription: true
          }
        }
      }
    });

    if (!user) {
      // Log auth failure
      await logAuthFailure(req, 'user_not_found', 401);
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.userId = user.id;
    req.businessId = user.businessId;
    req.userRole = user.role;

    next();
  } catch (error) {
    console.error('Auth error:', error.message);

    // Log auth failure with reason
    const reason = error.name === 'TokenExpiredError' ? 'token_expired' :
                   error.name === 'JsonWebTokenError' ? 'invalid_token' :
                   'verification_failed';
    await logAuthFailure(req, reason, 403);

    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to verify user belongs to the business they're trying to access
export const verifyBusinessAccess = async (req, res, next) => {
  const requestedBusinessId = parseInt(req.params.businessId || req.body.businessId || req.query.businessId);

  if (requestedBusinessId && requestedBusinessId !== req.businessId) {
    // Log cross-tenant attempt
    await logCrossTenantAttempt(req, req.businessId, requestedBusinessId, req.userId);

    return res.status(403).json({
      error: 'Access denied: You can only access your own business data'
    });
  }

  next();
};

// Role-based access control
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: 'Access denied: Insufficient permissions' 
      });
    }
    next();
  };
};

export default { authenticateToken, verifyBusinessAccess, requireRole };