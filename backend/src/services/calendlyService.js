// ============================================================================
// CALENDLY INTEGRATION SERVICE
// ============================================================================
// FILE: backend/src/services/calendlyService.js
//
// Handles appointment scheduling via Calendly API
// ============================================================================

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CALENDLY_API_BASE = 'https://api.calendly.com';

/**
 * Check if business has Calendly integration
 */
export const hasIntegration = async (businessId) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'CALENDLY',
        isActive: true
      }
    });
    return !!integration;
  } catch (error) {
    return false;
  }
};

/**
 * Get Calendly credentials
 */
const getCredentials = async (businessId) => {
  const integration = await prisma.integration.findFirst({
    where: {
      businessId,
      type: 'CALENDLY',
      isActive: true
    }
  });

  if (!integration) {
    throw new Error('Calendly integration not configured');
  }

  return integration.credentials;
};

/**
 * Get user's event types
 */
export const getEventTypes = async (businessId) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey } = credentials;

    const response = await axios.get(
      `${CALENDLY_API_BASE}/event_types`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      eventTypes: response.data.collection || []
    };
  } catch (error) {
    console.error('❌ Calendly event types error:', error.response?.data || error.message);
    return {
      success: false,
      error: true,
      eventTypes: []
    };
  }
};

/**
 * Check availability for a specific event type
 */
export const checkAvailability = async (businessId, params) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, eventTypeId } = credentials;
    const { date } = params;

    const formattedDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    console.log(`🔍 Checking Calendly availability for ${formattedDate}`);

    const response = await axios.get(
      `${CALENDLY_API_BASE}/event_type_available_times`,
      {
        params: {
          event_type: eventTypeId,
          start_time: `${formattedDate}T00:00:00Z`,
          end_time: `${formattedDate}T23:59:59Z`
        },
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const availableTimes = response.data.collection || [];

    console.log(`✅ Calendly found ${availableTimes.length} available slots`);

    return {
      available: availableTimes.length > 0,
      slots: availableTimes.map(slot => ({
        time: new Date(slot.start_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        startTime: slot.start_time,
        endTime: slot.end_time
      })),
      message: availableTimes.length > 0
        ? `We have ${availableTimes.length} available time slots on ${formattedDate}`
        : `No availability on ${formattedDate}`
    };
  } catch (error) {
    console.error('❌ Calendly availability error:', error.response?.data || error.message);
    
    return {
      available: false,
      error: true,
      message: 'Unable to check availability'
    };
  }
};

/**
 * Create a scheduled event (book appointment)
 */
export const createBooking = async (businessId, bookingData) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey, eventTypeId } = credentials;
    const { startTime, customerName, customerEmail, customerPhone, notes } = bookingData;

    console.log(`📝 Creating Calendly booking for ${customerName}`);

    // Create invitee for the event
    const response = await axios.post(
      `${CALENDLY_API_BASE}/scheduled_events`,
      {
        event_type: eventTypeId,
        start_time: startTime,
        invitee: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          questions_and_answers: notes ? [{
            question: 'Additional Notes',
            answer: notes
          }] : []
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const event = response.data.resource;

    console.log(`✅ Calendly booking created: ${event.uri}`);

    // Store in our database
    await prisma.appointment.create({
      data: {
        businessId,
        customerName,
        customerPhone,
        customerEmail,
        appointmentDate: new Date(startTime),
        duration: 30, // Default
        serviceType: 'Calendly Appointment',
        notes: `Calendly Event: ${event.uri}\n${notes || ''}`,
        status: 'CONFIRMED'
      }
    });

    return {
      success: true,
      eventUri: event.uri,
      joinUrl: event.location?.join_url || null,
      message: `Appointment scheduled successfully. You'll receive a confirmation email shortly.`
    };
  } catch (error) {
    console.error('❌ Calendly booking error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to schedule appointment. Please try again.'
    };
  }
};

/**
 * Cancel a scheduled event
 */
export const cancelBooking = async (businessId, eventUri) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey } = credentials;

    console.log(`❌ Canceling Calendly event: ${eventUri}`);

    await axios.post(
      `${CALENDLY_API_BASE}/scheduled_events/${eventUri}/cancellation`,
      {
        reason: 'Canceled by customer'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Calendly event canceled`);

    // Update in our database
    await prisma.appointment.updateMany({
      where: {
        businessId,
        notes: { contains: eventUri }
      },
      data: {
        status: 'CANCELLED'
      }
    });

    return {
      success: true,
      message: 'Appointment canceled successfully'
    };
  } catch (error) {
    console.error('❌ Calendly cancel error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to cancel appointment'
    };
  }
};

/**
 * Reschedule an event
 */
export const rescheduleBooking = async (businessId, eventUri, newStartTime) => {
  try {
    const credentials = await getCredentials(businessId);
    const { apiKey } = credentials;

    console.log(`🔄 Rescheduling Calendly event: ${eventUri}`);

    const response = await axios.post(
      `${CALENDLY_API_BASE}/scheduled_events/${eventUri}/reschedule`,
      {
        start_time: newStartTime
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Calendly event rescheduled`);

    return {
      success: true,
      event: response.data.resource,
      message: 'Appointment rescheduled successfully'
    };
  } catch (error) {
    console.error('❌ Calendly reschedule error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: true,
      message: 'Unable to reschedule appointment'
    };
  }
};

/**
 * Test Calendly API connection
 */
export const testConnection = async (credentials) => {
  try {
    const { apiKey } = credentials;

    if (!apiKey) {
      throw new Error('API Key is required');
    }

    // Test by getting user info
    const response = await axios.get(
      `${CALENDLY_API_BASE}/users/me`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return {
      success: true,
      user: response.data.resource,
      message: 'Calendly connection successful'
    };
  } catch (error) {
    console.error('❌ Calendly test connection error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid API key');
    } else {
      throw new Error('Connection failed: ' + (error.message || 'Unknown error'));
    }
  }
};

export default {
  hasIntegration,
  getEventTypes,
  checkAvailability,
  createBooking,
  cancelBooking,
  rescheduleBooking,
  testConnection
};
