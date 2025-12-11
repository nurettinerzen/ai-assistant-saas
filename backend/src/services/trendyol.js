/**
 * Trendyol Marketplace API Service
 * Handles integration with Trendyol Seller API for order management and stock queries
 *
 * API Docs: https://developers.trendyol.com/
 * Base URL: https://api.trendyol.com/sapigw/
 * Auth: Basic Auth (API Key + API Secret, base64 encoded)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRENDYOL_BASE_URL = 'https://api.trendyol.com/sapigw';

class TrendyolService {
  /**
   * Get Trendyol credentials for a business
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Credentials object with supplierId, apiKey, apiSecret
   */
  async getCredentials(businessId) {
    try {
      const integration = await prisma.integration.findUnique({
        where: {
          businessId_type: {
            businessId,
            type: 'TRENDYOL'
          }
        }
      });

      if (!integration || !integration.isActive) {
        throw new Error('Trendyol integration not found or inactive');
      }

      const credentials = integration.credentials;

      if (!credentials.supplierId || !credentials.apiKey || !credentials.apiSecret) {
        throw new Error('Incomplete Trendyol credentials');
      }

      return credentials;
    } catch (error) {
      console.error('❌ Trendyol getCredentials error:', error);
      throw error;
    }
  }

  /**
   * Create Basic Auth header for Trendyol API
   * @param {string} apiKey - API Key
   * @param {string} apiSecret - API Secret
   * @returns {string} Base64 encoded auth string
   */
  createAuthHeader(apiKey, apiSecret) {
    const authString = `${apiKey}:${apiSecret}`;
    return Buffer.from(authString).toString('base64');
  }

  /**
   * Make an authenticated request to Trendyol API
   * @param {Object} credentials - API credentials
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {string} method - HTTP method (GET, POST, PUT, etc.)
   * @param {Object} body - Request body for POST/PUT
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(credentials, endpoint, method = 'GET', body = null) {
    const { supplierId, apiKey, apiSecret } = credentials;
    const url = `${TRENDYOL_BASE_URL}/suppliers/${supplierId}${endpoint}`;

    const options = {
      method,
      headers: {
        'Authorization': `Basic ${this.createAuthHeader(apiKey, apiSecret)}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Telyx.ai-Integration/1.0'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    console.log(`📦 Trendyol API Request: ${method} ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Trendyol API Error: ${response.status} - ${errorText}`);
      throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Get orders list with optional filters
   * @param {number} businessId - Business ID
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Order status (Created, Picking, Invoiced, Shipped, Delivered, etc.)
   * @param {string} filters.startDate - Start date (Unix timestamp in milliseconds)
   * @param {string} filters.endDate - End date (Unix timestamp in milliseconds)
   * @param {number} filters.page - Page number (default 0)
   * @param {number} filters.size - Page size (default 50, max 200)
   * @returns {Promise<Object>} Orders list
   */
  async getOrders(businessId, filters = {}) {
    try {
      const credentials = await this.getCredentials(businessId);

      // Build query parameters
      const params = new URLSearchParams();

      if (filters.status) {
        params.append('status', filters.status);
      }

      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }

      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      params.append('page', filters.page || 0);
      params.append('size', Math.min(filters.size || 50, 200));

      // Default to last 30 days if no date range specified
      if (!filters.startDate && !filters.endDate) {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        params.append('startDate', thirtyDaysAgo);
        params.append('endDate', Date.now());
      }

      const queryString = params.toString();
      const endpoint = `/orders?${queryString}`;

      const response = await this.makeRequest(credentials, endpoint);

      console.log(`✅ Trendyol: Retrieved ${response.content?.length || 0} orders`);

      return {
        orders: response.content || [],
        totalElements: response.totalElements || 0,
        totalPages: response.totalPages || 0,
        page: response.page || 0,
        size: response.size || 50
      };
    } catch (error) {
      console.error('❌ Trendyol getOrders error:', error);
      throw error;
    }
  }

  /**
   * Get a single order by order number
   * @param {number} businessId - Business ID
   * @param {string} orderNumber - Trendyol order number
   * @returns {Promise<Object|null>} Order details or null if not found
   */
  async getOrderByNumber(businessId, orderNumber) {
    try {
      const credentials = await this.getCredentials(businessId);

      // Trendyol API uses orderNumber filter
      const params = new URLSearchParams();
      params.append('orderNumber', orderNumber);

      const endpoint = `/orders?${params.toString()}`;
      const response = await this.makeRequest(credentials, endpoint);

      if (response.content && response.content.length > 0) {
        const order = response.content[0];
        console.log(`✅ Trendyol: Found order ${orderNumber}`);
        return this.formatOrderDetails(order);
      }

      console.log(`⚠️ Trendyol: Order ${orderNumber} not found`);
      return null;
    } catch (error) {
      console.error('❌ Trendyol getOrderByNumber error:', error);
      throw error;
    }
  }

  /**
   * Find orders by customer phone number
   * @param {number} businessId - Business ID
   * @param {string} phone - Customer phone number
   * @returns {Promise<Array>} Array of orders for this customer
   */
  async getOrdersByCustomerPhone(businessId, phone) {
    try {
      // Normalize phone number (remove +, spaces, dashes)
      const normalizedPhone = phone.replace(/[\s\-\+]/g, '');

      // Get recent orders and filter by phone
      // Note: Trendyol API doesn't have direct phone filter, so we need to fetch and filter
      const credentials = await this.getCredentials(businessId);

      // Get last 90 days of orders
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams();
      params.append('startDate', ninetyDaysAgo);
      params.append('endDate', Date.now());
      params.append('size', 200); // Max page size

      const endpoint = `/orders?${params.toString()}`;
      const response = await this.makeRequest(credentials, endpoint);

      // Filter orders by phone number
      const matchingOrders = (response.content || []).filter(order => {
        const customerPhone = order.customerFirstName && order.shipmentAddress?.phone1
          ? order.shipmentAddress.phone1.replace(/[\s\-\+]/g, '')
          : '';

        // Check if phone ends with the searched number (handles country code differences)
        return customerPhone.endsWith(normalizedPhone) ||
               normalizedPhone.endsWith(customerPhone) ||
               customerPhone.includes(normalizedPhone) ||
               normalizedPhone.includes(customerPhone);
      });

      console.log(`✅ Trendyol: Found ${matchingOrders.length} orders for phone ${phone}`);

      return matchingOrders.map(order => this.formatOrderDetails(order));
    } catch (error) {
      console.error('❌ Trendyol getOrdersByCustomerPhone error:', error);
      throw error;
    }
  }

  /**
   * Get cargo/shipment tracking information for an order
   * @param {number} businessId - Business ID
   * @param {string} orderNumber - Order number
   * @returns {Promise<Object>} Cargo tracking info
   */
  async getCargoTracking(businessId, orderNumber) {
    try {
      // First get the order to extract shipment details
      const order = await this.getOrderByNumber(businessId, orderNumber);

      if (!order) {
        return {
          success: false,
          message: 'Sipariş bulunamadı'
        };
      }

      // Extract shipment/cargo info from order
      const cargoInfo = {
        orderNumber: order.orderNumber,
        status: order.status,
        statusText: this.getStatusText(order.status),
        cargoCompany: order.cargoProviderName || 'Belirtilmemiş',
        trackingNumber: order.cargoTrackingNumber || null,
        trackingUrl: order.cargoTrackingUrl || null,
        estimatedDelivery: order.estimatedDeliveryDate || null,
        shipmentDate: order.shipmentDate || null,
        lines: order.lines.map(line => ({
          productName: line.productName,
          quantity: line.quantity,
          status: line.status
        }))
      };

      console.log(`✅ Trendyol: Retrieved cargo info for order ${orderNumber}`);

      return {
        success: true,
        ...cargoInfo
      };
    } catch (error) {
      console.error('❌ Trendyol getCargoTracking error:', error);
      throw error;
    }
  }

  /**
   * Get product stock information
   * @param {number} businessId - Business ID
   * @param {string} barcode - Product barcode
   * @returns {Promise<Object>} Stock information
   */
  async getProductStock(businessId, barcode) {
    try {
      const credentials = await this.getCredentials(businessId);

      // Query products endpoint with barcode filter
      const params = new URLSearchParams();
      params.append('barcode', barcode);
      params.append('approved', 'true');

      const endpoint = `/products?${params.toString()}`;
      const response = await this.makeRequest(credentials, endpoint);

      if (response.content && response.content.length > 0) {
        const product = response.content[0];

        const stockInfo = {
          success: true,
          barcode: product.barcode,
          productName: product.title,
          stockQuantity: product.quantity || 0,
          price: product.salePrice || product.listPrice,
          currency: 'TRY',
          isOnSale: product.onSale || false,
          productUrl: product.productUrl || null
        };

        console.log(`✅ Trendyol: Found product ${barcode} with stock ${stockInfo.stockQuantity}`);
        return stockInfo;
      }

      console.log(`⚠️ Trendyol: Product with barcode ${barcode} not found`);
      return {
        success: false,
        message: `${barcode} barkodlu ürün bulunamadı`
      };
    } catch (error) {
      console.error('❌ Trendyol getProductStock error:', error);
      throw error;
    }
  }

  /**
   * Search products by name/keyword
   * @param {number} businessId - Business ID
   * @param {string} productName - Product name or keyword
   * @returns {Promise<Object>} Matching products
   */
  async searchProducts(businessId, productName) {
    try {
      const credentials = await this.getCredentials(businessId);

      // Get all products and filter by name
      // Note: Trendyol API doesn't have direct name search, so we fetch and filter
      const params = new URLSearchParams();
      params.append('approved', 'true');
      params.append('size', 200);

      const endpoint = `/products?${params.toString()}`;
      const response = await this.makeRequest(credentials, endpoint);

      const searchTermLower = productName.toLowerCase();

      const matchingProducts = (response.content || []).filter(product => {
        const title = (product.title || '').toLowerCase();
        const brand = (product.brand || '').toLowerCase();

        return title.includes(searchTermLower) || brand.includes(searchTermLower);
      });

      console.log(`✅ Trendyol: Found ${matchingProducts.length} products matching "${productName}"`);

      return {
        success: true,
        products: matchingProducts.slice(0, 10).map(product => ({
          barcode: product.barcode,
          productName: product.title,
          brand: product.brand,
          stockQuantity: product.quantity || 0,
          price: product.salePrice || product.listPrice,
          currency: 'TRY'
        })),
        totalFound: matchingProducts.length
      };
    } catch (error) {
      console.error('❌ Trendyol searchProducts error:', error);
      throw error;
    }
  }

  /**
   * Test API connection with provided credentials
   * @param {Object} credentials - Test credentials
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(credentials) {
    try {
      const { supplierId, apiKey, apiSecret } = credentials;

      if (!supplierId || !apiKey || !apiSecret) {
        return {
          success: false,
          message: 'Missing required credentials'
        };
      }

      // Try to fetch supplier info or a simple endpoint
      const url = `${TRENDYOL_BASE_URL}/suppliers/${supplierId}/addresses`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.createAuthHeader(apiKey, apiSecret)}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Telyx.ai-Integration/1.0'
        }
      });

      if (response.ok) {
        console.log('✅ Trendyol: Connection test successful');
        return {
          success: true,
          message: 'Trendyol API bağlantısı başarılı'
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Trendyol: Connection test failed:', response.status, errorText);
        return {
          success: false,
          message: `API bağlantı hatası: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Trendyol testConnection error:', error);
      return {
        success: false,
        message: `Bağlantı hatası: ${error.message}`
      };
    }
  }

  /**
   * Format order details for consistent response
   * @param {Object} order - Raw order from Trendyol API
   * @returns {Object} Formatted order details
   */
  formatOrderDetails(order) {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      statusText: this.getStatusText(order.status),
      orderDate: order.orderDate ? new Date(order.orderDate).toISOString() : null,
      totalPrice: order.totalPrice || 0,
      currency: order.currencyCode || 'TRY',

      // Customer info (partial for privacy)
      customerFirstName: order.customerFirstName || '',

      // Shipping info
      shipmentAddress: order.shipmentAddress ? {
        city: order.shipmentAddress.city,
        district: order.shipmentAddress.district,
        address: order.shipmentAddress.fullAddress
      } : null,

      // Cargo info
      cargoProviderName: order.cargoProviderName || null,
      cargoTrackingNumber: order.cargoTrackingNumber || null,
      cargoTrackingUrl: order.cargoTrackingLink || null,
      shipmentDate: order.shipmentPackageStatus === 'Shipped' ? order.lastModifiedDate : null,

      // Order lines (products)
      lines: (order.lines || []).map(line => ({
        productName: line.productName,
        productCode: line.productCode,
        barcode: line.barcode,
        quantity: line.quantity,
        price: line.price,
        status: line.status || order.status
      })),

      // Timestamps
      createdAt: order.orderDate ? new Date(order.orderDate).toISOString() : null,
      updatedAt: order.lastModifiedDate ? new Date(order.lastModifiedDate).toISOString() : null
    };
  }

  /**
   * Convert Trendyol status code to Turkish text
   * @param {string} status - Status code
   * @returns {string} Turkish status text
   */
  getStatusText(status) {
    const statusMap = {
      'Created': 'Sipariş Oluşturuldu',
      'Picking': 'Hazırlanıyor',
      'Invoiced': 'Faturalandı',
      'Shipped': 'Kargoya Verildi',
      'Delivered': 'Teslim Edildi',
      'Cancelled': 'İptal Edildi',
      'UnDelivered': 'Teslim Edilemedi',
      'Returned': 'İade Edildi',
      'Repack': 'Yeniden Paketleniyor',
      'UnSupplied': 'Temin Edilemedi'
    };

    return statusMap[status] || status;
  }
}

export default new TrendyolService();
