import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
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
        name: true,
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
      name: user?.name || '', // User's actual name
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
    const userId = req.userId;
    const businessId = req.businessId;
    const { name, email, company, businessName, language, businessType, country, timezone } = req.body;

    // Update user name if provided
    let updatedUser = null;
    if (name !== undefined) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, email: true, name: true, role: true }
      });
    }

    // Update business - accept both 'company' and 'businessName' for compatibility
    const newBusinessName = company || businessName;

    const businessUpdateData = {};
    if (newBusinessName !== undefined) businessUpdateData.name = newBusinessName;
    if (language !== undefined) businessUpdateData.language = language.toUpperCase();
    if (businessType !== undefined) businessUpdateData.businessType = businessType.toUpperCase();
    if (country !== undefined) businessUpdateData.country = country.toUpperCase();
    if (timezone !== undefined) businessUpdateData.timezone = timezone;

    let updatedBusiness = null;
    if (Object.keys(businessUpdateData).length > 0) {
      updatedBusiness = await prisma.business.update({
        where: { id: businessId },
        data: businessUpdateData,
      });
      console.log(`✅ Business updated: ${updatedBusiness.name} (ID: ${businessId})`, businessUpdateData);
    }

    // Fetch current state to return
    const currentUser = updatedUser || await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true }
    });

    const currentBusiness = updatedBusiness || await prisma.business.findUnique({
      where: { id: businessId }
    });

    res.json({
      message: 'Profile updated successfully',
      user: currentUser,
      business: currentBusiness,
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      company: currentBusiness?.name || '',
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

// POST /api/settings/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    console.log(`✅ Password changed for user ${userId}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
