import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/waitlist - Submit waitlist application
router.post('/', async (req, res) => {
  try {
    const { email, name, company, businessType, message } = req.body;

    // Validation
    if (!email || !name) {
      return res.status(400).json({
        error: 'Email and name are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email address',
        code: 'INVALID_EMAIL'
      });
    }

    // Check for existing application
    const existingEntry = await prisma.waitlistEntry.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingEntry) {
      return res.status(409).json({
        error: 'An application with this email already exists',
        code: 'ALREADY_APPLIED'
      });
    }

    // Create waitlist entry
    const entry = await prisma.waitlistEntry.create({
      data: {
        email: email.toLowerCase(),
        name,
        company: company || null,
        businessType: businessType || null,
        message: message || null,
        status: 'pending'
      }
    });

    // Optional: Send notification email to admin
    // You can implement email notification here using your preferred email service
    // Example: sendEmail('info@telyx.ai', 'New Waitlist Application', { name, email, company, businessType, message });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      id: entry.id
    });

  } catch (error) {
    console.error('Waitlist submission error:', error);
    res.status(500).json({
      error: 'Failed to submit application',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/waitlist/check/:email - Check if email is already on waitlist
router.get('/check/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const entry = await prisma.waitlistEntry.findUnique({
      where: { email: email.toLowerCase() }
    });

    res.json({
      exists: !!entry,
      status: entry?.status || null
    });

  } catch (error) {
    console.error('Waitlist check error:', error);
    res.status(500).json({ error: 'Failed to check waitlist status' });
  }
});

export default router;
