/**
 * Ticimax E-Commerce Integration Service
 *
 * API: SOAP Web Services
 * Auth: API Key (UyeKodu / Yetki Kodu) - NO OAuth
 * Endpoints:
 *   Sipariş: https://{site}/Servis/SiparisServis.svc
 *   Ürün: https://{site}/Servis/UrunServis.svc
 *   Üye: https://{site}/Servis/UyeServis.svc
 *
 * Note: Uses 'soap' npm package for SOAP communication
 */

import { PrismaClient } from '@prisma/client';
import soap from 'soap';

const prisma = new PrismaClient();

class TicimaxService {
  constructor(credentials = null) {
    this.credentials = credentials;
    this.soapClients = {};
  }

  /**
   * Get credentials from database for a business
   */
  async getCredentials(businessId) {
    if (this.credentials) return this.credentials;

    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: 'TICIMAX',
        isActive: true
      }
    });

    if (!integration) {
      throw new Error('Ticimax integration not configured');
    }

    this.credentials = integration.credentials;
    return this.credentials;
  }

  /**
   * Get or create SOAP client for a service
   * @param {string} serviceName - 'SiparisServis', 'UrunServis', 'UyeServis'
   */
  async getSoapClient(siteUrl, serviceName) {
    const cacheKey = `${siteUrl}:${serviceName}`;

    if (this.soapClients[cacheKey]) {
      return this.soapClients[cacheKey];
    }

    // Clean site URL
    let cleanUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsdlUrl = `https://${cleanUrl}/Servis/${serviceName}.svc?wsdl`;

    console.log(`🔌 Ticimax: Creating SOAP client for ${serviceName}`);

    try {
      const client = await soap.createClientAsync(wsdlUrl);
      this.soapClients[cacheKey] = client;
      return client;
    } catch (error) {
      console.error(`❌ Ticimax SOAP client error for ${serviceName}:`, error.message);
      throw new Error(`Ticimax SOAP connection failed: ${error.message}`);
    }
  }

  /**
   * Test connection with Ticimax API
   */
  async testConnection(credentials) {
    try {
      const { siteUrl, uyeKodu } = credentials;

      if (!siteUrl || !uyeKodu) {
        return {
          success: false,
          message: 'Site URL and Yetki Kodu (API Key) are required'
        };
      }

      // Try to create a SOAP client and make a simple call
      const client = await this.getSoapClient(siteUrl, 'UyeServis');

      // Try a simple operation (list members with minimal params)
      const args = {
        UyeKodu: uyeKodu,
        Filtre: {
          UyeID: 0,
          SayfaNo: 1,
          SayfaBuyukluk: 1
        }
      };

      await new Promise((resolve, reject) => {
        client.SelectUyeler(args, (err, result) => {
          if (err) {
            // Check if it's an auth error
            if (err.message?.includes('401') || err.message?.includes('Unauthorized') ||
                err.message?.includes('UyeKodu')) {
              reject(new Error('Geçersiz Yetki Kodu'));
            } else {
              // Some errors might still indicate a working connection
              resolve(result);
            }
          } else {
            resolve(result);
          }
        });
      });

      console.log('✅ Ticimax: Connection test successful');
      return {
        success: true,
        message: 'Ticimax bağlantısı başarılı',
        siteUrl
      };
    } catch (error) {
      console.error('❌ Ticimax testConnection error:', error);
      return {
        success: false,
        message: `Bağlantı hatası: ${error.message}`
      };
    }
  }

  // ============================================================================
  // ORDER FUNCTIONS
  // ============================================================================

  /**
   * Get order by order ID/number
   */
  async getOrderByNumber(businessId, orderNumber) {
    try {
      console.log(`🔍 Ticimax: Searching order by number: ${orderNumber}`);

      const credentials = await this.getCredentials(businessId);
      const client = await this.getSoapClient(credentials.siteUrl, 'SiparisServis');

      // Clean order number
      const cleanNumber = orderNumber.replace('#', '').trim();
      const siparisId = parseInt(cleanNumber, 10);

      if (isNaN(siparisId)) {
        return {
          success: false,
          message: 'Geçersiz sipariş numarası'
        };
      }

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          SiparisID: siparisId,
          OdemeDurumu: -1, // All payment statuses
          SiparisDurumu: -1, // All order statuses
          SayfaNo: 1,
          SayfaBuyukluk: 10
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectSiparis(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const orders = result?.SelectSiparisResult?.Siparisler?.Siparis || [];
      const orderArray = Array.isArray(orders) ? orders : [orders].filter(Boolean);

      if (orderArray.length === 0) {
        return {
          success: false,
          message: `Sipariş #${cleanNumber} bulunamadı`
        };
      }

      const order = orderArray[0];

      // Get order products
      const products = await this.getOrderProducts(businessId, siparisId);

      console.log(`✅ Ticimax: Found order ${order.SiparisID}`);

      return {
        success: true,
        order: this.normalizeOrder(order, products)
      };
    } catch (error) {
      console.error('❌ Ticimax getOrderByNumber error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Sipariş bilgisi alınamadı'
      };
    }
  }

  /**
   * Get order products
   */
  async getOrderProducts(businessId, siparisId) {
    try {
      const credentials = await this.getCredentials(businessId);
      const client = await this.getSoapClient(credentials.siteUrl, 'SiparisServis');

      const args = {
        UyeKodu: credentials.uyeKodu,
        SiparisID: siparisId
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectSiparisUrun(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const products = result?.SelectSiparisUrunResult?.SiparisUrunler?.SiparisUrun || [];
      return Array.isArray(products) ? products : [products].filter(Boolean);
    } catch (error) {
      console.error('❌ Ticimax getOrderProducts error:', error);
      return [];
    }
  }

  /**
   * Get orders by customer phone
   */
  async getOrdersByPhone(businessId, phone) {
    try {
      console.log(`🔍 Ticimax: Searching orders by phone: ${phone}`);

      const credentials = await this.getCredentials(businessId);

      // First find customer by phone
      const customer = await this.findCustomerByPhone(businessId, phone);

      if (!customer) {
        return {
          success: false,
          message: 'Bu telefon numarasına ait müşteri bulunamadı'
        };
      }

      // Now get orders for this customer
      const client = await this.getSoapClient(credentials.siteUrl, 'SiparisServis');

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          UyeID: customer.UyeID,
          OdemeDurumu: -1,
          SiparisDurumu: -1,
          SayfaNo: 1,
          SayfaBuyukluk: 10
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectSiparis(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const orders = result?.SelectSiparisResult?.Siparisler?.Siparis || [];
      const orderArray = Array.isArray(orders) ? orders : [orders].filter(Boolean);

      if (orderArray.length === 0) {
        return {
          success: false,
          message: 'Bu müşteriye ait sipariş bulunamadı'
        };
      }

      // Get products for first order
      const products = await this.getOrderProducts(businessId, orderArray[0].SiparisID);

      return {
        success: true,
        order: this.normalizeOrder(orderArray[0], products),
        totalOrders: orderArray.length
      };
    } catch (error) {
      console.error('❌ Ticimax getOrdersByPhone error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find customer by phone number
   */
  async findCustomerByPhone(businessId, phone) {
    try {
      const credentials = await this.getCredentials(businessId);
      const client = await this.getSoapClient(credentials.siteUrl, 'UyeServis');

      const cleanPhone = phone.replace(/\D/g, '');

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          Telefon: cleanPhone,
          SayfaNo: 1,
          SayfaBuyukluk: 5
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectUyeler(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const members = result?.SelectUyelerResult?.Uyeler?.Uye || [];
      const memberArray = Array.isArray(members) ? members : [members].filter(Boolean);

      return memberArray.length > 0 ? memberArray[0] : null;
    } catch (error) {
      console.error('❌ Ticimax findCustomerByPhone error:', error);
      return null;
    }
  }

  /**
   * Get orders by customer email
   */
  async getOrdersByEmail(businessId, email) {
    try {
      console.log(`🔍 Ticimax: Searching orders by email: ${email}`);

      const credentials = await this.getCredentials(businessId);

      // Find customer by email
      const client = await this.getSoapClient(credentials.siteUrl, 'UyeServis');

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          Email: email.toLowerCase(),
          SayfaNo: 1,
          SayfaBuyukluk: 5
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectUyeler(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const members = result?.SelectUyelerResult?.Uyeler?.Uye || [];
      const memberArray = Array.isArray(members) ? members : [members].filter(Boolean);

      if (memberArray.length === 0) {
        return {
          success: false,
          message: 'Bu email adresine ait müşteri bulunamadı'
        };
      }

      // Get orders for this customer
      const orderClient = await this.getSoapClient(credentials.siteUrl, 'SiparisServis');

      const orderArgs = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          UyeID: memberArray[0].UyeID,
          OdemeDurumu: -1,
          SiparisDurumu: -1,
          SayfaNo: 1,
          SayfaBuyukluk: 10
        }
      };

      const orderResult = await new Promise((resolve, reject) => {
        orderClient.SelectSiparis(orderArgs, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const orders = orderResult?.SelectSiparisResult?.Siparisler?.Siparis || [];
      const orderArray = Array.isArray(orders) ? orders : [orders].filter(Boolean);

      if (orderArray.length === 0) {
        return {
          success: false,
          message: 'Bu müşteriye ait sipariş bulunamadı'
        };
      }

      const products = await this.getOrderProducts(businessId, orderArray[0].SiparisID);

      return {
        success: true,
        order: this.normalizeOrder(orderArray[0], products),
        totalOrders: orderArray.length
      };
    } catch (error) {
      console.error('❌ Ticimax getOrdersByEmail error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================================================
  // PRODUCT FUNCTIONS
  // ============================================================================

  /**
   * Get product stock by name
   */
  async getProductStock(businessId, productName) {
    try {
      console.log(`🔍 Ticimax: Searching product: ${productName}`);

      const credentials = await this.getCredentials(businessId);
      const client = await this.getSoapClient(credentials.siteUrl, 'UrunServis');

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          UrunAdi: productName,
          SayfaNo: 1,
          SayfaBuyukluk: 10
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectUrun(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const products = result?.SelectUrunResult?.Urunler?.Urun || [];
      const productArray = Array.isArray(products) ? products : [products].filter(Boolean);

      if (productArray.length === 0) {
        return {
          success: false,
          message: `"${productName}" adlı ürün bulunamadı`
        };
      }

      const product = productArray[0];
      const totalStock = parseInt(product.Stok || product.StokMiktari || 0, 10);

      console.log(`✅ Ticimax: Found product ${product.UrunAdi} with stock ${totalStock}`);

      return {
        success: true,
        product: {
          id: product.UrunID?.toString(),
          title: product.UrunAdi,
          description: product.Aciklama || product.KisaAciklama,
          totalStock,
          available: totalStock > 0,
          price: parseFloat(product.Fiyat || product.SatisFiyati || 0),
          currency: 'TRY',
          sku: product.StokKodu || product.Barkod,
          variants: [], // Ticimax variants handled differently
          source: 'ticimax'
        },
        message: totalStock > 0
          ? `${product.UrunAdi} stokta mevcut (${totalStock} adet)`
          : `${product.UrunAdi} şu anda stokta yok`
      };
    } catch (error) {
      console.error('❌ Ticimax getProductStock error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================================================
  // CUSTOMER FUNCTIONS
  // ============================================================================

  /**
   * Get customer by phone
   */
  async getCustomerByPhone(businessId, phone) {
    try {
      const customer = await this.findCustomerByPhone(businessId, phone);

      if (!customer) {
        return {
          success: false,
          message: 'Müşteri bulunamadı'
        };
      }

      return {
        success: true,
        customer: {
          id: customer.UyeID,
          name: `${customer.Ad || ''} ${customer.Soyad || ''}`.trim() || customer.AdSoyad,
          email: customer.Email,
          phone: customer.Telefon || customer.GSM,
          createdAt: customer.KayitTarihi
        }
      };
    } catch (error) {
      console.error('❌ Ticimax getCustomerByPhone error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(businessId, email) {
    try {
      const credentials = await this.getCredentials(businessId);
      const client = await this.getSoapClient(credentials.siteUrl, 'UyeServis');

      const args = {
        UyeKodu: credentials.uyeKodu,
        Filtre: {
          Email: email.toLowerCase(),
          SayfaNo: 1,
          SayfaBuyukluk: 5
        }
      };

      const result = await new Promise((resolve, reject) => {
        client.SelectUyeler(args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const members = result?.SelectUyelerResult?.Uyeler?.Uye || [];
      const memberArray = Array.isArray(members) ? members : [members].filter(Boolean);

      if (memberArray.length === 0) {
        return {
          success: false,
          message: 'Müşteri bulunamadı'
        };
      }

      const customer = memberArray[0];

      return {
        success: true,
        customer: {
          id: customer.UyeID,
          name: `${customer.Ad || ''} ${customer.Soyad || ''}`.trim() || customer.AdSoyad,
          email: customer.Email,
          phone: customer.Telefon || customer.GSM,
          createdAt: customer.KayitTarihi
        }
      };
    } catch (error) {
      console.error('❌ Ticimax getCustomerByEmail error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Normalize order to standard format
   */
  normalizeOrder(order, products = []) {
    // Ticimax status mapping
    const statusMap = {
      '0': 'Beklemede',
      '1': 'Onaylandı',
      '2': 'Hazırlanıyor',
      '3': 'Kargoya Verildi',
      '4': 'Teslim Edildi',
      '5': 'İptal Edildi',
      '6': 'İade Edildi',
      'Beklemede': 'Beklemede',
      'Onaylandi': 'Onaylandı',
      'Hazirlaniyor': 'Hazırlanıyor',
      'KargoyaVerildi': 'Kargoya Verildi',
      'TeslimEdildi': 'Teslim Edildi',
      'Iptal': 'İptal Edildi',
      'Iade': 'İade Edildi'
    };

    const customerName = order.MusteriAdSoyad ||
      `${order.MusteriAd || ''} ${order.MusteriSoyad || ''}`.trim() ||
      order.TeslimatAdi ||
      'Bilinmiyor';

    return {
      id: order.SiparisID?.toString(),
      orderNumber: order.SiparisID?.toString() || order.SiparisNo,
      customerName,
      customerEmail: order.Email || order.MusteriEmail,
      customerPhone: order.Telefon || order.MusteriTelefon || order.TeslimatTelefon,
      status: order.SiparisDurumu?.toString() || order.Durum,
      statusText: statusMap[order.SiparisDurumu] || statusMap[order.Durum] || order.DurumAdi || 'Bilinmiyor',
      totalPrice: parseFloat(order.GenelToplam || order.SiparisToplami || order.Toplam || 0),
      currency: 'TRY',
      createdAt: order.SiparisTarihi || order.KayitTarihi,
      updatedAt: order.GuncellemeTarihi,
      items: products.map(item => ({
        title: item.UrunAdi,
        variantTitle: item.SecenekAdi || item.VaryantAdi,
        quantity: parseInt(item.Adet || item.Miktar || 1, 10),
        price: parseFloat(item.BirimFiyat || item.Fiyat || 0)
      })),
      shippingAddress: order.TeslimatAdresi || order.Adres ? {
        address: order.TeslimatAdresi || order.Adres,
        city: order.TeslimatIl || order.Il,
        district: order.TeslimatIlce || order.Ilce,
        postalCode: order.PostaKodu,
        country: order.Ulke || 'Türkiye'
      } : null,
      tracking: order.KargoTakipNo ? {
        company: order.KargoFirma || order.KargoFirmasi || 'Kargo',
        number: order.KargoTakipNo,
        url: order.KargoTakipUrl || this.buildCargoTrackingUrl(order.KargoFirma, order.KargoTakipNo)
      } : null,
      source: 'ticimax'
    };
  }

  /**
   * Build cargo tracking URL for common Turkish carriers
   */
  buildCargoTrackingUrl(carrier, trackingNumber) {
    if (!trackingNumber) return null;

    const carrierLower = (carrier || '').toLowerCase();

    if (carrierLower.includes('yurtiçi') || carrierLower.includes('yurtici')) {
      return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${trackingNumber}`;
    }
    if (carrierLower.includes('aras')) {
      return `https://www.araskargo.com.tr/trcmb_araskargo/pages/sorgulama/gonderi_takip.aspx?q=${trackingNumber}`;
    }
    if (carrierLower.includes('mng')) {
      return `https://www.mngkargo.com.tr/gonderi-takip/?q=${trackingNumber}`;
    }
    if (carrierLower.includes('ptt')) {
      return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${trackingNumber}`;
    }

    return null;
  }

  /**
   * Check if business has active Ticimax integration
   */
  static async hasIntegration(businessId) {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          businessId,
          type: 'TICIMAX',
          isActive: true,
          connected: true
        }
      });
      return !!integration;
    } catch (error) {
      return false;
    }
  }
}

export default TicimaxService;
