import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Register - Creates Business, Owner User, and Free Subscription
router.post('/register', async (req, res) => {
  try {
    const { email, password, businessName } = req.body;

    // Validation
    if (!email || !password || !businessName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create business, user, and subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create business with user
      const business = await tx.business.create({
        data: {
          name: businessName,
          businessType: req.body.businessType || 'OTHER',
          users: {
            create: {
              email,
              password: hashedPassword,
              role: 'OWNER'
            }
          }
        },
        include: {
          users: true
        }
      });

      // Get the created user
      const user = business.users[0];

      // Create free subscription
      const subscription = await tx.subscription.create({
        data: {
          businessId: business.id,
          plan: 'FREE',
          status: 'TRIAL',
        },
      });

      return { user, business, subscription };
    });

    // Generate JWT token (include role for quick access)
    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email, businessId: result.business.id, role: result.user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        businessId: result.user.businessId,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});


// Signup (alias for register) - Requires invite code
router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName, inviteCode } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check invite code
    if (!inviteCode) {
      return res.status(403).json({ error: "Invalid invite code", code: "INVITE_REQUIRED" });
    }

    // Verify invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode }
    });

    if (!invite) {
      return res.status(403).json({ error: "Invalid invite code", code: "INVALID_CODE" });
    }

    if (invite.used) {
      return res.status(403).json({ error: "This invite code has already been used", code: "CODE_USED" });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(403).json({ error: "This invite code has expired", code: "CODE_EXPIRED" });
    }

    // If invite is for specific email, check it
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: "This invite code is not valid for this email", code: "EMAIL_MISMATCH" });
    }

    // Use fullName for both user name and initial business name
    const businessName = fullName || "My Business";

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName }
      });
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: fullName || null, // Save user's full name
          role: "OWNER",
          businessId: business.id
        }
      });
      await tx.subscription.create({
        data: {
          businessId: business.id,
          plan: "FREE",
          status: "TRIAL",
          minutesLimit: 10,
          minutesUsed: 0
        }
      });

      // Mark invite code as used
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          used: true,
          usedBy: String(user.id),
          usedAt: new Date()
        }
      });

      return { user, business };
    });
    const token = jwt.sign(
      { userId: result.user.id, businessId: result.business.id, role: result.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({
      token,
      user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role, businessId: result.business.id },
      business: { id: result.business.id, name: result.business.name }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed" });
  }
});
// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with business and subscription
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        business: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token (include role for quick access)
    const token = jwt.sign(
      { userId: user.id, email: user.email, businessId: user.businessId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
        business: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;