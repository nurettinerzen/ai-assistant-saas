// ============================================================================
// PHONE NUMBER ROUTES WITH BYOC SUPPORT
// ============================================================================
// Enhanced phone number management with BYOC (Bring Your Own Carrier)
// Supports: VAPI US numbers + Netgsm Turkey 0850 + SIP trunk integration
// ============================================================================

import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken } from '../middleware/auth.js';
import netgsmService from '../services/netgsm.js';
import vapiByocService from '../services/vapiByoc.js';
import vapiService from '../services/vapi.js';

const router = express.Router();

router.use(authenticateToken);

// ============================================================================
// COUNTRY TO PROVIDER MAPPING
// ============================================================================
const COUNTRY_PROVIDER_MAP = {
  'TR': 'NETGSM',  // Turkey → Netgsm
  'US': 'VAPI',     // USA → VAPI
  // Future additions:
  // 'UK': 'TWILIO',
  // 'CA': 'VAPI',
};

const PRICING = {
  VAPI: {
    monthlyCost: 5.00,  // $5/month
    currency: 'USD'
  },
  NETGSM: {
    monthlyCost: 0.46,  // ~$0.46/month (191 TL/year)
    annualCost: 5.50,   // ~$5.50/year
    displayMonthly: 20, // ₺20/month displayed to customer (with markup)
    currency: 'TRY'
  }
};

// ============================================================================
// GET ALL PHONE NUMBERS
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const businessId = req.businessId;

    if (!businessId) {
      return res.json({ phoneNumbers: [], count: 0 });
    }

    // Get phone numbers from new PhoneNumber model
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { businessId },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      phoneNumbers: phoneNumbers.map(pn => ({
        id: pn.id,
        phoneNumber: pn.phoneNumber,
        countryCode: pn.countryCode,
        provider: pn.provider,
        status: pn.status,
        assistantId: pn.assistantId,
        assistantName: pn.assistant?.name || 'Unassigned',
        monthlyCost: pn.monthlyCost,
        nextBillingDate: pn.nextBillingDate,
        createdAt: pn.createdAt,
        vapiPhoneId: pn.vapiPhoneId
      })),
      count: phoneNumbers.length
    });

  } catch (error) {
    console.error('❌ List phone numbers error:', error);
    res.status(500).json({
      error: 'Failed to list phone numbers',
      details: error.message
    });
  }
});

// ============================================================================
// PROVISION NEW PHONE NUMBER (AUTO-DETECT PROVIDER)
// ============================================================================
router.post('/provision', async (req, res) => {
  try {
    const { countryCode, assistantId } = req.body;
    const businessId = req.businessId;

    console.log('📞 Provisioning phone number...', { countryCode, assistantId, businessId });

    // Validate inputs
    if (!countryCode) {
      return res.status(400).json({
        error: 'Country code is required',
        example: { countryCode: 'TR or US', assistantId: 'optional' }

      });
    }

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

    // Check phone number limit
    const existingNumbers = await prisma.phoneNumber.count({
      where: { businessId }
    });

    if (subscription.phoneNumbersLimit > 0 && existingNumbers >= subscription.phoneNumbersLimit) {
      return res.status(403).json({
        error: `Phone number limit reached (${subscription.phoneNumbersLimit} numbers)`,
        upgrade: 'Consider upgrading your plan'
      });
    }

    // Determine provider based on country
    const provider = COUNTRY_PROVIDER_MAP[countryCode.toUpperCase()];

    if (!provider) {
      return res.status(400).json({
        error: `Country ${countryCode} is not supported yet`,
        supportedCountries: Object.keys(COUNTRY_PROVIDER_MAP)
      });
    }

    console.log(`✅ Using provider: ${provider} for ${countryCode}`);

    let result;

    // ========== TURKEY → NETGSM ==========
    if (provider === 'NETGSM') {
      result = await provisionNetgsmNumber(businessId, assistantId);
    }
    // ========== USA → VAPI ==========
    else if (provider === 'VAPI') {
      result = await provisionVapiNumber(businessId, assistantId);
    }
    else {
      return res.status(400).json({
        error: `Provider ${provider} not implemented yet`
      });
    }

    // Update subscription usage
    await prisma.subscription.update({
      where: { businessId },
      data: {
        phoneNumbersUsed: {
          increment: 1
        }
      }
    });

    console.log('✅ Phone number provisioned successfully:', result.phoneNumber);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Provision phone number error:', error);
    res.status(500).json({
      error: 'Failed to provision phone number',
      details: error.message
    });
  }
});

// ============================================================================
// HELPER: PROVISION NETGSM NUMBER (TURKEY)
// ============================================================================
async function provisionNetgsmNumber(businessId, assistantId) {
  console.log('🇹🇷 Provisioning Netgsm 0850 number...');

  // Step 1: Purchase 0850 number from Netgsm
  const netgsmResult = await netgsmService.purchaseNumber();

  console.log('✅ Netgsm number purchased:', netgsmResult.phoneNumber);

  // Step 2: Get SIP credentials
  const sipCredentials = await netgsmService.getSipCredentials(netgsmResult.numberId);

  console.log('✅ SIP credentials obtained');

  // Step 3: Import to VAPI as BYOC if assistant is assigned
  let vapiPhoneId = null;

  if (assistantId) {
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    if (!assistant || !assistant.vapiAssistantId) {
      throw new Error('Invalid assistant or assistant not configured with VAPI');
    }

    // Format phone number to E.164
    const formattedNumber = netgsmService.formatPhoneNumber(netgsmResult.phoneNumber);

    // Import to VAPI
    const vapiResult = await vapiByocService.importByocNumber({
      phoneNumber: formattedNumber,
      sipUri: `sip:${sipCredentials.sipUsername}@${sipCredentials.sipServer}`,
      sipUsername: sipCredentials.sipUsername,
      sipPassword: sipCredentials.sipPassword,
      assistantId: assistant.vapiAssistantId,
      name: `Netgsm - ${formattedNumber}`
    });

    vapiPhoneId = vapiResult.vapiPhoneId;
    console.log('✅ Number imported to VAPI:', vapiPhoneId);
  }

  // Step 4: Save to database
  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      businessId: businessId,
      phoneNumber: netgsmService.formatPhoneNumber(netgsmResult.phoneNumber),
      countryCode: 'TR',
      provider: 'NETGSM',
      netgsmNumberId: netgsmResult.numberId,
      vapiPhoneId: vapiPhoneId,
      sipUsername: sipCredentials.sipUsername,
      sipPassword: sipCredentials.sipPassword,
      sipServer: sipCredentials.sipServer,
      assistantId: assistantId,
      status: 'ACTIVE',
      monthlyCost: netgsmResult.monthlyCost,
      nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    }
  });

  return {
    id: phoneNumber.id,
    phoneNumber: phoneNumber.phoneNumber,
    provider: 'NETGSM',
    countryCode: 'TR',
    status: 'ACTIVE',
    monthlyCost: phoneNumber.monthlyCost,
    vapiPhoneId: vapiPhoneId
  };
}

// ============================================================================
// HELPER: PROVISION VAPI NUMBER (USA)
// ============================================================================
async function provisionVapiNumber(businessId, assistantId) {
  console.log('🇺🇸 Provisioning VAPI US number...');

  // Get assistant if provided
  let vapiAssistantId = null;
  if (assistantId) {
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    if (!assistant || !assistant.vapiAssistantId) {
      throw new Error('Invalid assistant or assistant not configured with VAPI');
    }

    vapiAssistantId = assistant.vapiAssistantId;
  }

  // Buy VAPI phone number
  const vapiPhone = await vapiService.buyPhoneNumber('415'); // Default to SF area code

  console.log('✅ VAPI number purchased:', vapiPhone.number);

  // Assign to assistant if provided
  if (vapiAssistantId) {
    await vapiService.assignPhoneNumber(vapiPhone.id, vapiAssistantId);
    console.log('✅ Number assigned to assistant');
  }

  // Save to database
  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      businessId: businessId,
      phoneNumber: vapiPhone.number,
      countryCode: 'US',
      provider: 'VAPI',
      vapiPhoneId: vapiPhone.id,
      assistantId: assistantId,
      status: 'ACTIVE',
      monthlyCost: PRICING.VAPI.monthlyCost,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  });

  return {
    id: phoneNumber.id,
    phoneNumber: phoneNumber.phoneNumber,
    provider: 'VAPI',
    countryCode: 'US',
    status: 'ACTIVE',
    monthlyCost: phoneNumber.monthlyCost,
    vapiPhoneId: phoneNumber.vapiPhoneId
  };
}

// ============================================================================
// UPDATE ASSISTANT ASSIGNMENT
// ============================================================================
router.patch('/:id/assistant', async (req, res) => {
  try {
    const { id } = req.params;
    const { assistantId } = req.body;
    const businessId = req.businessId;

    console.log('🔄 Updating phone number assistant:', { id, assistantId });

    // Get phone number
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: id,
        businessId: businessId
      }
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    // Get new assistant
    const assistant = await prisma.assistant.findFirst({
      where: {
        id: assistantId,
        businessId: businessId
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    // Update in VAPI if phone is connected to VAPI
    if (phoneNumber.vapiPhoneId && assistant.vapiAssistantId) {
      await vapiByocService.assignAssistant(phoneNumber.vapiPhoneId, assistant.vapiAssistantId);
      console.log('✅ Updated in VAPI');
    }

    // Update in database
    const updated = await prisma.phoneNumber.update({
      where: { id: id },
      data: { assistantId: assistantId }
    });

    res.json({
      success: true,
      phoneNumber: updated.phoneNumber,
      assistantId: updated.assistantId,
      assistantName: assistant.name
    });

  } catch (error) {
    console.error('❌ Update assistant error:', error);
    res.status(500).json({
      error: 'Failed to update assistant',
      details: error.message
    });
  }
});

// ============================================================================
// DELETE/CANCEL PHONE NUMBER
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;

    console.log('🗑️ Cancelling phone number:', id);

    // Get phone number
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: id,
        businessId: businessId
      }
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    // Cancel with provider
    if (phoneNumber.provider === 'NETGSM' && phoneNumber.netgsmNumberId) {
      try {
        await netgsmService.cancelNumber(phoneNumber.netgsmNumberId);
        console.log('✅ Cancelled with Netgsm');
      } catch (error) {
        console.error('⚠️ Failed to cancel with Netgsm:', error.message);
      }
    }

    // Remove from VAPI if connected
    if (phoneNumber.vapiPhoneId) {
      try {
        await vapiByocService.removeByocNumber(phoneNumber.vapiPhoneId);
        console.log('✅ Removed from VAPI');
      } catch (error) {
        console.error('⚠️ Failed to remove from VAPI:', error.message);
      }
    }

    // Delete from database
    await prisma.phoneNumber.delete({
      where: { id: id }
    });

    // Update subscription usage
    await prisma.subscription.update({
      where: { businessId: businessId },
      data: {
        phoneNumbersUsed: {
          decrement: 1
        }
      }
    });

    console.log('✅ Phone number cancelled successfully');

    res.json({
      success: true,
      message: 'Phone number cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Cancel phone number error:', error);
    res.status(500).json({
      error: 'Failed to cancel phone number',
      details: error.message
    });
  }
});

// ============================================================================
// TEST CALL
// ============================================================================
router.post('/:id/test-call', async (req, res) => {
  try {
    const { id } = req.params;
    const { testPhoneNumber } = req.body;
    const businessId = req.businessId;

    console.log('☎️ Initiating test call...', { id, testPhoneNumber });

    if (!testPhoneNumber) {
      return res.status(400).json({
        error: 'Test phone number is required',
        example: { testPhoneNumber: '+905551234567' }
      });
    }

    // Get phone number
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: id,
        businessId: businessId
      }
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    if (!phoneNumber.vapiPhoneId) {
      return res.status(400).json({
        error: 'Phone number not connected to VAPI',
        hint: 'Make sure the number is assigned to an assistant'
      });
    }

    // Make test call via VAPI
    const result = await vapiByocService.testByocNumber(phoneNumber.vapiPhoneId, testPhoneNumber);

    res.json({
      success: true,
      message: 'Test call initiated',
      callId: result.callId,
      from: phoneNumber.phoneNumber,
      to: testPhoneNumber
    });

  } catch (error) {
    console.error('❌ Test call error:', error);
    res.status(500).json({
      error: 'Failed to initiate test call',
      details: error.message
    });
  }
});

// ============================================================================
// GET AVAILABLE COUNTRIES
// ============================================================================
router.get('/countries', (req, res) => {
  const countries = [
    {
      code: 'TR',
      name: 'Turkey',
      flag: '🇹🇷',
      provider: 'NETGSM',
      pricing: {
        monthly: PRICING.NETGSM.displayMonthly,
        currency: 'TRY',
        displayCurrency: '₺'
      },
      features: ['0850 Number', 'SIP Trunk', 'BYOC']
    },
    {
      code: 'US',
      name: 'United States',
      flag: '🇺🇸',
      provider: 'VAPI',
      pricing: {
        monthly: PRICING.VAPI.monthlyCost,
        currency: 'USD',
        displayCurrency: '$'
      },
      features: ['Local Numbers', 'Direct Integration']
    }
  ];

  res.json({ countries });
});

export default router;
