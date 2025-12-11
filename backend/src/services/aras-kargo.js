// ============================================================================
// ARAS KARGO SERVICE
// ============================================================================
// Aras Kargo API entegrasyonu
// API Docs: https://www.araskargo.com.tr/kurumsal/entegrasyon
// ============================================================================

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// API Base URL
const BASE_URL = process.env.ARAS_API_URL || 'https://customerservices.araskargo.com.tr/ArasCargoCustomerIntegrationService/';
const TIMEOUT = 10000; // 10 seconds

/**
 * Get Aras Kargo credentials from database
 * @param {number} businessId - Business ID
 * @returns {Promise<Object|null>} Credentials object or null
 */
async function getCredentials(businessId) {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'ARAS_KARGO',
        isActive: true
      }
    });

    if (!integration || !integration.credentials) {
      return null;
    }

    return integration.credentials;
  } catch (error) {
    console.error('❌ Aras Kargo getCredentials error:', error);
    return null;
  }
}

/**
 * Test Aras Kargo connection
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} Test result
 */
async function testConnection(credentials) {
  try {
    const { username, password, customerCode } = credentials;

    if (!username || !password || !customerCode) {
      return {
        success: false,
        error: 'Missing required credentials: username, password, customerCode'
      };
    }

    // SOAP request for connection test
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Login xmlns="http://aras.com.tr/">
      <userName>${username}</userName>
      <password>${password}</password>
      <customerCode>${customerCode}</customerCode>
    </Login>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}ArasCargoService.svc`,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://aras.com.tr/Login'
      },
      data: soapRequest
    });

    if (response.status === 200 && !response.data.includes('Fault')) {
      return {
        success: true,
        message: 'Aras Kargo bağlantısı başarılı'
      };
    }

    return {
      success: false,
      error: 'Bağlantı doğrulanamadı'
    };
  } catch (error) {
    console.error('❌ Aras Kargo testConnection error:', error);

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
        error: 'Aras Kargo entegrasyonu bulunamadı',
        code: 'NO_INTEGRATION'
      };
    }

    const { username, password, customerCode } = credentials;

    console.log(`📦 Aras Kargo takip sorgusu: ${trackingNumber}`);

    // SOAP request for tracking
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCargoInfo xmlns="http://aras.com.tr/">
      <userName>${username}</userName>
      <password>${password}</password>
      <customerCode>${customerCode}</customerCode>
      <integrationCode>${trackingNumber}</integrationCode>
      <queryType>1</queryType>
    </GetCargoInfo>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}ArasCargoService.svc`,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://aras.com.tr/GetCargoInfo'
      },
      data: soapRequest
    });

    // Parse SOAP response
    const trackingData = parseArasResponse(response.data, trackingNumber);

    if (trackingData.success) {
      console.log(`✅ Aras Kargo takip başarılı: ${trackingNumber}`);
    } else {
      console.log(`⚠️ Aras Kargo takip başarısız: ${trackingNumber}`);
    }

    return trackingData;
  } catch (error) {
    console.error('❌ Aras Kargo trackShipment error:', error);

    return {
      success: false,
      carrier: 'aras',
      trackingNumber,
      error: error.message || 'Kargo takip sorgusu başarısız',
      code: 'API_ERROR'
    };
  }
}

/**
 * Parse Aras Kargo SOAP response
 * @param {string} xmlData - SOAP response XML
 * @param {string} trackingNumber - Tracking number
 * @returns {Object} Parsed tracking data
 */
function parseArasResponse(xmlData, trackingNumber) {
  try {
    // Check for error responses
    if (xmlData.includes('<Fault>') || xmlData.includes('Bulunamadı') || xmlData.includes('HATA')) {
      return {
        success: false,
        carrier: 'aras',
        trackingNumber,
        error: 'Kargo bulunamadı',
        code: 'NOT_FOUND'
      };
    }

    // Extract status
    let status = 'UNKNOWN';
    let statusText = '';
    let lastLocation = '';
    let estimatedDelivery = null;

    // Parse status from XML
    const statusMatch = xmlData.match(/<DURUM_ACIKLAMA>([^<]+)<\/DURUM_ACIKLAMA>/);
    if (statusMatch) {
      const rawStatus = statusMatch[1];
      const statusMapping = {
        'TESLİM EDİLDİ': { status: 'DELIVERED', text: 'Teslim edildi' },
        'DAĞITIMDA': { status: 'OUT_FOR_DELIVERY', text: 'Dağıtıma çıktı' },
        'TRANSFER': { status: 'IN_TRANSIT', text: 'Transfer merkezinde' },
        'KABUL': { status: 'PICKED_UP', text: 'Kargo teslim alındı' },
        'ŞUBEDE': { status: 'AT_BRANCH', text: 'Şubede bekliyor' },
        'YOLDA': { status: 'IN_TRANSIT', text: 'Yolda' }
      };

      // Find matching status
      let mapped = { status: 'IN_TRANSIT', text: rawStatus };
      for (const [key, value] of Object.entries(statusMapping)) {
        if (rawStatus.toUpperCase().includes(key)) {
          mapped = value;
          break;
        }
      }
      status = mapped.status;
      statusText = mapped.text;
    }

    // Parse location
    const locationMatch = xmlData.match(/<SUBE_ADI>([^<]+)<\/SUBE_ADI>/);
    if (locationMatch) {
      lastLocation = locationMatch[1];
    }

    // Parse estimated delivery
    const deliveryMatch = xmlData.match(/<TAHMINI_TESLIMAT>([^<]+)<\/TAHMINI_TESLIMAT>/);
    if (deliveryMatch) {
      estimatedDelivery = deliveryMatch[1];
    }

    // Parse history
    const history = parseArasHistory(xmlData);

    return {
      success: true,
      carrier: 'aras',
      carrierName: 'Aras Kargo',
      trackingNumber,
      status,
      statusText,
      lastLocation: lastLocation || 'Bilgi yok',
      lastUpdate: new Date().toISOString(),
      estimatedDelivery,
      history
    };
  } catch (error) {
    console.error('❌ Aras Kargo parseResponse error:', error);
    return {
      success: false,
      carrier: 'aras',
      trackingNumber,
      error: 'Yanıt ayrıştırma hatası',
      code: 'PARSE_ERROR'
    };
  }
}

/**
 * Parse shipment history from Aras response
 * @param {string} xmlData - XML response data
 * @returns {Array} History array
 */
function parseArasHistory(xmlData) {
  const history = [];

  try {
    // Extract movement records
    const movementRegex = /<HAREKET>([\s\S]*?)<\/HAREKET>/g;
    let match;

    while ((match = movementRegex.exec(xmlData)) !== null) {
      const movement = match[1];

      const dateMatch = movement.match(/<TARIH>([^<]+)<\/TARIH>/);
      const statusMatch = movement.match(/<ISLEM>([^<]+)<\/ISLEM>/);
      const locationMatch = movement.match(/<BIRIM>([^<]+)<\/BIRIM>/);

      if (dateMatch || statusMatch) {
        history.push({
          date: dateMatch ? dateMatch[1] : new Date().toISOString(),
          status: statusMatch ? statusMatch[1] : 'Hareket',
          location: locationMatch ? locationMatch[1] : ''
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Aras history:', error);
  }

  return history;
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
