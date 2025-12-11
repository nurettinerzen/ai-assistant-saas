// ============================================================================
// YURTICI KARGO SERVICE
// ============================================================================
// Yurtiçi Kargo API entegrasyonu
// API Docs: https://www.yurticikargo.com/tr/kurumsal/entegrasyon
// ============================================================================

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// API Base URL
const BASE_URL = process.env.YURTICI_API_URL || 'https://webservices.yurticikargo.com/';
const TIMEOUT = 10000; // 10 seconds

/**
 * Get Yurtiçi Kargo credentials from database
 * @param {number} businessId - Business ID
 * @returns {Promise<Object|null>} Credentials object or null
 */
async function getCredentials(businessId) {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'YURTICI_KARGO',
        isActive: true
      }
    });

    if (!integration || !integration.credentials) {
      return null;
    }

    return integration.credentials;
  } catch (error) {
    console.error('❌ Yurtiçi Kargo getCredentials error:', error);
    return null;
  }
}

/**
 * Test Yurtiçi Kargo connection
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} Test result
 */
async function testConnection(credentials) {
  try {
    const { customerCode, username, password } = credentials;

    if (!customerCode || !username || !password) {
      return {
        success: false,
        error: 'Missing required credentials: customerCode, username, password'
      };
    }

    // Try to make a simple API call to verify credentials
    // Yurtiçi Kargo typically has a status check endpoint
    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}KargoTakipServis/KargoTakip.asmx`,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://yurticikargo.com.tr/KargoTakipTest'
      },
      data: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <TestLogin xmlns="http://yurticikargo.com.tr">
      <MusteriKodu>${customerCode}</MusteriKodu>
      <KullaniciAdi>${username}</KullaniciAdi>
      <Sifre>${password}</Sifre>
    </TestLogin>
  </soap:Body>
</soap:Envelope>`
    });

    // Check if response indicates success
    if (response.status === 200) {
      return {
        success: true,
        message: 'Yurtiçi Kargo bağlantısı başarılı'
      };
    }

    return {
      success: false,
      error: 'Bağlantı doğrulanamadı'
    };
  } catch (error) {
    console.error('❌ Yurtiçi Kargo testConnection error:', error);

    // If it's a SOAP fault, try to parse the error
    if (error.response?.data) {
      const errorData = error.response.data;
      if (errorData.includes('Fault') || errorData.includes('Error')) {
        return {
          success: false,
          error: 'Geçersiz kimlik bilgileri'
        };
      }
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
        error: 'Yurtiçi Kargo entegrasyonu bulunamadı',
        code: 'NO_INTEGRATION'
      };
    }

    const { customerCode, username, password } = credentials;

    console.log(`📦 Yurtiçi Kargo takip sorgusu: ${trackingNumber}`);

    // SOAP request for tracking
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <QueryShipment xmlns="http://yurticikargo.com.tr">
      <MusteriKodu>${customerCode}</MusteriKodu>
      <KullaniciAdi>${username}</KullaniciAdi>
      <Sifre>${password}</Sifre>
      <KargoNo>${trackingNumber}</KargoNo>
    </QueryShipment>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}KargoTakipServis/KargoTakip.asmx`,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://yurticikargo.com.tr/QueryShipment'
      },
      data: soapRequest
    });

    // Parse SOAP response
    const trackingData = parseYurticiResponse(response.data, trackingNumber);

    if (trackingData.success) {
      console.log(`✅ Yurtiçi Kargo takip başarılı: ${trackingNumber}`);
    } else {
      console.log(`⚠️ Yurtiçi Kargo takip başarısız: ${trackingNumber}`);
    }

    return trackingData;
  } catch (error) {
    console.error('❌ Yurtiçi Kargo trackShipment error:', error);

    return {
      success: false,
      carrier: 'yurtici',
      trackingNumber,
      error: error.message || 'Kargo takip sorgusu başarısız',
      code: 'API_ERROR'
    };
  }
}

/**
 * Parse Yurtiçi Kargo SOAP response
 * @param {string} xmlData - SOAP response XML
 * @param {string} trackingNumber - Tracking number
 * @returns {Object} Parsed tracking data
 */
function parseYurticiResponse(xmlData, trackingNumber) {
  try {
    // Extract status info from XML (simplified parsing)
    // In production, use a proper XML parser like xml2js

    // Check for error responses
    if (xmlData.includes('<Hata>') || xmlData.includes('Bulunamadı') || xmlData.includes('not found')) {
      return {
        success: false,
        carrier: 'yurtici',
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
    const statusMatch = xmlData.match(/<Durum>([^<]+)<\/Durum>/);
    if (statusMatch) {
      const rawStatus = statusMatch[1];
      const statusMapping = {
        'Teslim Edildi': { status: 'DELIVERED', text: 'Teslim edildi' },
        'Dağıtımda': { status: 'OUT_FOR_DELIVERY', text: 'Dağıtıma çıktı' },
        'Transfer Merkezinde': { status: 'IN_TRANSIT', text: 'Transfer merkezinde' },
        'Kargo Kabul': { status: 'PICKED_UP', text: 'Kargo teslim alındı' },
        'Şubede': { status: 'AT_BRANCH', text: 'Şubede bekliyor' }
      };

      const mapped = statusMapping[rawStatus] || { status: 'IN_TRANSIT', text: rawStatus };
      status = mapped.status;
      statusText = mapped.text;
    }

    // Parse location
    const locationMatch = xmlData.match(/<Konum>([^<]+)<\/Konum>/);
    if (locationMatch) {
      lastLocation = locationMatch[1];
    }

    // Parse estimated delivery
    const deliveryMatch = xmlData.match(/<TahminiTeslim>([^<]+)<\/TahminiTeslim>/);
    if (deliveryMatch) {
      estimatedDelivery = deliveryMatch[1];
    }

    // Parse history
    const history = parseYurticiHistory(xmlData);

    return {
      success: true,
      carrier: 'yurtici',
      carrierName: 'Yurtiçi Kargo',
      trackingNumber,
      status,
      statusText,
      lastLocation: lastLocation || 'Bilgi yok',
      lastUpdate: new Date().toISOString(),
      estimatedDelivery,
      history
    };
  } catch (error) {
    console.error('❌ Yurtiçi Kargo parseResponse error:', error);
    return {
      success: false,
      carrier: 'yurtici',
      trackingNumber,
      error: 'Yanıt ayrıştırma hatası',
      code: 'PARSE_ERROR'
    };
  }
}

/**
 * Parse shipment history from Yurtiçi response
 * @param {string} xmlData - XML response data
 * @returns {Array} History array
 */
function parseYurticiHistory(xmlData) {
  const history = [];

  try {
    // Extract movement records
    const movementRegex = /<Hareket>([\s\S]*?)<\/Hareket>/g;
    let match;

    while ((match = movementRegex.exec(xmlData)) !== null) {
      const movement = match[1];

      const dateMatch = movement.match(/<Tarih>([^<]+)<\/Tarih>/);
      const statusMatch = movement.match(/<Aciklama>([^<]+)<\/Aciklama>/);
      const locationMatch = movement.match(/<Birim>([^<]+)<\/Birim>/);

      if (dateMatch || statusMatch) {
        history.push({
          date: dateMatch ? dateMatch[1] : new Date().toISOString(),
          status: statusMatch ? statusMatch[1] : 'Hareket',
          location: locationMatch ? locationMatch[1] : ''
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Yurtiçi history:', error);
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
  // History is included in trackShipment response
  return trackShipment(businessId, trackingNumber);
}

export default {
  getCredentials,
  testConnection,
  trackShipment,
  getShipmentHistory
};
