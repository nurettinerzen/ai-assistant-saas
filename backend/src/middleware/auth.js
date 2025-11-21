import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
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
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.userId = user.id;
    req.businessId = user.businessId;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to verify user belongs to the business they're trying to access
export const verifyBusinessAccess = (req, res, next) => {
  const requestedBusinessId = parseInt(req.params.businessId || req.body.businessId || req.query.businessId);
  
  if (requestedBusinessId && requestedBusinessId !== req.businessId) {
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