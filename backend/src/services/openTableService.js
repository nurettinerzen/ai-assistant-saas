// ============================================================================
// OPENTABLE INTEGRATION SERVICE
// ============================================================================
// FILE: backend/src/services/openTableService.js
//
// Handles restaurant reservation management via OpenTable API
// ============================================================================

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Note: OpenTable API details are simplified for this implementation
// Actual implementation would require OpenTable partner account
const OPENTABLE_API_BASE = 'https://api.opentable.com/v2';

/**
 * Check if business has OpenTable integration configured
 */
export const hasIntegration = async (businessId) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'OPENTABLE',
        isActive: true
      }
    });
    return !!integration;
  } catch (error) {
    return false;
  }
};

/**
 * Get OpenTable credentials for a business
 */
const getCredentials = async (businessId) => {
  const integration = await prisma.integration.findFirst({
    where: {
      businessId,
      type: 'OPENTABLE',
      isActive: true
    }
  });

  if (!integration) {
    throw new Error('OpenTable integration not configured');
  }

  return integration.credentials;
};

/**
 * Check availability for a reservation
 * @param {Number} businessId 
 * @param {Object} params - { date, time, partySize }
 */
export const checkAvailability = async (businessId, params) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, restaurantId } = credentials;
    const { date, time, partySize } = params;

    // Format: YYYY-MM-DD
    const formattedDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    console.log(`🔍 Checking OpenTable availability for ${partySize} guests on ${formattedDate} at ${time}`);

    // API call to OpenTable
    const response = await axios.get(
      `${OPENTABLE_API_BASE}/restaurants/${restaurantId}/availability`,
      {
        params: {
          date: formattedDate,
          time: time,
          party_size: partySize
        },
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const slots = response.data.availability || [];
    const available = slots.length > 0;

    console.log(`✅ OpenTable availability check: ${available ? 'Available' : 'No slots'}`);

    return {
      available,
      slots: slots.map(slot => ({
        time: slot.time,
        available: slot.available,
        duration: slot.duration || 120 // minutes
      })),
      message: available 
        ? `We have availability for ${partySize} guests on ${formattedDate}` 
        : `Sorry, no availability for ${partySize} guests on ${formattedDate}`
    };
  } catch (error) {
    console.error('❌ OpenTable availability error:', error.response?.data || error.message);
    
    // Return graceful fallback
    return {
      available: false,
      error: true,
      message: 'Unable to check availability at this time. Please call us directly.'
    };
  }
};

/**
 * Create a reservation
 * @param {Number} businessId 
 * @param {Object} reservationData - { date, time, partySize, customerName, customerPhone, customerEmail, notes }
 */
export const createReservation = async (businessId, reservationData) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, restaurantId } = credentials;
    const { date, time, partySize, customerName, customerPhone, customerEmail, notes } = reservationData;

    const formattedDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    console.log(`📝 Creating OpenTable reservation for ${customerName}`);

    // API call to create reservation
    const response = await axios.post(
      `${OPENTABLE_API_BASE}/restaurants/${restaurantId}/reservations`,
      {
        date: formattedDate,
        time: time,
        party_size: partySize,
        customer: {
          first_name: customerName.split(' ')[0],
          last_name: customerName.split(' ').slice(1).join(' ') || customerName,
          phone: customerPhone,
          email: customerEmail
        },
        notes: notes || ''
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reservation = response.data;

    console.log(`✅ OpenTable reservation created: ${reservation.id}`);

    // Store in our database for tracking
    await prisma.appointment.create({
      data: {
        businessId,
        customerName,
        customerPhone,
        customerEmail,
        appointmentDate: new Date(`${formattedDate}T${time}`),
        duration: 120, // Default 2 hours
        serviceType: 'Restaurant Reservation',
        notes: `OpenTable Reservation ID: ${reservation.id}\n${notes || ''}`,
        status: 'CONFIRMED'
      }
    });

    return {
      success: true,
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmation_number || reservation.id,
      message: `Reservation confirmed for ${partySize} guests on ${formattedDate} at ${time}. Confirmation number: ${reservation.confirmation_number || reservation.id}`
    };
  } catch (error) {
    console.error('❌ OpenTable reservation error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to create reservation. Please try again or call us directly.'
    };
  }
};

/**
 * Cancel a reservation
 * @param {Number} businessId 
 * @param {String} reservationId 
 */
export const cancelReservation = async (businessId, reservationId) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, restaurantId } = credentials;

    console.log(`❌ Canceling OpenTable reservation: ${reservationId}`);

    await axios.delete(
      `${OPENTABLE_API_BASE}/restaurants/${restaurantId}/reservations/${reservationId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    console.log(`✅ OpenTable reservation canceled: ${reservationId}`);

    // Update in our database
    await prisma.appointment.updateMany({
      where: {
        businessId,
        notes: { contains: reservationId }
      },
      data: {
        status: 'CANCELLED'
      }
    });

    return {
      success: true,
      message: 'Reservation canceled successfully'
    };
  } catch (error) {
    console.error('❌ OpenTable cancel error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to cancel reservation. Please call us directly.'
    };
  }
};

/**
 * Modify a reservation
 * @param {Number} businessId 
 * @param {String} reservationId 
 * @param {Object} updates - { date, time, partySize }
 */
export const modifyReservation = async (businessId, reservationId, updates) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, restaurantId } = credentials;

    console.log(`🔄 Modifying OpenTable reservation: ${reservationId}`);

    const response = await axios.put(
      `${OPENTABLE_API_BASE}/restaurants/${restaurantId}/reservations/${reservationId}`,
      updates,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ OpenTable reservation modified: ${reservationId}`);

    return {
      success: true,
      reservation: response.data,
      message: 'Reservation updated successfully'
    };
  } catch (error) {
    console.error('❌ OpenTable modify error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to modify reservation. Please call us directly.'
    };
  }
};

/**
 * Test OpenTable API connection
 */
export const testConnection = async (credentials) => {
  try {
    const { apiKey, restaurantId } = credentials;

    if (!apiKey || !restaurantId) {
      throw new Error('API Key and Restaurant ID are required');
    }

    // Test API call
    const response = await axios.get(
      `${OPENTABLE_API_BASE}/restaurants/${restaurantId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return {
      success: true,
      restaurant: response.data,
      message: 'OpenTable connection successful'
    };
  } catch (error) {
    console.error('❌ OpenTable test connection error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid API key');
    } else if (error.response?.status === 404) {
      throw new Error('Restaurant not found');
    } else {
      throw new Error('Connection failed: ' + (error.message || 'Unknown error'));
    }
  }
};

export default {
  hasIntegration,
  checkAvailability,
  createReservation,
  cancelReservation,
  modifyReservation,
  testConnection
};
