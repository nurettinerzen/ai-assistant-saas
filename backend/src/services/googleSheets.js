import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GoogleSheetsService {
  constructor() {
    const credentialsPath = path.join(__dirname, '../../config/google-credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
      console.error('Google credentials file not found!');
      this.auth = null;
      return;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  // Read inventory from Google Sheet
  async readInventory(spreadsheetId, range = 'Sheet1!A:G') {
    try {
      if (!this.auth) {
        throw new Error('Google Sheets not configured');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
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
        
        const product = {
          sku: row[headers.indexOf('sku')] || '',
          name: row[headers.indexOf('name')] || row[headers.indexOf('product')] || '',
          description: row[headers.indexOf('description')] || '',
          price: parseFloat(row[headers.indexOf('price')] || 0),
          stockQuantity: parseInt(row[headers.indexOf('stock')] || row[headers.indexOf('quantity')] || row[headers.indexOf('stockquantity')] || 0),
          lowStockThreshold: parseInt(row[headers.indexOf('lowstockthreshold')] || row[headers.indexOf('minstock')] || 10),
          category: row[headers.indexOf('category')] || ''
        };

        // Only add if has SKU and name
        if (product.sku && product.name) {
          products.push(product);
        }
      }

      return products;

    } catch (error) {
      console.error('Google Sheets read error:', error);
      throw error;
    }
  }

  // Validate spreadsheet access
  async validateSpreadsheet(spreadsheetId) {
    try {
      if (!this.auth) {
        throw new Error('Google Sheets not configured');
      }

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });

      return {
        valid: true,
        title: response.data.properties.title,
        sheets: response.data.sheets.map(s => s.properties.title)
      };

    } catch (error) {
      console.error('Spreadsheet validation error:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

export default new GoogleSheetsService();