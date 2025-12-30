import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationEmail, sendEmailChangeVerification } from '../services/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Rate limit tracking for resend verification (in-memory, for production use Redis)
const resendRateLimits = new Map();

/**
 * Helper: Generate verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Helper: Create and send verification email
 */
const createAndSendVerificationEmail = async (userId, email, businessName) => {
  // Delete any existing tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: { userId }
  });

  // Create new token (24 hours validity)
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });

  // Send verification email
  const verificationUrl = `${FRONTEND_URL}/auth/verify-email?token=${token}`;
  await sendVerificationEmail(email, verificationUrl, businessName);

  return token;
};

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

    // Send verification email
    try {
      await createAndSendVerificationEmail(result.user.id, result.user.email, result.business.name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        businessId: result.user.businessId,
        emailVerified: false,
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

    // Send verification email
    try {
      await createAndSendVerificationEmail(result.user.id, result.user.email, result.business.name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      token,
      user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role, businessId: result.business.id, emailVerified: false },
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
      user: {
        ...userWithoutPassword,
        emailVerified: user.emailVerified,
      },
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
        emailVerified: true,
        emailVerifiedAt: true,
        acceptedAt: true,
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

// ============================================================================
// EMAIL VERIFICATION ENDPOINTS
// ============================================================================

// Verify email with token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!verificationToken) {
      return res.status(400).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    // Check if token expired
    if (new Date() > verificationToken.expiresAt) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({ where: { id: verificationToken.id } });
      return res.status(400).json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' });
    }

    // Verify email
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      }),
      prisma.emailVerificationToken.delete({ where: { id: verificationToken.id } })
    ]);

    res.json({
      message: 'Email verified successfully',
      email: verificationToken.user.email
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification email
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Rate limit check (3 minutes)
    const rateLimitKey = `resend_${user.id}`;
    const lastSent = resendRateLimits.get(rateLimitKey);
    const now = Date.now();
    const RATE_LIMIT_MS = 3 * 60 * 1000; // 3 minutes

    if (lastSent && (now - lastSent) < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastSent)) / 1000);
      return res.status(429).json({
        error: 'Please wait before requesting another email',
        remainingSeconds,
        code: 'RATE_LIMITED'
      });
    }

    // Update rate limit
    resendRateLimits.set(rateLimitKey, now);

    // Send verification email
    await createAndSendVerificationEmail(user.id, user.email, user.business?.name);

    res.json({
      message: 'Verification email sent',
      nextResendAt: new Date(now + RATE_LIMIT_MS).toISOString()
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// ============================================================================
// GOOGLE OAUTH ENDPOINTS
// ============================================================================

// Google OAuth - Handle Google sign-in/sign-up
router.post('/google', async (req, res) => {
  try {
    const { credential, clientId } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    // Verify the Google token
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    const { email, name, picture, email_verified } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        business: {
          include: {
            subscription: true,
          },
        },
      },
    });

    let isNewUser = false;

    if (user) {
      // Existing user - link Google account if not already verified
      // Update emailVerified to true if Google verified it
      if (email_verified && !user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        user.emailVerified = true;
      }

      // Clean up any verification tokens
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id }
      });
    } else {
      // New user - create account
      isNewUser = true;

      // Generate a random password for Google users (they won't use it)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        // Create business with user
        const business = await tx.business.create({
          data: {
            name: name || 'My Business',
            users: {
              create: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name: name || null,
                role: 'OWNER',
                emailVerified: email_verified || false,
                emailVerifiedAt: email_verified ? new Date() : null,
              },
            },
          },
          include: {
            users: true,
          },
        });

        // Get the created user
        const newUser = business.users[0];

        // Create free subscription
        await tx.subscription.create({
          data: {
            businessId: business.id,
            plan: 'FREE',
            status: 'TRIAL',
            minutesLimit: 10,
            minutesUsed: 0,
          },
        });

        return { user: newUser, business };
      });

      user = await prisma.user.findUnique({
        where: { id: result.user.id },
        include: {
          business: {
            include: {
              subscription: true,
            },
          },
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        businessId: user.businessId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        ...userWithoutPassword,
        emailVerified: user.emailVerified,
      },
      isNewUser,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Change email and resend verification
router.post('/change-email', authenticateToken, async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ error: 'New email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() }
    });

    if (existingUser && existingUser.id !== user.id) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    // Update email and reset verification status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail.toLowerCase(),
        emailVerified: false,
        emailVerifiedAt: null
      }
    });

    // Send verification email to new address
    await createAndSendVerificationEmail(user.id, newEmail.toLowerCase(), user.business?.name);

    res.json({
      message: 'Email changed. Please verify your new email address.',
      email: newEmail.toLowerCase()
    });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ error: 'Failed to change email' });
  }
});

export default router;