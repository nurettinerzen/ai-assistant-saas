/**
 * HubSpot CRM Integration Service
 * OAuth 2.0 + Contact/Deal Management
 */

import axios from 'axios';

const HUBSPOT_API_URL = 'https://api.hubapi.com';
const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

class HubSpotService {
  /**
   * Get OAuth authorization URL with PKCE support
   * @param {string} codeChallenge - PKCE code challenge (optional)
   */
  getAuthUrl(clientId, redirectUri, scopes, state, codeChallenge = null) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: state
    });

    // Add PKCE parameters if provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token with PKCE support
   * @param {string} codeVerifier - PKCE code verifier (optional)
   */
  async getAccessToken(code, clientId, clientSecret, redirectUri, codeVerifier = null) {
    try {
      const tokenPayload = {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      };

      // Add PKCE verifier if provided
      if (codeVerifier) {
        tokenPayload.code_verifier = codeVerifier;
      }

      const response = await axios.post(HUBSPOT_TOKEN_URL, tokenPayload);

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('HubSpot token error:', error.response?.data);
      throw new Error('Failed to get HubSpot access token');
    }
  }

  /**
   * Create or update contact
   */
  async createOrUpdateContact(accessToken, contactData) {
    try {
      const response = await axios.post(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts`,
        { properties: contactData },
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('HubSpot create contact error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(accessToken, email) {
    try {
      const response = await axios.get(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${email}?idProperty=email`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create deal
   */
  async createDeal(accessToken, dealData) {
    try {
      const response = await axios.post(
        `${HUBSPOT_API_URL}/crm/v3/objects/deals`,
        { properties: dealData },
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('HubSpot create deal error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Add note to contact
   */
  async addNote(accessToken, contactId, noteText) {
    try {
      const response = await axios.post(
        `${HUBSPOT_API_URL}/crm/v3/objects/notes`,
        {
          properties: {
            hs_note_body: noteText,
            hs_timestamp: new Date().toISOString()
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 202
                }
              ]
            }
          ]
        },
        {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('HubSpot add note error:', error.response?.data);
      throw error;
    }
  }
}

export default new HubSpotService();
