import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, verifyBusinessAccess, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// 🌍 SUPPORTED LANGUAGES (15+)
const SUPPORTED_LANGUAGES = [
  'EN', 'TR', 'DE', 'FR', 'ES', 'IT', 'PT',
  'RU', 'AR', 'JA', 'KO', 'ZH', 'HI', 'NL', 'PL', 'SV'
];

// Get chat widget settings for business (MUST be before /:businessId route)
router.get('/chat-widget', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      select: {
        chatEmbedKey: true,
        chatWidgetEnabled: true
      }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({
      embedKey: business.chatEmbedKey,
      enabled: business.chatWidgetEnabled
    });
  } catch (error) {
    console.error('Get chat widget settings error:', error);
    res.status(500).json({ error: 'Failed to fetch chat widget settings' });
  }
});

// Update chat widget enabled status
router.put('/chat-widget', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;

    const business = await prisma.business.update({
      where: { id: req.businessId },
      data: { chatWidgetEnabled: enabled },
      select: {
        chatEmbedKey: true,
        chatWidgetEnabled: true
      }
    });

    res.json({
      embedKey: business.chatEmbedKey,
      enabled: business.chatWidgetEnabled
    });
  } catch (error) {
    console.error('Update chat widget settings error:', error);
    res.status(500).json({ error: 'Failed to update chat widget settings' });
  }
});

// Get chat embed key for business (legacy endpoint, kept for backward compatibility)
router.get('/embed-key', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      select: { chatEmbedKey: true }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ embedKey: business.chatEmbedKey });
  } catch (error) {
    console.error('Get embed key error:', error);
    res.status(500).json({ error: 'Failed to fetch embed key' });
  }
});

// Get business details
router.get('/:businessId', authenticateToken, verifyBusinessAccess, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      include: {
        subscription: true,
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        assistants: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(business);
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({ error: 'Failed to fetch business data' });
  }
});

// Update business settings
router.put('/:businessId', authenticateToken, verifyBusinessAccess, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { name, language, businessType, country, timezone } = req.body;

    // 🌍 Validate language if provided
    if (language && !SUPPORTED_LANGUAGES.includes(language.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid language code',
        supportedLanguages: SUPPORTED_LANGUAGES
      });
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: req.businessId },
      data: {
        ...(name && { name }),
        ...(businessType && { businessType: businessType.toUpperCase() }),
        ...(language && { language: language.toUpperCase() }),
        ...(country && { country: country.toUpperCase() }),
        ...(timezone && { timezone }),
      },
    });

    console.log(`✅ Business updated: ${updatedBusiness.name}, type: ${updatedBusiness.businessType}`);
    res.json(updatedBusiness);
  } catch (error) {
    console.error('Update business error:', error);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

export default router;
