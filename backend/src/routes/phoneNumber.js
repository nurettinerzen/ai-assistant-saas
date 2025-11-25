// ============================================================================
// PHONE NUMBER ROUTES
// ============================================================================
// FILE: backend/src/routes/phoneNumber.js (NEW FILE)
//
// Handles manual phone number provisioning and management
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, verifyBusinessAccess } from '../middleware/auth.js';
import { checkLimit } from '../middleware/subscriptionLimits.js';
import vapiPhoneNumber from '../services/vapiPhoneNumber.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Get all phone numbers for business
router.get('/', async (req, res) => {
  try {
    const businessId = req.businessId;

    // For now, return empty array (VAPI service integration can be added later)
    // const phoneNumbers = await vapiPhoneNumber.listPhoneNumbers(businessId);
    
    // Get from business phoneNumbers array
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    const phoneNumbers = (business?.phoneNumbers || []).map(number => ({
      id: number,
      phoneNumber: number,
      status: 'ACTIVE',
      assistantName: 'Default Assistant',
      createdAt: new Date()
    }));

    res.json({
      phoneNumbers,
      count: phoneNumbers.length
    });
  } catch (error) {
    console.error('List phone numbers error:', error);
    res.status(500).json({ 
      error: 'Failed to list phone numbers',
      message: error.message
    });
  }
});

// Check if can provision more numbers
router.get('/can-provision', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const result = await vapiPhoneNumber.canProvisionNumber(businessId);

    res.json(result);
  } catch (error) {
    console.error('Check provision error:', error);
    res.status(500).json({ error: 'Failed to check provision limits' });
  }
});

// Provision a new phone number
router.post('/provision', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { assistantId, areaCode } = req.body;

    // Get business assistant ID if not provided
    let finalAssistantId = assistantId;
    if (!finalAssistantId) {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { vapiAssistantId: true }
      });

      if (!business?.vapiAssistantId) {
        return res.status(400).json({ 
          error: 'No assistant found',
          message: 'Please create an assistant first before provisioning a phone number'
        });
      }

      finalAssistantId = business.vapiAssistantId;
    }

    // Provision the number
    const result = await vapiPhoneNumber.provisionPhoneNumber(
      businessId,
      finalAssistantId,
      areaCode
    );

    res.json({
      success: true,
      phoneNumber: result.phoneNumber,
      message: 'Phone number provisioned successfully'
    });
  } catch (error) {
    console.error('Provision phone number error:', error);
    res.status(500).json({ 
      error: 'Failed to provision phone number',
      message: error.message
    });
  }
});

// Release (delete) a phone number
router.delete('/:phoneNumber', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const { phoneNumber } = req.params;

    // Verify this phone number belongs to this business
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    if (!business?.phoneNumbers?.includes(phoneNumber)) {
      return res.status(404).json({ 
        error: 'Phone number not found',
        message: 'This phone number does not belong to your business'
      });
    }

    // Release the number
    await vapiPhoneNumber.releasePhoneNumber(businessId, phoneNumber);

    res.json({
      success: true,
      message: 'Phone number released successfully'
    });
  } catch (error) {
    console.error('Release phone number error:', error);
    res.status(500).json({ 
      error: 'Failed to release phone number',
      message: error.message
    });
  }
});

// Update phone number's assistant
router.patch('/:phoneNumber/assistant', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const { phoneNumber } = req.params;
    const { assistantId } = req.body;

    if (!assistantId) {
      return res.status(400).json({ error: 'Assistant ID required' });
    }

    // Verify this phone number belongs to this business
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    if (!business?.phoneNumbers?.includes(phoneNumber)) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    // Update the assistant
    await vapiPhoneNumber.updatePhoneNumberAssistant(phoneNumber, assistantId);

    res.json({
      success: true,
      message: 'Phone number updated successfully'
    });
  } catch (error) {
    console.error('Update phone number error:', error);
    res.status(500).json({ 
      error: 'Failed to update phone number',
      message: error.message
    });
  }
});

export default router;
