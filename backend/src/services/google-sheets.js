/**
 * Google Sheets Integration Service
 * OAuth 2.0 + Inventory Management via Sheets
 */

import { google } from 'googleapis';

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
   * Read inventory from spreadsheet
   * Expected columns: SKU, Name, Description, Price, Stock, MinStock, Category
   */
  async readInventory(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName = 'Sheet1') {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:G`
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        return [];
      }

      // First row is headers
      const headers = rows[0].map(h => h.toLowerCase().trim());
      const products = [];

      // Parse each row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const product = {
          sku: row[headers.indexOf('sku')] || '',
          name: row[headers.indexOf('name')] || row[headers.indexOf('product')] || '',
          description: row[headers.indexOf('description')] || '',
          price: parseFloat(row[headers.indexOf('price')] || 0) || 0,
          stockQuantity: parseInt(row[headers.indexOf('stock')] || row[headers.indexOf('quantity')] || row[headers.indexOf('stockquantity')] || 0) || 0,
          lowStockThreshold: parseInt(row[headers.indexOf('minstock')] || row[headers.indexOf('lowstockthreshold')] || 10) || 10,
          category: row[headers.indexOf('category')] || ''
        };

        // Only add if has SKU and name
        if (product.sku && product.name) {
          products.push(product);
        }
      }

      return products;
    } catch (error) {
      console.error('Read inventory error:', error);
      throw error;
    }
  }

  /**
   * Create template spreadsheet in user's Drive
   */
  async createTemplateSpreadsheet(accessToken, refreshToken, clientId, clientSecret) {
    try {
      const oauth2Client = this.getAuthenticatedClient(accessToken, refreshToken, clientId, clientSecret);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      // Create spreadsheet with headers and sample data
      const response = await sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'Telyx Inventory Template',
            locale: 'tr_TR'
          },
          sheets: [
            {
              properties: {
                title: 'Inventory',
                gridProperties: {
                  frozenRowCount: 1
                }
              },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    // Header row
                    {
                      values: [
                        { userEnteredValue: { stringValue: 'SKU' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'Name' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'Description' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'Price' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'Stock' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'MinStock' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
                        { userEnteredValue: { stringValue: 'Category' }, userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }
                      ]
                    },
                    // Sample row 1
                    {
                      values: [
                        { userEnteredValue: { stringValue: 'PROD-001' } },
                        { userEnteredValue: { stringValue: 'Örnek Ürün 1' } },
                        { userEnteredValue: { stringValue: 'Bu bir örnek ürün açıklamasıdır' } },
                        { userEnteredValue: { numberValue: 99.90 } },
                        { userEnteredValue: { numberValue: 50 } },
                        { userEnteredValue: { numberValue: 10 } },
                        { userEnteredValue: { stringValue: 'Elektronik' } }
                      ]
                    },
                    // Sample row 2
                    {
                      values: [
                        { userEnteredValue: { stringValue: 'PROD-002' } },
                        { userEnteredValue: { stringValue: 'Örnek Ürün 2' } },
                        { userEnteredValue: { stringValue: 'İkinci örnek ürün' } },
                        { userEnteredValue: { numberValue: 149.00 } },
                        { userEnteredValue: { numberValue: 25 } },
                        { userEnteredValue: { numberValue: 5 } },
                        { userEnteredValue: { stringValue: 'Giyim' } }
                      ]
                    },
                    // Sample row 3
                    {
                      values: [
                        { userEnteredValue: { stringValue: 'PROD-003' } },
                        { userEnteredValue: { stringValue: 'Örnek Ürün 3' } },
                        { userEnteredValue: { stringValue: 'Üçüncü örnek ürün' } },
                        { userEnteredValue: { numberValue: 59.90 } },
                        { userEnteredValue: { numberValue: 100 } },
                        { userEnteredValue: { numberValue: 20 } },
                        { userEnteredValue: { stringValue: 'Aksesuar' } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        title: response.data.properties.title
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
        range: `${sheetName}!A:Z`,
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
