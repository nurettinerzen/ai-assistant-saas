import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Complete onboarding
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { onboardingCompleted: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        onboardingCompleted: true,
      },
    });

    res.json({
      success: true,
      message: 'Onboarding completed',
      user
    });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
