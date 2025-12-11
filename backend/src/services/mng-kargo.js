// ============================================================================
// MNG KARGO SERVICE
// ============================================================================
// MNG Kargo API entegrasyonu
// API Docs: https://www.mngkargo.com.tr/entegrasyon
// ============================================================================

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// API Base URL
const BASE_URL = process.env.MNG_API_URL || 'https://service.mngkargo.com.tr/';
const TIMEOUT = 10000; // 10 seconds

/**
 * Get MNG Kargo credentials from database
 * @param {number} businessId - Business ID
 * @returns {Promise<Object|null>} Credentials object or null
 */
async function getCredentials(businessId) {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'MNG_KARGO',
        isActive: true
      }
    });

    if (!integration || !integration.credentials) {
      return null;
    }

    return integration.credentials;
  } catch (error) {
    console.error('❌ MNG Kargo getCredentials error:', error);
    return null;
  }
}

/**
 * Test MNG Kargo connection
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} Test result
 */
async function testConnection(credentials) {
  try {
    const { apiKey, customerId } = credentials;

    if (!apiKey) {
      return {
        success: false,
        error: 'Missing required credentials: apiKey'
      };
    }

    // Test connection with a simple API call
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}api/v1/health`,
      timeout: TIMEOUT,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Customer-Id': customerId || '',
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return {
        success: true,
        message: 'MNG Kargo bağlantısı başarılı'
      };
    }

    return {
      success: false,
      error: 'Bağlantı doğrulanamadı'
    };
  } catch (error) {
    console.error('❌ MNG Kargo testConnection error:', error);

    // Handle specific error codes
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Geçersiz API anahtarı'
      };
    }

    return {
      success: false,
      error: error.message || 'Bağlantı testi başarısız'
    };
  }
}

/**
 * Track shipment by tracking number
 * @param {number} businessId - Business ID
 * @param {string} trackingNumber - Kargo takip numarası
 * @returns {Promise<Object>} Tracking result
 */
async function trackShipment(businessId, trackingNumber) {
  try {
    const credentials = await getCredentials(businessId);

    if (!credentials) {
      return {
        success: false,
        error: 'MNG Kargo entegrasyonu bulunamadı',
        code: 'NO_INTEGRATION'
      };
    }

    const { apiKey, customerId } = credentials;

    console.log(`📦 MNG Kargo takip sorgusu: ${trackingNumber}`);

    // REST API call for tracking
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}api/v1/tracking/${trackingNumber}`,
      timeout: TIMEOUT,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Customer-Id': customerId || '',
        'Content-Type': 'application/json'
      }
    });

    // Parse response
    const trackingData = parseMngResponse(response.data, trackingNumber);

    if (trackingData.success) {
      console.log(`✅ MNG Kargo takip başarılı: ${trackingNumber}`);
    } else {
      console.log(`⚠️ MNG Kargo takip başarısız: ${trackingNumber}`);
    }

    return trackingData;
  } catch (error) {
    console.error('❌ MNG Kargo trackShipment error:', error);

    // Handle specific error codes
    if (error.response?.status === 404) {
      return {
        success: false,
        carrier: 'mng',
        trackingNumber,
        error: 'Kargo bulunamadı',
        code: 'NOT_FOUND'
      };
    }

    return {
      success: false,
      carrier: 'mng',
      trackingNumber,
      error: error.message || 'Kargo takip sorgusu başarısız',
      code: 'API_ERROR'
    };
  }
}

/**
 * Parse MNG Kargo REST API response
 * @param {Object} data - API response data
 * @param {string} trackingNumber - Tracking number
 * @returns {Object} Parsed tracking data
 */
function parseMngResponse(data, trackingNumber) {
  try {
    // Check for error responses
    if (!data || data.error || data.status === 'error') {
      return {
        success: false,
        carrier: 'mng',
        trackingNumber,
        error: data?.message || 'Kargo bulunamadı',
        code: 'NOT_FOUND'
      };
    }

    // Map MNG status to standard status
    const statusMapping = {
      'TESLIM_EDILDI': { status: 'DELIVERED', text: 'Teslim edildi' },
      'DELIVERED': { status: 'DELIVERED', text: 'Teslim edildi' },
      'DAGITIMDA': { status: 'OUT_FOR_DELIVERY', text: 'Dağıtıma çıktı' },
      'OUT_FOR_DELIVERY': { status: 'OUT_FOR_DELIVERY', text: 'Dağıtıma çıktı' },
      'TRANSFERDE': { status: 'IN_TRANSIT', text: 'Transfer merkezinde' },
      'IN_TRANSIT': { status: 'IN_TRANSIT', text: 'Transfer merkezinde' },
      'KABUL_EDILDI': { status: 'PICKED_UP', text: 'Kargo teslim alındı' },
      'ACCEPTED': { status: 'PICKED_UP', text: 'Kargo teslim alındı' },
      'SUBEDE': { status: 'AT_BRANCH', text: 'Şubede bekliyor' },
      'AT_BRANCH': { status: 'AT_BRANCH', text: 'Şubede bekliyor' }
    };

    const rawStatus = data.status || data.currentStatus || '';
    const mapped = statusMapping[rawStatus.toUpperCase()] || {
      status: 'IN_TRANSIT',
      text: data.statusDescription || rawStatus || 'İşlemde'
    };

    // Parse history
    const history = (data.movements || data.history || []).map(movement => ({
      date: movement.date || movement.timestamp || new Date().toISOString(),
      status: movement.description || movement.status || 'Hareket',
      location: movement.location || movement.branch || ''
    }));

    return {
      success: true,
      carrier: 'mng',
      carrierName: 'MNG Kargo',
      trackingNumber,
      status: mapped.status,
      statusText: mapped.text,
      lastLocation: data.currentLocation || data.lastBranch || 'Bilgi yok',
      lastUpdate: data.lastUpdate || new Date().toISOString(),
      estimatedDelivery: data.estimatedDelivery || data.expectedDeliveryDate || null,
      history
    };
  } catch (error) {
    console.error('❌ MNG Kargo parseResponse error:', error);
    return {
      success: false,
      carrier: 'mng',
      trackingNumber,
      error: 'Yanıt ayrıştırma hatası',
      code: 'PARSE_ERROR'
    };
  }
}

/**
 * Get shipment history
 * @param {number} businessId - Business ID
 * @param {string} trackingNumber - Tracking number
 * @returns {Promise<Object>} History result
 */
async function getShipmentHistory(businessId, trackingNumber) {
  return trackShipment(businessId, trackingNumber);
}

export default {
  getCredentials,
  testConnection,
  trackShipment,
  getShipmentHistory
};
