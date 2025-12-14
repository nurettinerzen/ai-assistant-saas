import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/settings/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = req.businessId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        businessType: true,
        language: true,
        country: true,
        timezone: true,
      },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    // Return in format frontend expects
    res.json({
      name: user?.email?.split('@')[0] || '', // User name from email
      email: user?.email || '',
      company: business?.name || '',  // Business name as company
      user,
      business,
      subscription,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/settings/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { name, email, company, businessName, language } = req.body;

    // Update business name - accept both 'company' and 'businessName' for compatibility
    const newBusinessName = company || businessName;

    const updateData = {};
    if (newBusinessName) updateData.name = newBusinessName;
    if (language) updateData.language = language;

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
    });

    console.log(`✅ Business updated: ${updatedBusiness.name} (ID: ${businessId})`);

    res.json({
      message: 'Profile updated successfully',
      business: updatedBusiness,
      name: name || '',
      email: email || '',
      company: updatedBusiness.name,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/settings/notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    // For now, return default values
    // You can add a NotificationSettings table later
    res.json({
      emailOnCall: true,
      emailOnLimit: true,
      weeklySummary: false,
      smsNotifications: false,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/settings/notifications
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const preferences = req.body;
    
    // For now, just return the preferences
    // You can add database storage later
    res.json({
      message: 'Notification preferences updated',
      preferences,
    });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

export default router;
