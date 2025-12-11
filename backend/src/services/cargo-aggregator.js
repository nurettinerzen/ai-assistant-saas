// ============================================================================
// CARGO AGGREGATOR SERVICE
// ============================================================================
// Tüm kargo servislerini birleştiren aggregator
// Business'ın bağlı olduğu kargo firmalarından takip yapar
// ============================================================================

import { PrismaClient } from '@prisma/client';
import yurticiKargo from './yurtici-kargo.js';
import arasKargo from './aras-kargo.js';
import mngKargo from './mng-kargo.js';

const prisma = new PrismaClient();

// Kargo servisleri mapping
const CARGO_SERVICES = {
  yurtici: {
    service: yurticiKargo,
    integrationType: 'YURTICI_KARGO',
    name: 'Yurtiçi Kargo',
    shortName: 'yurtici'
  },
  aras: {
    service: arasKargo,
    integrationType: 'ARAS_KARGO',
    name: 'Aras Kargo',
    shortName: 'aras'
  },
  mng: {
    service: mngKargo,
    integrationType: 'MNG_KARGO',
    name: 'MNG Kargo',
    shortName: 'mng'
  }
};

/**
 * Get list of connected cargo carriers for a business
 * @param {number} businessId - Business ID
 * @returns {Promise<Array>} Array of connected carriers
 */
async function getConnectedCarriers(businessId) {
  try {
    const integrations = await prisma.integration.findMany({
      where: {
        businessId,
        type: {
          in: ['YURTICI_KARGO', 'ARAS_KARGO', 'MNG_KARGO']
        },
        isActive: true
      }
    });

    const connectedCarriers = integrations.map(integration => {
      const carrierKey = Object.keys(CARGO_SERVICES).find(
        key => CARGO_SERVICES[key].integrationType === integration.type
      );

      if (carrierKey) {
        return {
          carrier: carrierKey,
          name: CARGO_SERVICES[carrierKey].name,
          type: integration.type,
          connectedAt: integration.createdAt
        };
      }
      return null;
    }).filter(Boolean);

    return connectedCarriers;
  } catch (error) {
    console.error('❌ getConnectedCarriers error:', error);
    return [];
  }
}

/**
 * Check if business has any cargo integration
 * @param {number} businessId - Business ID
 * @returns {Promise<boolean>} True if has any cargo integration
 */
async function hasCargoIntegration(businessId) {
  try {
    const count = await prisma.integration.count({
      where: {
        businessId,
        type: {
          in: ['YURTICI_KARGO', 'ARAS_KARGO', 'MNG_KARGO']
        },
        isActive: true
      }
    });

    return count > 0;
  } catch (error) {
    console.error('❌ hasCargoIntegration error:', error);
    return false;
  }
}

/**
 * Track shipment - main aggregator function
 * @param {number} businessId - Business ID
 * @param {string} trackingNumber - Tracking number
 * @param {string|null} carrier - Specific carrier (optional)
 * @returns {Promise<Object>} Tracking result
 */
async function trackShipment(businessId, trackingNumber, carrier = null) {
  try {
    console.log(`📦 Cargo Aggregator: Tracking ${trackingNumber}, carrier: ${carrier || 'auto'}`);

    // If specific carrier is provided
    if (carrier && CARGO_SERVICES[carrier.toLowerCase()]) {
      const cargoService = CARGO_SERVICES[carrier.toLowerCase()];

      // Check if this carrier is connected
      const integration = await prisma.integration.findFirst({
        where: {
          businessId,
          type: cargoService.integrationType,
          isActive: true
        }
      });

      if (!integration) {
        return {
          success: false,
          error: `${cargoService.name} entegrasyonu bağlı değil`,
          code: 'NO_INTEGRATION'
        };
      }

      // Track with specific carrier
      const result = await cargoService.service.trackShipment(businessId, trackingNumber);
      return result;
    }

    // No specific carrier - try all connected carriers
    const connectedCarriers = await getConnectedCarriers(businessId);

    if (connectedCarriers.length === 0) {
      return {
        success: false,
        error: 'Hiçbir kargo firması bağlı değil',
        code: 'NO_INTEGRATION'
      };
    }

    console.log(`📦 Trying ${connectedCarriers.length} connected carrier(s)`);

    // Try each connected carrier
    for (const connectedCarrier of connectedCarriers) {
      const cargoService = CARGO_SERVICES[connectedCarrier.carrier];

      if (!cargoService) continue;

      try {
        const result = await cargoService.service.trackShipment(businessId, trackingNumber);

        // If successful, return immediately
        if (result.success) {
          console.log(`✅ Found shipment with ${cargoService.name}`);
          return result;
        }

        // If not found, continue to next carrier
        if (result.code === 'NOT_FOUND') {
          console.log(`⚠️ Not found with ${cargoService.name}, trying next...`);
          continue;
        }

        // If API error, log but continue
        if (result.code === 'API_ERROR') {
          console.log(`⚠️ API error with ${cargoService.name}, trying next...`);
          continue;
        }
      } catch (error) {
        console.error(`❌ Error tracking with ${cargoService.name}:`, error.message);
        continue;
      }
    }

    // No carrier found the shipment
    return {
      success: false,
      error: 'Bu takip numarasıyla kargo bulunamadı',
      code: 'NOT_FOUND',
      triedCarriers: connectedCarriers.map(c => c.name)
    };
  } catch (error) {
    console.error('❌ Cargo Aggregator trackShipment error:', error);
    return {
      success: false,
      error: error.message || 'Kargo takip hatası',
      code: 'SYSTEM_ERROR'
    };
  }
}

/**
 * Connect a cargo carrier
 * @param {number} businessId - Business ID
 * @param {string} carrier - Carrier type (yurtici, aras, mng)
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} Connection result
 */
async function connectCarrier(businessId, carrier, credentials) {
  try {
    const cargoService = CARGO_SERVICES[carrier.toLowerCase()];

    if (!cargoService) {
      return {
        success: false,
        error: 'Geçersiz kargo firması'
      };
    }

    // Test connection first
    const testResult = await cargoService.service.testConnection(credentials);

    if (!testResult.success) {
      return {
        success: false,
        error: testResult.error || 'Bağlantı testi başarısız'
      };
    }

    // Save or update integration
    const integration = await prisma.integration.upsert({
      where: {
        businessId_type: {
          businessId,
          type: cargoService.integrationType
        }
      },
      update: {
        credentials,
        isActive: true,
        connected: true,
        updatedAt: new Date()
      },
      create: {
        businessId,
        type: cargoService.integrationType,
        credentials,
        isActive: true,
        connected: true
      }
    });

    console.log(`✅ ${cargoService.name} connected for business ${businessId}`);

    return {
      success: true,
      message: `${cargoService.name} başarıyla bağlandı`,
      integration: {
        id: integration.id,
        type: integration.type,
        isActive: integration.isActive
      }
    };
  } catch (error) {
    console.error('❌ connectCarrier error:', error);
    return {
      success: false,
      error: error.message || 'Bağlantı hatası'
    };
  }
}

/**
 * Disconnect a cargo carrier
 * @param {number} businessId - Business ID
 * @param {string} carrier - Carrier type
 * @returns {Promise<Object>} Disconnection result
 */
async function disconnectCarrier(businessId, carrier) {
  try {
    const cargoService = CARGO_SERVICES[carrier.toLowerCase()];

    if (!cargoService) {
      return {
        success: false,
        error: 'Geçersiz kargo firması'
      };
    }

    await prisma.integration.updateMany({
      where: {
        businessId,
        type: cargoService.integrationType
      },
      data: {
        isActive: false,
        connected: false,
        updatedAt: new Date()
      }
    });

    console.log(`✅ ${cargoService.name} disconnected for business ${businessId}`);

    return {
      success: true,
      message: `${cargoService.name} bağlantısı kesildi`
    };
  } catch (error) {
    console.error('❌ disconnectCarrier error:', error);
    return {
      success: false,
      error: error.message || 'Bağlantı kesme hatası'
    };
  }
}

/**
 * Test a cargo carrier connection
 * @param {number} businessId - Business ID
 * @param {string} carrier - Carrier type
 * @returns {Promise<Object>} Test result
 */
async function testCarrierConnection(businessId, carrier) {
  try {
    const cargoService = CARGO_SERVICES[carrier.toLowerCase()];

    if (!cargoService) {
      return {
        success: false,
        error: 'Geçersiz kargo firması'
      };
    }

    // Get credentials from database
    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: cargoService.integrationType,
        isActive: true
      }
    });

    if (!integration) {
      return {
        success: false,
        error: `${cargoService.name} bağlı değil`
      };
    }

    // Test connection
    const result = await cargoService.service.testConnection(integration.credentials);
    return result;
  } catch (error) {
    console.error('❌ testCarrierConnection error:', error);
    return {
      success: false,
      error: error.message || 'Bağlantı testi hatası'
    };
  }
}

/**
 * Format tracking result for AI response
 * @param {Object} trackingResult - Tracking result object
 * @returns {string} Formatted message for AI
 */
function formatTrackingForAI(trackingResult) {
  if (!trackingResult.success) {
    if (trackingResult.code === 'NO_INTEGRATION') {
      return 'Şu an kargo takip sistemine bağlantımız bulunmuyor. Lütfen doğrudan kargo firmasının web sitesinden takip edin.';
    }
    if (trackingResult.code === 'NOT_FOUND') {
      return 'Bu takip numarasıyla kargo bulunamadı. Lütfen takip numarasını kontrol edip tekrar söyleyin.';
    }
    return trackingResult.error || 'Kargo takip sorgusu başarısız oldu.';
  }

  const { carrierName, statusText, lastLocation, estimatedDelivery } = trackingResult;

  let message = `Kargonuz ${carrierName} ile gönderilmiş. `;
  message += `Şu anki durumu: ${statusText}. `;

  if (lastLocation && lastLocation !== 'Bilgi yok') {
    message += `Son konum: ${lastLocation}. `;
  }

  if (estimatedDelivery) {
    // Format date for Turkish locale
    const deliveryDate = new Date(estimatedDelivery);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (deliveryDate.toDateString() === today.toDateString()) {
      message += 'Tahmini teslimat: Bugün.';
    } else if (deliveryDate.toDateString() === tomorrow.toDateString()) {
      message += 'Tahmini teslimat: Yarın.';
    } else {
      const formattedDate = deliveryDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long'
      });
      message += `Tahmini teslimat: ${formattedDate}.`;
    }
  }

  return message;
}

export default {
  getConnectedCarriers,
  hasCargoIntegration,
  trackShipment,
  connectCarrier,
  disconnectCarrier,
  testCarrierConnection,
  formatTrackingForAI,
  CARGO_SERVICES
};
