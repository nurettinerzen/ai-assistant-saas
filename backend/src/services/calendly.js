/**
 * Calendly Integration Service
 * OAuth 2.0 + Booking Management
 */

import axios from 'axios';

const CALENDLY_API_URL = 'https://api.calendly.com';
const CALENDLY_AUTH_URL = 'https://auth.calendly.com/oauth/authorize';
const CALENDLY_TOKEN_URL = 'https://auth.calendly.com/oauth/token';

class CalendlyService {
  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(clientId, redirectUri, state) {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state
    });
    return `${CALENDLY_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code, clientId, clientSecret, redirectUri) {
    try {
      const response = await axios.post(CALENDLY_TOKEN_URL, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Calendly token error:', error.response?.data);
      throw new Error('Failed to get Calendly access token');
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(accessToken) {
    try {
      const response = await axios.get(`${CALENDLY_API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      return response.data.resource;
    } catch (error) {
      console.error('Calendly user error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableSlots(accessToken, eventTypeUri, startTime, endTime) {
    try {
      const response = await axios.get(`${CALENDLY_API_URL}/event_type_available_times`, {
        params: {
          event_type: eventTypeUri,
          start_time: startTime,
          end_time: endTime
        },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      return response.data.collection;
    } catch (error) {
      console.error('Calendly slots error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Schedule an event
   */
  async scheduleEvent(accessToken, eventTypeUri, inviteeInfo) {
    try {
      const response = await axios.post(
        `${CALENDLY_API_URL}/scheduling_links`,
        {
          event_type: eventTypeUri,
          invitee: inviteeInfo
        },
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.resource;
    } catch (error) {
      console.error('Calendly schedule error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Cancel an event
   */
  async cancelEvent(accessToken, eventUri, reason) {
    try {
      await axios.post(
        `${CALENDLY_API_URL}/scheduled_events/${eventUri}/cancellation`,
        { reason },
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Calendly cancel error:', error.response?.data);
      throw error;
    }
  }
}

export default new CalendlyService();
