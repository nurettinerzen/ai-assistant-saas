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
import elevenLabsService from '../services/elevenlabs.js';

const router = express.Router();

router.use(authenticateToken);

// ============================================================================
// COUNTRY TO PROVIDER MAPPING
// ============================================================================
const COUNTRY_PROVIDER_MAP = {
  'TR': 'NETGSM_ELEVENLABS',  // Turkey → NetGSM 0850 + 11Labs SIP Trunk
  'US': 'ELEVENLABS',         // USA → 11Labs (via Twilio import)
  // Future additions:
  // 'UK': 'ELEVENLABS',
  // 'CA': 'ELEVENLABS',
};

const PRICING = {
  ELEVENLABS: {
    monthlyCost: 5.00,  // $5/month
    currency: 'USD'
  },
  VAPI: {  // Legacy - deprecated
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

    // ========== NETGSM + 11LABS SIP TRUNK (Turkey) ==========
    if (provider === 'NETGSM_ELEVENLABS') {
      result = await provisionNetgsmElevenLabsNumber(businessId, assistantId);
    }
    // ========== 11LABS (USA - via Twilio) ==========
    else if (provider === 'ELEVENLABS') {
      result = await provisionElevenLabsNumber(businessId, assistantId, countryCode);
    }
    // ========== NETGSM (Legacy - now uses 11Labs) ==========
    else if (provider === 'NETGSM') {
      result = await provisionNetgsmElevenLabsNumber(businessId, assistantId);
    }
    // ========== VAPI (Legacy - deprecated) ==========
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
// HELPER: PROVISION NETGSM NUMBER + 11LABS SIP TRUNK (TURKEY)
// ============================================================================
async function provisionNetgsmElevenLabsNumber(businessId, assistantId) {
  console.log('🇹🇷 Provisioning Netgsm 0850 number with 11Labs SIP Trunk...');

  // Step 1: Purchase 0850 number from Netgsm
  const netgsmResult = await netgsmService.purchaseNumber();
  console.log('✅ Netgsm number purchased:', netgsmResult.phoneNumber);

  // Step 2: Get SIP credentials
  const sipCredentials = await netgsmService.getSipCredentials(netgsmResult.numberId);
  console.log('✅ SIP credentials obtained');

  // Step 3: Import to 11Labs as SIP Trunk if assistant is assigned
  let elevenLabsPhoneId = null;
  const formattedNumber = netgsmService.formatPhoneNumber(netgsmResult.phoneNumber);

  if (assistantId) {
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    if (!assistant || !assistant.elevenLabsAgentId) {
      throw new Error('Invalid assistant or assistant not configured with 11Labs');
    }

    // Import to 11Labs as SIP Trunk
    try {
      const elevenLabsResult = await elevenLabsService.importSipTrunkNumber({
        phoneNumber: formattedNumber,
        sipUri: `sip:${sipCredentials.sipUsername}@${sipCredentials.sipServer}`,
        sipUsername: sipCredentials.sipUsername,
        sipPassword: sipCredentials.sipPassword,
        sipServer: sipCredentials.sipServer,
        agentId: assistant.elevenLabsAgentId,
        label: `Netgsm TR - ${formattedNumber}`
      });

      elevenLabsPhoneId = elevenLabsResult.phone_number_id;
      console.log('✅ Number imported to 11Labs SIP Trunk:', elevenLabsPhoneId);
    } catch (error) {
      console.error('❌ Failed to import to 11Labs:', error.message);
      throw new Error(`Failed to import phone number to 11Labs: ${error.message}`);
    }
  }

  // Step 4: Save to database
  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      businessId: businessId,
      phoneNumber: formattedNumber,
      countryCode: 'TR',
      provider: 'ELEVENLABS',  // Use ELEVENLABS as provider since that's where it's connected
      netgsmNumberId: netgsmResult.numberId,
      elevenLabsPhoneId: elevenLabsPhoneId,
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
    provider: 'ELEVENLABS',
    countryCode: 'TR',
    status: 'ACTIVE',
    monthlyCost: phoneNumber.monthlyCost,
    elevenLabsPhoneId: elevenLabsPhoneId
  };
}

// ============================================================================
// HELPER: PROVISION NETGSM NUMBER (LEGACY - VAPI)
// ============================================================================
async function provisionNetgsmNumber(businessId, assistantId) {
  console.log('🇹🇷 [LEGACY] Provisioning Netgsm 0850 number (VAPI)...');

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
// HELPER: PROVISION 11LABS NUMBER (via Twilio import)
// ============================================================================
async function provisionElevenLabsNumber(businessId, assistantId, countryCode = 'US') {
  console.log(`🎙️ Provisioning 11Labs number for ${countryCode}...`);

  // Get assistant if provided
  let elevenLabsAgentId = null;
  if (assistantId) {
    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    if (!assistant || !assistant.elevenLabsAgentId) {
      throw new Error('Invalid assistant or assistant not configured with 11Labs');
    }

    elevenLabsAgentId = assistant.elevenLabsAgentId;
  }

  // For now, 11Labs requires Twilio phone number to be imported
  // First, we need to get the phone number from Twilio
  // This is a simplified version - in production you'd need Twilio SDK

  // Option 1: Use existing Twilio number (user provides it)
  // Option 2: Buy from Twilio and import to 11Labs

  // For now, we'll create a placeholder entry and let user configure Twilio
  // The actual 11Labs import happens when Twilio credentials are provided

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      businessId: businessId,
      phoneNumber: `pending-${Date.now()}`,  // Placeholder until Twilio is configured
      countryCode: countryCode,
      provider: 'ELEVENLABS',
      assistantId: assistantId,
      status: 'ACTIVE',
      monthlyCost: PRICING.ELEVENLABS.monthlyCost,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  console.log('✅ 11Labs phone number entry created (pending Twilio configuration)');

  return {
    id: phoneNumber.id,
    phoneNumber: phoneNumber.phoneNumber,
    provider: 'ELEVENLABS',
    countryCode: countryCode,
    status: 'PENDING_CONFIGURATION',
    monthlyCost: phoneNumber.monthlyCost,
    elevenLabsPhoneId: null,
    message: 'Please configure Twilio credentials to complete phone number setup'
  };
}

// ============================================================================
// IMPORT TWILIO NUMBER TO 11LABS
// ============================================================================
router.post('/:id/import-twilio', async (req, res) => {
  try {
    const { id } = req.params;
    const { twilioPhoneNumber, twilioAccountSid, twilioAuthToken } = req.body;
    const businessId = req.businessId;

    console.log('📞 Importing Twilio number to 11Labs:', twilioPhoneNumber);

    // Validate inputs
    if (!twilioPhoneNumber || !twilioAccountSid || !twilioAuthToken) {
      return res.status(400).json({
        error: 'Missing required Twilio credentials',
        required: ['twilioPhoneNumber', 'twilioAccountSid', 'twilioAuthToken']
      });
    }

    // Get phone number record
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id, businessId },
      include: { assistant: true }
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number record not found' });
    }

    // Get agent ID from assistant
    let agentId = null;
    if (phoneNumber.assistant?.elevenLabsAgentId) {
      agentId = phoneNumber.assistant.elevenLabsAgentId;
    }

    // Import to 11Labs
    const elevenLabsResult = await elevenLabsService.importPhoneNumber({
      phoneNumber: twilioPhoneNumber,
      twilioAccountSid,
      twilioAuthToken,
      agentId,
      label: `Business ${businessId} - ${twilioPhoneNumber}`
    });

    // Update database
    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: {
        phoneNumber: twilioPhoneNumber,
        elevenLabsPhoneId: elevenLabsResult.phone_number_id,
        status: 'ACTIVE'
      }
    });

    console.log('✅ Phone number imported to 11Labs:', elevenLabsResult.phone_number_id);

    res.json({
      success: true,
      phoneNumber: updated.phoneNumber,
      elevenLabsPhoneId: updated.elevenLabsPhoneId,
      status: 'ACTIVE'
    });

  } catch (error) {
    console.error('❌ Import Twilio error:', error);
    res.status(500).json({
      error: 'Failed to import Twilio number to 11Labs',
      details: error.message
    });
  }
});

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

    // Check assistant has either 11Labs or VAPI ID
    if (!assistant.elevenLabsAgentId && !assistant.vapiAssistantId) {
      return res.status(400).json({ error: 'Assistant is not configured with any voice provider' });
    }

    // Update in 11Labs if phone is connected to 11Labs
    if (phoneNumber.elevenLabsPhoneId && assistant.elevenLabsAgentId) {
      try {
        await elevenLabsService.updatePhoneNumber(phoneNumber.elevenLabsPhoneId, assistant.elevenLabsAgentId);
        console.log('✅ Updated phone number in 11Labs');
      } catch (elevenLabsError) {
        console.error('❌ 11Labs sync failed:', elevenLabsError);
        return res.status(500).json({
          error: 'Failed to sync with 11Labs',
          details: elevenLabsError.message
        });
      }
    }
    // Legacy: Update in VAPI if phone is connected to VAPI
    else if (phoneNumber.vapiPhoneId && assistant.vapiAssistantId) {
      try {
        if (phoneNumber.provider === 'NETGSM') {
          // BYOC numbers use vapiByocService
          await vapiByocService.assignAssistant(phoneNumber.vapiPhoneId, assistant.vapiAssistantId);
          console.log('✅ Updated BYOC number in VAPI');
        } else {
          // Native VAPI numbers use vapiService
          await vapiService.assignPhoneNumber(phoneNumber.vapiPhoneId, assistant.vapiAssistantId);
          console.log('✅ Updated VAPI number in VAPI');
        }
      } catch (vapiError) {
        console.error('❌ VAPI sync failed:', vapiError);
        return res.status(500).json({
          error: 'Failed to sync with VAPI',
          details: vapiError.message
        });
      }
    }

    // Update in database only after VAPI sync succeeds
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

    // Remove from 11Labs if connected
    if (phoneNumber.elevenLabsPhoneId) {
      try {
        await elevenLabsService.deletePhoneNumber(phoneNumber.elevenLabsPhoneId);
        console.log('✅ Removed from 11Labs');
      } catch (error) {
        console.error('⚠️ Failed to remove from 11Labs:', error.message);
      }
    }

    // Legacy: Remove from VAPI if connected
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

    // Get assistant to find agent ID
    let assistant = null;
    if (phoneNumber.assistantId) {
      assistant = await prisma.assistant.findUnique({
        where: { id: phoneNumber.assistantId }
      });
    }

    let result;

    // Use 11Labs for outbound call
    if (phoneNumber.elevenLabsPhoneId && assistant?.elevenLabsAgentId) {
      result = await elevenLabsService.initiateOutboundCall({
        agentId: assistant.elevenLabsAgentId,
        phoneNumberId: phoneNumber.elevenLabsPhoneId,
        toNumber: testPhoneNumber
      });
    }
    // Legacy: Use VAPI
    else if (phoneNumber.vapiPhoneId) {
      result = await vapiByocService.testByocNumber(phoneNumber.vapiPhoneId, testPhoneNumber);
    }
    else {
      return res.status(400).json({
        error: 'Phone number not connected to any voice provider',
        hint: 'Make sure the number is assigned to an assistant'
      });
    }

    res.json({
      success: true,
      message: 'Test call initiated',
      callId: result.call_sid || result.callId,
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
      provider: 'NETGSM_ELEVENLABS',  // NetGSM 0850 numbers + 11Labs SIP Trunk
      pricing: {
        monthly: PRICING.NETGSM.displayMonthly,
        currency: 'TRY',
        displayCurrency: '₺'
      },
      features: ['0850 Number', 'NetGSM SIP', '11Labs Voice', 'Natural Turkish']
    },
    {
      code: 'US',
      name: 'United States',
      flag: '🇺🇸',
      provider: 'ELEVENLABS',
      pricing: {
        monthly: PRICING.ELEVENLABS.monthlyCost,
        currency: 'USD',
        displayCurrency: '$'
      },
      features: ['Twilio Numbers', '11Labs Voice', 'Natural English']
    }
  ];

  res.json({ countries });
});

export default router;
