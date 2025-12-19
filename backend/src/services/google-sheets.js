/**
 * Google Sheets Integration Service
 * OAuth 2.0 + Full CRM Integration (Products, Orders, Tickets)
 */

import { google } from 'googleapis';

// Phone normalization helper
const normalizePhone = (phone) => {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

// Sheet type detection patterns
const SHEET_PATTERNS = {
  products: ['ürünler', 'urunler', 'products', 'stok', 'stock', 'inventory', 'envanter'],
  orders: ['siparişler', 'siparisler', 'orders', 'sipariş', 'siparis'],
  tickets: ['servis', 'service', 'tickets', 'arıza', 'ariza', 'tamir', 'repair', 'destek', 'support']
};

class GoogleSheetsService {
  /**
   * Create OAuth2 client
   */
  createOAuth2Client(clientId, clientSecret, redirectUri) {
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(oauth2Client, state) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
      prompt: 'consent',
      state
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
      console.error('Google Sheets token error:', error);
      throw new Error('Failed to get Google Sheets tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, clientId, clientSecret) {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get authenticated OAuth client with tokens
   */
  getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret) {
    const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    return oauth2Client;
  }

  /**
   * List user's spreadsheets from Google Drive
   */
  async listSpreadsheets(accessToken, refreshToken, clientId, clientSecret) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      });

      return response.data.files || [];
    } catch (error) {
      console.error('List spreadsheets error:', error);
      throw error;
    }
  }

  /**
   * Get spreadsheet info including sheets list
   */
  async getSpreadsheetInfo(accessToken, refreshToken, clientId, clientSecret, spreadsheetId) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.title,sheets.properties'
      });

      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(s => ({
          sheetId: s.properties.sheetId,
          title: s.properties.title,
          index: s.properties.index
        }))
      };
    } catch (error) {
      console.error('Get spreadsheet info error:', error);
      throw error;
    }
  }

  /**
   * Detect sheet types in a spreadsheet
   * Returns: { products: 'SheetName', orders: 'SheetName', tickets: 'SheetName' }
   */
  async detectSheets(accessToken, refreshToken, clientId, clientSecret, spreadsheetId) {
    try {
      const info = await this.getSpreadsheetInfo(accessToken, refreshToken, clientId, clientSecret, spreadsheetId);

      const detected = {
        products: null,
        orders: null,
        tickets: null
      };

      for (const sheet of info.sheets) {
        const sheetNameLower = sheet.title.toLowerCase().trim();

        // Check each pattern type
        for (const [type, patterns] of Object.entries(SHEET_PATTERNS)) {
          if (patterns.some(p => sheetNameLower.includes(p))) {
            detected[type] = sheet.title;
            break;
          }
        }
      }

      return {
        ...detected,
        allSheets: info.sheets,
        title: info.title
      };
    } catch (error) {
      console.error('Detect sheets error:', error);
      throw error;
    }
  }

  /**
   * Read products/inventory from spreadsheet
   * Expected columns: SKU, Name, Description, Price, Stock, MinStock, Category
   */
  async readProducts(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:G`
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const products = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const getValue = (keys) => {
          for (const key of keys) {
            const idx = headers.indexOf(key);
            if (idx !== -1 && row[idx]) return row[idx];
          }
          return '';
        };

        const product = {
          sku: getValue(['sku', 'stok kodu', 'ürün kodu', 'urun kodu', 'kod']),
          name: getValue(['name', 'product', 'ürün', 'urun', 'ürün adı', 'urun adi', 'ad']),
          description: getValue(['description', 'açıklama', 'aciklama', 'desc']),
          price: parseFloat(getValue(['price', 'fiyat', 'tutar']) || 0) || 0,
          stockQuantity: parseInt(getValue(['stock', 'stok', 'quantity', 'adet', 'miktar']) || 0) || 0,
          lowStockThreshold: parseInt(getValue(['minstock', 'min stok', 'minimum', 'min']) || 10) || 10,
          category: getValue(['category', 'kategori', 'cat'])
        };

        if (product.sku && product.name) {
          products.push(product);
        }
      }

      return products;
    } catch (error) {
      console.error('Read products error:', error);
      return [];
    }
  }

  // Alias for backward compatibility
  async readInventory(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName = 'Sheet1') {
    return this.readProducts(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName);
  }

  /**
   * Read orders from spreadsheet
   * Expected columns: OrderNumber, CustomerPhone, CustomerName, Status, TrackingNumber, Carrier, TotalAmount, EstimatedDelivery
   */
  async readOrders(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:H`
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const orders = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const getValue = (keys) => {
          for (const key of keys) {
            const idx = headers.indexOf(key);
            if (idx !== -1 && row[idx]) return row[idx];
          }
          return '';
        };

        const orderNumber = getValue(['ordernumber', 'order number', 'sipariş no', 'siparis no', 'sipariş numarası', 'siparis numarasi', 'no']);
        const customerPhone = getValue(['customerphone', 'customer phone', 'telefon', 'phone', 'tel', 'müşteri telefon']);

        if (!orderNumber || !customerPhone) continue;

        const order = {
          orderNumber,
          customerPhone: normalizePhone(customerPhone),
          customerName: getValue(['customername', 'customer name', 'müşteri', 'musteri', 'müşteri adı', 'musteri adi', 'ad soyad', 'isim']),
          status: getValue(['status', 'durum', 'sipariş durumu', 'siparis durumu']),
          trackingNumber: getValue(['trackingnumber', 'tracking number', 'takip no', 'kargo takip', 'takip numarası', 'kargo no']),
          carrier: getValue(['carrier', 'kargo', 'kargo firması', 'kargo firmasi', 'taşıyıcı']),
          totalAmount: parseFloat(getValue(['totalamount', 'total amount', 'tutar', 'toplam', 'total', 'fiyat']) || 0) || null,
          estimatedDelivery: getValue(['estimateddelivery', 'estimated delivery', 'tahmini teslimat', 'teslimat tarihi', 'teslim']) || null
        };

        // Parse date if exists
        if (order.estimatedDelivery) {
          const parsed = new Date(order.estimatedDelivery);
          order.estimatedDelivery = isNaN(parsed.getTime()) ? null : parsed;
        }

        orders.push(order);
      }

      return orders;
    } catch (error) {
      console.error('Read orders error:', error);
      return [];
    }
  }

  /**
   * Read tickets/service records from spreadsheet
   * Expected columns: TicketNumber, CustomerPhone, CustomerName, Product, Issue, Status, Notes, EstimatedCompletion, Cost
   */
  async readTickets(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:I`
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const tickets = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const getValue = (keys) => {
          for (const key of keys) {
            const idx = headers.indexOf(key);
            if (idx !== -1 && row[idx]) return row[idx];
          }
          return '';
        };

        const ticketNumber = getValue(['ticketnumber', 'ticket number', 'servis no', 'arıza no', 'ariza no', 'kayıt no', 'no']);
        const customerPhone = getValue(['customerphone', 'customer phone', 'telefon', 'phone', 'tel', 'müşteri telefon']);

        if (!ticketNumber || !customerPhone) continue;

        const ticket = {
          ticketNumber,
          customerPhone: normalizePhone(customerPhone),
          customerName: getValue(['customername', 'customer name', 'müşteri', 'musteri', 'müşteri adı', 'musteri adi', 'ad soyad', 'isim']),
          product: getValue(['product', 'ürün', 'urun', 'cihaz', 'model']),
          issue: getValue(['issue', 'sorun', 'arıza', 'ariza', 'problem', 'şikayet', 'sikayet']),
          status: getValue(['status', 'durum', 'servis durumu']),
          notes: getValue(['notes', 'notlar', 'not', 'açıklama', 'aciklama']),
          estimatedCompletion: getValue(['estimatedcompletion', 'estimated completion', 'tahmini tamamlanma', 'tahmini tarih', 'teslim']) || null,
          cost: parseFloat(getValue(['cost', 'ücret', 'ucret', 'tutar', 'fiyat', 'maliyet']) || 0) || null
        };

        // Parse date if exists
        if (ticket.estimatedCompletion) {
          const parsed = new Date(ticket.estimatedCompletion);
          ticket.estimatedCompletion = isNaN(parsed.getTime()) ? null : parsed;
        }

        tickets.push(ticket);
      }

      return tickets;
    } catch (error) {
      console.error('Read tickets error:', error);
      return [];
    }
  }

  /**
   * Create template spreadsheet with 3 sheets: Products, Orders, Tickets
   */
  async createTemplateSpreadsheet(accessToken, refreshToken, clientId, clientSecret) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const headerFormat = {
        backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
      };

      const createHeaderCell = (value) => ({
        userEnteredValue: { stringValue: value },
        userEnteredFormat: headerFormat
      });

      const createCell = (value, isNumber = false) => ({
        userEnteredValue: isNumber ? { numberValue: value } : { stringValue: value }
      });

      const response = await sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'Telyx CRM Template',
            locale: 'tr_TR'
          },
          sheets: [
            // Sheet 1: Products
            {
              properties: {
                title: 'Ürünler',
                index: 0,
                gridProperties: { frozenRowCount: 1 }
              },
              data: [{
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      createHeaderCell('SKU'),
                      createHeaderCell('Name'),
                      createHeaderCell('Description'),
                      createHeaderCell('Price'),
                      createHeaderCell('Stock'),
                      createHeaderCell('MinStock'),
                      createHeaderCell('Category')
                    ]
                  },
                  {
                    values: [
                      createCell('PRD-001'),
                      createCell('iPhone 15'),
                      createCell('128GB Siyah'),
                      createCell(45000, true),
                      createCell(25, true),
                      createCell(5, true),
                      createCell('Telefon')
                    ]
                  },
                  {
                    values: [
                      createCell('PRD-002'),
                      createCell('Samsung Galaxy S24'),
                      createCell('256GB Beyaz'),
                      createCell(42000, true),
                      createCell(15, true),
                      createCell(3, true),
                      createCell('Telefon')
                    ]
                  }
                ]
              }]
            },
            // Sheet 2: Orders
            {
              properties: {
                title: 'Siparişler',
                index: 1,
                gridProperties: { frozenRowCount: 1 }
              },
              data: [{
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      createHeaderCell('OrderNumber'),
                      createHeaderCell('CustomerPhone'),
                      createHeaderCell('CustomerName'),
                      createHeaderCell('Status'),
                      createHeaderCell('TrackingNumber'),
                      createHeaderCell('Carrier'),
                      createHeaderCell('TotalAmount'),
                      createHeaderCell('EstimatedDelivery')
                    ]
                  },
                  {
                    values: [
                      createCell('ORD-001'),
                      createCell('5551234567'),
                      createCell('Ahmet Yılmaz'),
                      createCell('kargoda'),
                      createCell('ABC123456'),
                      createCell('Yurtiçi'),
                      createCell(45000, true),
                      createCell('2024-12-25')
                    ]
                  },
                  {
                    values: [
                      createCell('ORD-002'),
                      createCell('5559876543'),
                      createCell('Ayşe Demir'),
                      createCell('hazırlanıyor'),
                      createCell(''),
                      createCell(''),
                      createCell(42000, true),
                      createCell('2024-12-28')
                    ]
                  }
                ]
              }]
            },
            // Sheet 3: Tickets/Service
            {
              properties: {
                title: 'Servis',
                index: 2,
                gridProperties: { frozenRowCount: 1 }
              },
              data: [{
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      createHeaderCell('TicketNumber'),
                      createHeaderCell('CustomerPhone'),
                      createHeaderCell('CustomerName'),
                      createHeaderCell('Product'),
                      createHeaderCell('Issue'),
                      createHeaderCell('Status'),
                      createHeaderCell('Notes'),
                      createHeaderCell('EstimatedCompletion'),
                      createHeaderCell('Cost')
                    ]
                  },
                  {
                    values: [
                      createCell('SRV-001'),
                      createCell('5551234567'),
                      createCell('Mehmet Demir'),
                      createCell('iPhone 13'),
                      createCell('Ekran kırık'),
                      createCell('tamir_edildi'),
                      createCell('Ekran değişimi yapıldı'),
                      createCell('2024-12-22'),
                      createCell(3500, true)
                    ]
                  },
                  {
                    values: [
                      createCell('SRV-002'),
                      createCell('5553334455'),
                      createCell('Fatma Kaya'),
                      createCell('MacBook Pro'),
                      createCell('Batarya şişmiş'),
                      createCell('beklemede'),
                      createCell('Yedek parça bekleniyor'),
                      createCell('2024-12-30'),
                      createCell(5000, true)
                    ]
                  }
                ]
              }]
            }
          ]
        }
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        title: response.data.properties.title,
        sheets: ['Ürünler', 'Siparişler', 'Servis']
      };
    } catch (error) {
      console.error('Create template error:', error);
      throw error;
    }
  }

  /**
   * Append row to spreadsheet
   */
  async appendRow(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName, values) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] }
      });

      return response.data;
    } catch (error) {
      console.error('Append row error:', error);
      throw error;
    }
  }

  /**
   * Read data from spreadsheet
   */
  async readData(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, range) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values;
    } catch (error) {
      console.error('Read data error:', error);
      throw error;
    }
  }
}

export default new GoogleSheetsService();
