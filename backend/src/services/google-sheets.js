/**
 * Google Sheets Integration Service
 * OAuth 2.0 + Simple CRM via Sheets
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
  getAuthUrl(oauth2Client) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent'
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
   * Create new spreadsheet
   */
  async createSpreadsheet(accessToken, refreshToken, clientId, clientSecret, title) {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      const response = await sheets.spreadsheets.create({
        resource: {
          properties: { title },
          sheets: [
            {
              properties: { title: 'Call Logs' },
              data: [
                {
                  rowData: [
                    {
                      values: [
                        { userEnteredValue: { stringValue: 'Date' } },
                        { userEnteredValue: { stringValue: 'Caller Phone' } },
                        { userEnteredValue: { stringValue: 'Duration' } },
                        { userEnteredValue: { stringValue: 'Sentiment' } },
                        { userEnteredValue: { stringValue: 'Summary' } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create spreadsheet error:', error);
      throw error;
    }
  }

  /**
   * Append row to spreadsheet
   */
  async appendRow(accessToken, refreshToken, clientId, clientSecret, spreadsheetId, sheetName, values) {
    try {
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

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
      const oauth2Client = this.createOAuth2Client(clientId, clientSecret, null);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

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
