/**
 * Google Calendar Integration Service
 * OAuth 2.0 + Event Management
 */

import { google } from 'googleapis';

class GoogleCalendarService {
  /**
   * Create OAuth2 client
   */
  createOAuth2Client(clientId, clientSecret, redirectUri) {
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(oauth2Client) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(oauth2Client, code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Google Calendar token error:', error);
      throw new Error('Failed to get Google Calendar tokens');
    }
  }

  /**
   * List calendars
   */
  async listCalendars(accessToken, refreshToken, clientId, clientSecret) {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const response = await calendar.calendarList.list();
      return response.data.items;
    } catch (error) {
      console.error('List calendars error:', error);
      throw error;
    }
  }

  /**
   * Get events from calendar
   */
  async getEvents(accessToken, refreshToken, clientId, clientSecret, calendarId = 'primary', timeMin, timeMax) {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });
      return response.data.items;
    } catch (error) {
      console.error('Get events error:', error);
      throw error;
    }
  }

  /**
   * Create event
   */
  async createEvent(accessToken, refreshToken, clientId, clientSecret, eventData, calendarId = 'primary') {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const response = await calendar.events.insert({
        calendarId,
        resource: eventData
      });
      return response.data;
    } catch (error) {
      console.error('Create event error:', error);
      throw error;
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(accessToken, refreshToken, clientId, clientSecret, eventId, calendarId = 'primary') {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.events.delete({ calendarId, eventId });
      return { success: true };
    } catch (error) {
      console.error('Delete event error:', error);
      throw error;
    }
  }
}

export default new GoogleCalendarService();
