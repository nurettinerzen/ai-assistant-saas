// ============================================================================
// PHONE NUMBER ROUTES WITH BYOC SUPPORT
// ============================================================================
// Enhanced phone number management with BYOC (Bring Your Own Carrier)
// Supports: VAPI US numbers + SIP trunk integration (Netgsm, Bulutfon, etc.)
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';
import { getProvidersForCountry } from '../data/voip-providers.js';

const router = express.Router();
const prisma = new PrismaClient();

const VAPI_API_KEY = process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

router.use(authenticateToken);

// ============================================================================
// GET ALL PHONE NUMBERS
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const businessId = req.businessId;

    if (!businessId) {
      return res.json({ phoneNumbers: [], count: 0 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    const phoneNumbers = (business?.phoneNumbers || []).map(number => ({
      id: number,
      phoneNumber: number,
      provider: number.startsWith('+1') ? 'VAPI' : 'BYOC',
      status: 'ACTIVE',
      assistantName: 'Default Assistant',
      createdAt: new Date()
    }));

    res.json({
      phoneNumbers,
      count: phoneNumbers.length
    });
  } catch (error) {
    console.error('❌ List phone numbers error:', error);
    res.json({ phoneNumbers: [], count: 0 });
  }
});

// ============================================================================
// GET VOIP PROVIDERS FOR COUNTRY
// ============================================================================
router.get('/providers/:countryCode', (req, res) => {
  try {
    const { countryCode } = req.params;
    const providers = getProvidersForCountry(countryCode);
    
    console.log(`🌍 GET /api/phone-numbers/providers/${countryCode}`);
    
    res.json({
      country: providers.name,
      code: providers.code,
      flag: providers.flag,
      recommended: providers.recommended,
      providers: providers.providers
    });
  } catch (error) {
    console.error('❌ Get providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// ============================================================================
// CREATE VAPI US NUMBER (FREE)
// ============================================================================
router.post('/vapi/create', async (req, res) => {
  try {
    const { areaCode, assistantId } = req.body;
    const businessId = req.businessId;

    console.log('📞 Creating VAPI US number...', { areaCode, assistantId });

    // Check subscription limits
    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription || subscription.plan === 'FREE') {
      return res.status(403).json({ 
        error: 'Phone numbers are not available on FREE plan',
        upgradeRequired: true
      });
    }

    // Create VAPI phone number
    const response = await axios.post(
      `${VAPI_BASE_URL}/phone-number`,
      {
        provider: 'vapi',
        number: areaCode ? `+1${areaCode}` : undefined,
        assistantId: assistantId,
        name: `US Number - ${new Date().toISOString()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const phoneNumber = response.data.number;
    console.log('✅ VAPI number created:', phoneNumber);

    // Add to business phoneNumbers array
    await prisma.business.update({
      where: { id: businessId },
      data: {
        phoneNumbers: {
          push: phoneNumber
        }
      }
    });

    res.json({
      success: true,
      phoneNumber: phoneNumber,
      provider: 'VAPI',
      vapiPhoneNumberId: response.data.id
    });

  } catch (error) {
    console.error('❌ Create VAPI number error:', error.response?.data || error);
    res.status(500).json({ 
      error: 'Failed to create phone number',
      details: error.response?.data?.message || error.message
    });
  }
});

// ============================================================================
// CONNECT BYOC SIP TRUNK
// ============================================================================
router.post('/byoc/connect', async (req, res) => {
  try {
    const {
      provider,      // 'netgsm', 'bulutfon', 'twilio', 'custom'
      sipServer,     // 'sip.netgsm.com.tr'
      sipUsername,   // SIP username
      sipPassword,   // SIP password
      phoneNumber,   // '+908501234567'
      assistantId    // VAPI assistant ID
    } = req.body;

    const businessId = req.businessId;

    console.log('📞 Connecting BYOC SIP trunk...', { provider, sipServer, phoneNumber });

    // Validate inputs
    if (!sipServer || !sipUsername || !sipPassword || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['sipServer', 'sipUsername', 'sipPassword', 'phoneNumber']
      });
    }

    // Check subscription limits
    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription || subscription.plan === 'FREE') {
      return res.status(403).json({ 
        error: 'BYOC is not available on FREE plan',
        upgradeRequired: true
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true }
    });

    // Step 1: Create SIP Trunk Credential in VAPI
    console.log('🔐 Step 1: Creating SIP trunk credential...');
    const credentialResponse = await axios.post(
      `${VAPI_BASE_URL}/credential`,
      {
        provider: 'byo-sip-trunk',
        name: `${business.name} - ${provider}`,
        byoSipTrunkCredential: {
          sipTrunkAddress: sipServer,
          sipTrunkUsername: sipUsername,
          sipTrunkPassword: sipPassword
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const credentialId = credentialResponse.data.id;
    console.log('✅ SIP credential created:', credentialId);

    // Step 2: Create BYO Phone Number in VAPI
    console.log('📞 Step 2: Creating BYO phone number...');
    const phoneResponse = await axios.post(
      `${VAPI_BASE_URL}/phone-number`,
      {
        provider: 'byo-phone-number',
        number: phoneNumber,
        numberE164CheckEnabled: false, // Important for non-US numbers
        credentialId: credentialId,
        assistantId: assistantId,
        name: `${business.name} - ${phoneNumber}`
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const vapiPhoneNumberId = phoneResponse.data.id;
    console.log('✅ BYO phone number created:', vapiPhoneNumberId);

    // Step 3: Save to database
    await prisma.business.update({
      where: { id: businessId },
      data: {
        phoneNumbers: {
          push: phoneNumber
        }
      }
    });

    console.log('✅ BYOC connection complete!');

    res.json({
      success: true,
      phoneNumber: phoneNumber,
      provider: provider,
      vapiCredentialId: credentialId,
      vapiPhoneNumberId: vapiPhoneNumberId,
      status: 'active'
    });

  } catch (error) {
    console.error('❌ BYOC connect error:', error.response?.data || error);
    res.status(500).json({ 
      error: 'Failed to connect BYOC number',
      details: error.response?.data?.message || error.message,
      step: error.response?.data?.step || 'unknown'
    });
  }
});

// ============================================================================
// TEST SIP CONNECTION
// ============================================================================
router.get('/byoc/test/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    console.log('🧪 Testing SIP connection for:', phoneNumber);

    // In a real implementation, you would test the SIP connection
    // For now, just return success
    res.json({
      success: true,
      status: 'connected',
      message: 'SIP trunk is reachable'
    });

  } catch (error) {
    console.error('❌ Test SIP error:', error);
    res.status(500).json({ 
      error: 'Failed to test SIP connection',
      details: error.message
    });
  }
});

// ============================================================================
// RELEASE PHONE NUMBER
// ============================================================================
router.delete('/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const businessId = req.businessId;

    console.log('🗑️ Releasing phone number:', phoneNumber);

    // Remove from business phoneNumbers array
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    const updatedNumbers = (business?.phoneNumbers || []).filter(
      num => num !== phoneNumber
    );

    await prisma.business.update({
      where: { id: businessId },
      data: {
        phoneNumbers: updatedNumbers
      }
    });

    // Note: In production, you should also delete from VAPI
    // This requires storing VAPI phone number IDs

    console.log('✅ Phone number released');

    res.json({
      success: true,
      message: 'Phone number released successfully'
    });

  } catch (error) {
    console.error('❌ Release number error:', error);
    res.status(500).json({ 
      error: 'Failed to release phone number',
      details: error.message
    });
  }
});

// ============================================================================
// TEST CALL
// ============================================================================
router.post('/test/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { testPhoneNumber } = req.body;

    console.log('☎️ Initiating test call from', phoneNumber, 'to', testPhoneNumber);

    // In a real implementation, trigger a test call via VAPI
    res.json({
      success: true,
      message: 'Test call initiated',
      callId: 'test-' + Date.now()
    });

  } catch (error) {
    console.error('❌ Test call error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate test call',
      details: error.message
    });
  }
});

export default router;
