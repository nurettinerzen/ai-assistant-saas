// ============================================================================
// VAPI PHONE NUMBER SERVICE
// ============================================================================
// FILE: backend/src/services/vapiPhoneNumber.js
//
// Handles automatic phone number provisioning via VAPI API
// ============================================================================

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = process.env.VAPI_BASE_URL || 'https://api.vapi.ai';

/**
 * Provision a new phone number via VAPI
 * @param {Number} businessId 
 * @param {String} assistantId - VAPI assistant ID
 * @param {String} areaCode - Optional area code (default: 555)
 */
export const provisionPhoneNumber = async (businessId, assistantId, areaCode = '212') => {
  try {
    console.log(`📞 Provisioning phone number for business ${businessId}...`);

    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    // Get business details
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        vapiAssistantId: true,
        phoneNumbers: true
      }
    });

    if (!business) {
      throw new Error('Business not found');
    }

    const finalAssistantId = assistantId || business.vapiAssistantId;

    if (!finalAssistantId) {
      throw new Error('No assistant ID available. Create an assistant first.');
    }

    // Call VAPI API to create phone number
    const response = await axios.post(
      `${VAPI_BASE_URL}/phone-number`,
      {
        provider: 'twilio',
        name: `${business.name} - Business Line`,
        assistantId: finalAssistantId,
        numberE164CheckEnabled: true,
        // You can specify areaCode or let VAPI choose
        // areaCode: areaCode
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const phoneData = response.data;
    const phoneNumber = phoneData.number; // E.164 format: +15551234567

    console.log(`✅ Phone number provisioned: ${phoneNumber}`);

    // Update business with new phone number
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        phoneNumbers: {
          push: phoneNumber
        },
        // Keep legacy field for backwards compatibility
        vapiPhoneNumber: phoneNumber
      }
    });

    // Update subscription phoneNumbersUsed count
    await prisma.subscription.update({
      where: { businessId },
      data: {
        phoneNumbersUsed: updatedBusiness.phoneNumbers.length
      }
    });

    return {
      phoneNumber,
      vapiPhoneNumberId: phoneData.id,
      assistantId: finalAssistantId,
      provider: 'twilio',
      status: 'active'
    };
  } catch (error) {
    console.error('❌ Error provisioning phone number:', error.response?.data || error.message);
    
    // Better error messages
    if (error.response?.status === 401) {
      throw new Error('VAPI API key is invalid');
    } else if (error.response?.status === 402) {
      throw new Error('Insufficient VAPI credits. Please add credits to your VAPI account.');
    } else if (error.response?.status === 404) {
      throw new Error('Assistant not found in VAPI. Please check assistant ID.');
    } else {
      throw new Error(error.response?.data?.message || error.message || 'Failed to provision phone number');
    }
  }
};

/**
 * Release (delete) a phone number from VAPI
 * @param {Number} businessId 
 * @param {String} phoneNumber - Phone number to release
 */
export const releasePhoneNumber = async (businessId, phoneNumber) => {
  try {
    console.log(`🗑️ Releasing phone number ${phoneNumber} for business ${businessId}...`);

    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    // First, get the VAPI phone number ID
    // Note: You may need to store vapiPhoneNumberId in your database
    // For now, we'll list phone numbers and find the matching one
    const listResponse = await axios.get(
      `${VAPI_BASE_URL}/phone-number`,
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      }
    );

    const phoneNumberData = listResponse.data.find(pn => pn.number === phoneNumber);

    if (!phoneNumberData) {
      console.warn(`⚠️ Phone number ${phoneNumber} not found in VAPI`);
    } else {
      // Delete from VAPI
      await axios.delete(
        `${VAPI_BASE_URL}/phone-number/${phoneNumberData.id}`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );

      console.log(`✅ Phone number ${phoneNumber} released from VAPI`);
    }

    // Remove from business phoneNumbers array
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phoneNumbers: true }
    });

    const updatedPhoneNumbers = business.phoneNumbers.filter(num => num !== phoneNumber);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        phoneNumbers: updatedPhoneNumbers,
        // If this was the legacy field, clear it
        vapiPhoneNumber: business.phoneNumbers[0] === phoneNumber ? null : undefined
      }
    });

    // Update subscription count
    await prisma.subscription.update({
      where: { businessId },
      data: {
        phoneNumbersUsed: updatedPhoneNumbers.length
      }
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error releasing phone number:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update assistant assigned to a phone number
 * @param {String} phoneNumber 
 * @param {String} assistantId 
 */
export const updatePhoneNumberAssistant = async (phoneNumber, assistantId) => {
  try {
    console.log(`🔄 Updating phone number ${phoneNumber} to use assistant ${assistantId}...`);

    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    // Get VAPI phone number ID
    const listResponse = await axios.get(
      `${VAPI_BASE_URL}/phone-number`,
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      }
    );

    const phoneNumberData = listResponse.data.find(pn => pn.number === phoneNumber);

    if (!phoneNumberData) {
      throw new Error(`Phone number ${phoneNumber} not found in VAPI`);
    }

    // Update phone number
    await axios.patch(
      `${VAPI_BASE_URL}/phone-number/${phoneNumberData.id}`,
      {
        assistantId
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Phone number updated to use new assistant`);

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating phone number:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * List all available phone numbers for a business
 * @param {Number} businessId 
 */
export const listPhoneNumbers = async (businessId) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        phoneNumbers: true,
        vapiAssistantId: true,
        subscription: {
          select: {
            plan: true
          }
        }
      }
    });

    if (!business) {
      throw new Error('Business not found');
    }

    // Get details from VAPI if API key is available
    let vapiDetails = [];
    if (VAPI_API_KEY) {
      try {
        const listResponse = await axios.get(
          `${VAPI_BASE_URL}/phone-number`,
          {
            headers: {
              'Authorization': `Bearer ${VAPI_API_KEY}`
            }
          }
        );

        vapiDetails = listResponse.data.filter(pn => 
          business.phoneNumbers.includes(pn.number)
        );
      } catch (error) {
        console.warn('Could not fetch VAPI details:', error.message);
      }
    }

    // Combine database and VAPI data
    return business.phoneNumbers.map(phoneNumber => {
      const vapiData = vapiDetails.find(vd => vd.number === phoneNumber);
      return {
        phoneNumber,
        status: vapiData ? 'active' : 'unknown',
        assistantId: vapiData?.assistantId || business.vapiAssistantId,
        provider: vapiData?.provider || 'twilio',
        createdAt: vapiData?.createdAt
      };
    });
  } catch (error) {
    console.error('❌ Error listing phone numbers:', error);
    throw error;
  }
};

/**
 * Check if business can provision more phone numbers
 * @param {Number} businessId 
 */
export const canProvisionNumber = async (businessId) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            phoneNumbers: true
          }
        }
      }
    });

    if (!subscription) {
      return { 
        allowed: false, 
        reason: 'No subscription found',
        currentCount: 0,
        limit: 0
      };
    }

    const limits = {
      FREE: 0,
      STARTER: 1,
      PROFESSIONAL: 3,
      ENTERPRISE: 10
    };

    const currentCount = subscription.business.phoneNumbers?.length || 0;
    const limit = limits[subscription.plan];

    return {
      allowed: currentCount < limit,
      currentCount,
      limit,
      plan: subscription.plan
    };
  } catch (error) {
    console.error('❌ Error checking phone number limits:', error);
    throw error;
  }
};

/**
 * Provision phone numbers on upgrade
 * Called by subscription webhook when user upgrades
 * @param {Number} businessId 
 * @param {String} newPlan 
 */
export const handlePlanUpgrade = async (businessId, newPlan) => {
  try {
    console.log(`🎉 Handling plan upgrade for business ${businessId} to ${newPlan}`);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        vapiAssistantId: true,
        phoneNumbers: true
      }
    });

    if (!business.vapiAssistantId) {
      console.warn('⚠️ No assistant ID found. User needs to create assistant first.');
      return { success: false, reason: 'no_assistant' };
    }

    const currentNumberCount = business.phoneNumbers?.length || 0;
    const limits = {
      FREE: 0,
      STARTER: 1,
      PROFESSIONAL: 3,
      ENTERPRISE: 10
    };

    const newLimit = limits[newPlan];

    // If upgrading from FREE to STARTER+, provision first number
    if (currentNumberCount === 0 && newLimit > 0) {
      console.log('🎯 First time upgrade - provisioning phone number...');
      const result = await provisionPhoneNumber(businessId, business.vapiAssistantId);
      return { 
        success: true, 
        provisioned: true,
        phoneNumber: result.phoneNumber 
      };
    }

    return { 
      success: true, 
      provisioned: false,
      message: 'Phone number provisioning available in dashboard'
    };
  } catch (error) {
    console.error('❌ Error handling plan upgrade:', error);
    return { success: false, error: error.message };
  }
};

export default {
  provisionPhoneNumber,
  releasePhoneNumber,
  updatePhoneNumberAssistant,
  listPhoneNumbers,
  canProvisionNumber,
  handlePlanUpgrade
};
