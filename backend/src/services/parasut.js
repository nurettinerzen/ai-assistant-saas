/**
 * Paraşüt Muhasebe API Service
 * OAuth2 authentication + Invoice & Contact management
 *
 * API Docs: https://apidocs.parasut.com/
 * Base URL: https://api.parasut.com/v4/{company_id}/
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Paraşüt API endpoints
const PARASUT_AUTH_URL = 'https://api.parasut.com/oauth/authorize';
const PARASUT_TOKEN_URL = 'https://api.parasut.com/oauth/token';
const PARASUT_API_BASE = 'https://api.parasut.com/v4';

class ParasutService {
  /**
   * Generate OAuth authorization URL
   * @param {number} businessId - Business ID to encode in state
   * @returns {string} Authorization URL
   */
  getAuthUrl(businessId) {
    const clientId = process.env.PARASUT_CLIENT_ID;
    const redirectUri = process.env.PARASUT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error('Paraşüt client ID or redirect URI not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'public sales_invoices:read contacts:read accounts:read',
      state: Buffer.from(JSON.stringify({ businessId })).toString('base64')
    });

    return `${PARASUT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter (base64 encoded businessId)
   * @returns {Promise<Object>} Token response with business info
   */
  async handleCallback(code, state) {
    try {
      // Decode state to get businessId
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      const businessId = stateData.businessId;

      if (!businessId) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for tokens
      const tokenResponse = await axios.post(PARASUT_TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: process.env.PARASUT_CLIENT_ID,
        client_secret: process.env.PARASUT_CLIENT_SECRET,
        redirect_uri: process.env.PARASUT_REDIRECT_URI,
        code
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const tokens = tokenResponse.data;

      // Get company ID from user info
      const userInfo = await this.getUserInfo(tokens.access_token);
      const companyId = userInfo?.data?.attributes?.company_id;

      if (!companyId) {
        throw new Error('Could not retrieve company ID from Paraşüt');
      }

      // Calculate token expiration time
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Save credentials to database
      await prisma.integration.upsert({
        where: {
          businessId_type: {
            businessId,
            type: 'PARASUT'
          }
        },
        update: {
          credentials: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
            company_id: companyId
          },
          connected: true,
          isActive: true,
          lastSync: new Date()
        },
        create: {
          businessId,
          type: 'PARASUT',
          credentials: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
            company_id: companyId
          },
          connected: true,
          isActive: true
        }
      });

      return {
        success: true,
        businessId,
        companyId
      };
    } catch (error) {
      console.error('Paraşüt callback error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Paraşüt');
    }
  }

  /**
   * Get user info from Paraşüt API
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User info
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get('https://api.parasut.com/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get user info error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get valid access token for business (auto-refresh if expired)
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} { accessToken, companyId }
   */
  async getAccessToken(businessId) {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'PARASUT',
        isActive: true
      }
    });

    if (!integration) {
      throw new Error('Paraşüt integration not found');
    }

    const { access_token, refresh_token, expires_at, company_id } = integration.credentials;

    // Check if token is expired (with 5-minute buffer)
    const expiresAt = new Date(expires_at);
    const now = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    if (now >= expiresAt) {
      // Token is expired or about to expire, refresh it
      return await this.refreshToken(businessId, refresh_token, company_id);
    }

    return { accessToken: access_token, companyId: company_id };
  }

  /**
   * Refresh access token
   * @param {number} businessId - Business ID
   * @param {string} refreshToken - Refresh token
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} { accessToken, companyId }
   */
  async refreshToken(businessId, refreshToken, companyId) {
    try {
      const tokenResponse = await axios.post(PARASUT_TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: process.env.PARASUT_CLIENT_ID,
        client_secret: process.env.PARASUT_CLIENT_SECRET,
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const tokens = tokenResponse.data;
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Update credentials in database
      await prisma.integration.updateMany({
        where: {
          businessId,
          type: 'PARASUT'
        },
        data: {
          credentials: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || refreshToken,
            expires_at: expiresAt.toISOString(),
            company_id: companyId
          },
          lastSync: new Date()
        }
      });

      return {
        accessToken: tokens.access_token,
        companyId
      };
    } catch (error) {
      console.error('Token refresh error:', error.response?.data || error.message);

      // If refresh fails, mark integration as disconnected
      await prisma.integration.updateMany({
        where: {
          businessId,
          type: 'PARASUT'
        },
        data: {
          connected: false
        }
      });

      throw new Error('Failed to refresh Paraşüt token. Please reconnect.');
    }
  }

  /**
   * Make authenticated API request to Paraşüt
   * @param {number} businessId - Business ID
   * @param {string} endpoint - API endpoint (without company_id prefix)
   * @param {Object} options - Axios options
   * @returns {Promise<Object>} API response
   */
  async apiRequest(businessId, endpoint, options = {}) {
    const { accessToken, companyId } = await this.getAccessToken(businessId);

    const url = `${PARASUT_API_BASE}/${companyId}${endpoint}`;

    const response = await axios({
      url,
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    return response.data;
  }

  // ============================================================================
  // INVOICE FUNCTIONS
  // ============================================================================

  /**
   * Get all invoices with optional filters
   * @param {number} businessId - Business ID
   * @param {Object} filters - Filter options (status, start_date, end_date, page)
   * @returns {Promise<Object>} Invoices list
   */
  async getInvoices(businessId, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.status) params.append('filter[status]', filters.status);
      if (filters.start_date) params.append('filter[issue_date]', `>=${filters.start_date}`);
      if (filters.end_date) params.append('filter[issue_date]', `<=${filters.end_date}`);
      if (filters.page) params.append('page[number]', filters.page);
      params.append('page[size]', filters.limit || 25);
      params.append('include', 'contact');

      const endpoint = `/sales_invoices?${params.toString()}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      return {
        success: true,
        invoices: response.data?.map(invoice => this.formatInvoice(invoice, response.included)) || [],
        meta: response.meta
      };
    } catch (error) {
      console.error('Get invoices error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        invoices: []
      };
    }
  }

  /**
   * Get invoice by invoice number
   * @param {number} businessId - Business ID
   * @param {string} invoiceNumber - Invoice number (e.g., FTR-2025-001)
   * @returns {Promise<Object>} Invoice details
   */
  async getInvoiceByNumber(businessId, invoiceNumber) {
    try {
      const params = new URLSearchParams({
        'filter[invoice_no]': invoiceNumber,
        'include': 'contact,details'
      });

      const endpoint = `/sales_invoices?${params.toString()}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      if (!response.data || response.data.length === 0) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      return {
        success: true,
        invoice: this.formatInvoice(response.data[0], response.included)
      };
    } catch (error) {
      console.error('Get invoice by number error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get invoices by customer name
   * @param {number} businessId - Business ID
   * @param {string} customerName - Customer/company name
   * @returns {Promise<Object>} Invoices list
   */
  async getInvoicesByCustomer(businessId, customerName) {
    try {
      // First, find contact by name
      const contact = await this.getContactByName(businessId, customerName);

      if (!contact.success || !contact.contact) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }

      // Then get invoices for this contact
      const params = new URLSearchParams({
        'filter[contact_id]': contact.contact.id,
        'include': 'contact',
        'page[size]': 10
      });

      const endpoint = `/sales_invoices?${params.toString()}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      return {
        success: true,
        customerName: contact.contact.name,
        invoices: response.data?.map(invoice => this.formatInvoice(invoice, response.included)) || []
      };
    } catch (error) {
      console.error('Get invoices by customer error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        invoices: []
      };
    }
  }

  /**
   * Format invoice data to standard format
   * @param {Object} invoice - Raw invoice from Paraşüt
   * @param {Array} included - Included resources
   * @returns {Object} Formatted invoice
   */
  formatInvoice(invoice, included = []) {
    const attrs = invoice.attributes;

    // Find related contact
    const contactRel = invoice.relationships?.contact?.data;
    let customerName = 'Bilinmeyen';

    if (contactRel && included) {
      const contact = included.find(i => i.type === 'contacts' && i.id === contactRel.id);
      if (contact) {
        customerName = contact.attributes.name;
      }
    }

    // Map status to Turkish
    const statusMap = {
      draft: { status: 'draft', text: 'Taslak' },
      open: { status: 'open', text: 'Açık' },
      paid: { status: 'paid', text: 'Ödendi' },
      overdue: { status: 'overdue', text: 'Vadesi Geçmiş' },
      cancelled: { status: 'cancelled', text: 'İptal' }
    };

    const statusInfo = statusMap[attrs.status] || { status: attrs.status, text: attrs.status };

    return {
      id: invoice.id,
      number: attrs.invoice_no || `INV-${invoice.id}`,
      date: attrs.issue_date,
      dueDate: attrs.due_date,
      customerName,
      totalAmount: parseFloat(attrs.net_total) || 0,
      currency: attrs.currency || 'TRY',
      status: statusInfo.status,
      statusText: statusInfo.text,
      description: attrs.description || ''
    };
  }

  // ============================================================================
  // CONTACT (CARI) FUNCTIONS
  // ============================================================================

  /**
   * Get all contacts
   * @param {number} businessId - Business ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Contacts list
   */
  async getContacts(businessId, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.type) params.append('filter[account_type]', filters.type);
      if (filters.page) params.append('page[number]', filters.page);
      params.append('page[size]', filters.limit || 25);

      const endpoint = `/contacts?${params.toString()}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      return {
        success: true,
        contacts: response.data?.map(contact => this.formatContact(contact)) || [],
        meta: response.meta
      };
    } catch (error) {
      console.error('Get contacts error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Get contact by name (search)
   * @param {number} businessId - Business ID
   * @param {string} name - Contact name to search
   * @returns {Promise<Object>} Contact details
   */
  async getContactByName(businessId, name) {
    try {
      const params = new URLSearchParams({
        'filter[name]': name
      });

      const endpoint = `/contacts?${params.toString()}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      // Try exact match first
      let contact = response.data?.find(c =>
        c.attributes.name.toLowerCase() === name.toLowerCase()
      );

      // If no exact match, try partial match
      if (!contact && response.data?.length > 0) {
        contact = response.data[0];
      }

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found'
        };
      }

      return {
        success: true,
        contact: this.formatContact(contact)
      };
    } catch (error) {
      console.error('Get contact by name error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get contact balance
   * @param {number} businessId - Business ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object>} Balance details
   */
  async getContactBalance(businessId, contactId) {
    try {
      const endpoint = `/contacts/${contactId}`;
      const response = await this.apiRequest(businessId, endpoint, { method: 'GET' });

      const contact = response.data;
      const attrs = contact.attributes;

      const balance = parseFloat(attrs.balance) || 0;

      // Format balance text
      let balanceText = '';
      if (balance > 0) {
        balanceText = `${this.formatMoney(balance)} TL alacaklı (sizin alacağınız var)`;
      } else if (balance < 0) {
        balanceText = `${this.formatMoney(Math.abs(balance))} TL borçlu (ödemeniz gereken)`;
      } else {
        balanceText = 'Bakiye sıfır';
      }

      return {
        success: true,
        contact: {
          id: contact.id,
          name: attrs.name,
          balance: balance,
          balanceText: balanceText,
          lastTransaction: attrs.updated_at
        }
      };
    } catch (error) {
      console.error('Get contact balance error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format contact data
   * @param {Object} contact - Raw contact from Paraşüt
   * @returns {Object} Formatted contact
   */
  formatContact(contact) {
    const attrs = contact.attributes;

    return {
      id: contact.id,
      name: attrs.name,
      email: attrs.email,
      phone: attrs.phone,
      balance: parseFloat(attrs.balance) || 0,
      accountType: attrs.account_type,
      taxNumber: attrs.tax_number,
      taxOffice: attrs.tax_office
    };
  }

  /**
   * Disconnect Paraşüt integration
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Result
   */
  async disconnect(businessId) {
    try {
      await prisma.integration.updateMany({
        where: {
          businessId,
          type: 'PARASUT'
        },
        data: {
          connected: false,
          isActive: false,
          credentials: {}
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection status
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Status
   */
  async getStatus(businessId) {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'PARASUT'
      }
    });

    if (!integration) {
      return {
        connected: false,
        companyId: null
      };
    }

    return {
      connected: integration.connected && integration.isActive,
      companyId: integration.credentials?.company_id || null,
      lastSync: integration.lastSync
    };
  }

  /**
   * Format money amount
   * @param {number} amount - Amount
   * @returns {string} Formatted amount
   */
  formatMoney(amount) {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

export default new ParasutService();
