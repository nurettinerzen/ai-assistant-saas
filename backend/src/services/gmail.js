/**
 * Gmail Integration Service
 * OAuth 2.0 + Email Operations
 */

import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { convert } from 'html-to-text';

const prisma = new PrismaClient();

/**
 * Strip quoted reply content from email body
 * Removes the "On ... wrote:" pattern and everything after it
 */
function stripQuotedContent(text) {
  if (!text) return '';

  // Common patterns for quoted replies in different languages
  const patterns = [
    // English: "On Mon, Jan 15, 2024 at 10:30 AM John Doe <john@example.com> wrote:"
    /\n\s*On\s+.*\s+wrote:\s*\n[\s\S]*/i,
    // Turkish: "15 Oca 2024 Pzt, 10:30 tarihinde John Doe <john@example.com> şunu yazdı:"
    /\n\s*\d+\s+\w+\s+\d+.*şunu yazdı:\s*\n[\s\S]*/i,
    // Gmail style separator
    /\n\s*---------- Forwarded message ---------[\s\S]*/i,
    // Common reply markers
    /\n\s*-{3,}\s*Original Message\s*-{3,}[\s\S]*/i,
    /\n\s*_{3,}\s*[\s\S]*/,
    // Quote markers (lines starting with >)
    /(\n\s*>.*)+$/,
    // "From:" header pattern (Outlook style)
    /\n\s*From:.*\n\s*Sent:.*\n\s*To:.*\n\s*Subject:[\s\S]*/i,
    // "Kimden:" Turkish Outlook pattern
    /\n\s*Kimden:.*\n\s*Gönderildi:.*\n\s*Kime:.*\n\s*Konu:[\s\S]*/i
  ];

  let cleanedText = text;

  for (const pattern of patterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }

  // Also strip signature blocks
  cleanedText = cleanedText.replace(/\n\s*--\s*\n[\s\S]*$/, '');

  return cleanedText.trim();
}

// Gmail API Scopes
// Only request minimum necessary scopes:
// - gmail.readonly: Read emails and threads
// - gmail.send: Send emails (messages.send)
// - userinfo.email: Get user's email address
// Note: gmail.modify removed (was used for markAsRead + drafts.create, both unnecessary)
// Note: gmail.compose not needed (drafts managed in our DB, not Gmail Drafts folder)
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
];

class GmailService {
  /**
   * Create OAuth2 client
   */
  createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_EMAIL_REDIRECT_URI ||
      `${process.env.BACKEND_URL}/api/email/gmail/callback`;

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Get OAuth authorization URL with PKCE support
   * @param {string} state - Cryptographically secure state token (CSRF protection)
   * @param {string} codeChallenge - PKCE code challenge (optional)
   * @returns {string} Authorization URL
   */
  getAuthUrl(state, codeChallenge = null) {
    const oauth2Client = this.createOAuth2Client();

    const authUrlParams = {
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent',
      state
    };

    // Add PKCE parameters if provided
    if (codeChallenge) {
      authUrlParams.code_challenge = codeChallenge;
      authUrlParams.code_challenge_method = 'S256';
    }

    return oauth2Client.generateAuthUrl(authUrlParams);
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {number} businessId - Business ID
   * @param {string} codeVerifier - PKCE code verifier (optional)
   */
  async handleCallback(code, businessId, codeVerifier = null) {
    try {
      const oauth2Client = this.createOAuth2Client();

      // Include PKCE verifier if provided
      const tokenParams = { code };
      if (codeVerifier) {
        tokenParams.codeVerifier = codeVerifier;
      }

      const { tokens } = await oauth2Client.getToken(tokenParams);

      // Log granted scopes for debugging
      console.log('📧 [Gmail] Granted scopes:', tokens.scope);
      console.log('📧 [Gmail] Token type:', tokens.token_type);
      console.log('📧 [Gmail] Has refresh token:', !!tokens.refresh_token);

      // Get user email
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

await prisma.emailIntegration.upsert({
  where: { businessId },
  update: {
    provider: 'GMAIL',
    email,
    credentials: tokens,
    connected: true
    // lastSyncedAt kaldırıldı - ilk sync'te 7 gün getirecek
  },
  create: {
    businessId,
    provider: 'GMAIL',
    email,
    credentials: tokens,
    connected: true
    // lastSyncedAt kaldırıldı - ilk sync'te 7 gün getirecek
  }
});

      console.log(`Gmail connected for business ${businessId}: ${email}`);
      return { success: true, email };
    } catch (error) {
      console.error('Gmail callback error:', error);
      throw new Error('Failed to complete Gmail OAuth');
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getAccessToken(businessId) {
    const integration = await prisma.emailIntegration.findUnique({
      where: { businessId }
    });

    if (!integration || integration.provider !== 'GMAIL') {
      throw new Error('Gmail not connected');
    }

    const credentials = integration.credentials;
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials(credentials);

    // Check if token is expired or needs refresh
    if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
      try {
        const { credentials: newTokens } = await oauth2Client.refreshAccessToken();

        // Update stored credentials
        await prisma.emailIntegration.update({
          where: { businessId },
          data: { credentials: newTokens }
        });

        oauth2Client.setCredentials(newTokens);
        console.log(`Gmail token refreshed for business ${businessId}`);
      } catch (error) {
        console.error('Token refresh failed:', error);

        // Check if it's an invalid_grant error (token revoked/expired)
        if (error.response?.data?.error === 'invalid_grant') {
          // Mark the integration as disconnected so user knows to reconnect
          await prisma.emailIntegration.update({
            where: { businessId },
            data: {
              connected: false,
              lastSyncedAt: null
            }
          });
          console.log(`Gmail disconnected for business ${businessId} due to invalid_grant`);
          throw new Error('Gmail bağlantısı sona erdi. Lütfen yeniden bağlanın. / Gmail connection expired. Please reconnect.');
        }

        throw new Error('Gmail token expired. Please reconnect.');
      }
    }

    return oauth2Client;
  }

  /**
   * Get list of messages
   */
  async getMessages(businessId, options = {}) {
    try {
      const auth = await this.getAccessToken(businessId);
      const gmail = google.gmail({ version: 'v1', auth });

      const {
        maxResults = 20,
        labelIds = ['INBOX'],
        query = '',
        pageToken = null
      } = options;

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        labelIds,
        q: query,
        pageToken
      });

      const messages = response.data.messages || [];
      const fullMessages = [];

      // Get full message details
      for (const msg of messages) {
        const fullMsg = await this.getMessage(businessId, msg.id, auth);
        fullMessages.push(fullMsg);
      }

      return {
        messages: fullMessages,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  /**
   * Get single message with full details
   */
  async getMessage(businessId, messageId, authClient = null) {
    try {
      const auth = authClient || await this.getAccessToken(businessId);
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return this.parseMessage(response.data);
    } catch (error) {
      console.error('Get message error:', error);
      throw error;
    }
  }

  /**
   * Get thread with all messages
   */
  async getThread(businessId, threadId) {
    try {
      const auth = await this.getAccessToken(businessId);
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      const thread = response.data;
      const messages = (thread.messages || []).map(msg => this.parseMessage(msg));

      return {
        threadId: thread.id,
        messages,
        snippet: thread.snippet
      };
    } catch (error) {
      console.error('Get thread error:', error);
      throw error;
    }
  }

  /**
   * Send an email
   */
  async sendMessage(businessId, to, subject, body, options = {}) {
    try {
      const auth = await this.getAccessToken(businessId);
      const gmail = google.gmail({ version: 'v1', auth });

      const integration = await prisma.emailIntegration.findUnique({
        where: { businessId }
      });

      const { threadId, inReplyTo, references } = options;

      // Build email headers
      const headers = [
        `To: ${to}`,
        `From: ${integration.email}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8'
      ];

      if (inReplyTo) {
        headers.push(`In-Reply-To: ${inReplyTo}`);
      }
      if (references) {
        headers.push(`References: ${references}`);
      }

      const emailContent = headers.join('\r\n') + '\r\n\r\n' + body;
      const encodedMessage = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId || undefined
        }
      });

      return {
        messageId: response.data.id,
        threadId: response.data.threadId
      };
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }



/**
 * Sync new messages since last sync
 */
async syncNewMessages(businessId) {
  try {
    const integration = await prisma.emailIntegration.findUnique({
      where: { businessId }
    });

    if (!integration) {
      throw new Error('Gmail not connected');
    }

    const lastSync = integration.lastSyncedAt;
    let query = 'in:inbox';

    // DEBUG LOGS
    console.log('=== GMAIL SYNC DEBUG ===');
    console.log('lastSync from DB:', lastSync);
    console.log('Date.now():', Date.now());
    console.log('Current date:', new Date().toISOString());

    // Her zaman son 7 günün maillerini çek (veya lastSync daha yeniyse onu kullan)
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

    if (lastSync) {
      const lastSyncTimestamp = Math.floor(lastSync.getTime() / 1000);
      // lastSync 7 günden eskiyse, 7 günü kullan; değilse lastSync'i kullan
      const effectiveTimestamp = Math.max(lastSyncTimestamp, sevenDaysAgo);
      query += ` after:${effectiveTimestamp}`;
      console.log('Using effective timestamp:', new Date(effectiveTimestamp * 1000).toISOString());
    } else {
      // İlk sync: son 7 günün maillerini getir
      query += ` after:${sevenDaysAgo}`;
      console.log('First sync: fetching last 7 days');
    }

    // Paginate through ALL pages — Gmail API returns max ~100 IDs per page
    let allMessages = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      const { messages, nextPageToken } = await this.getMessages(businessId, {
        maxResults: 100,  // Gmail optimal page size
        query,
        labelIds: ['INBOX'],
        pageToken
      });
      allMessages = allMessages.concat(messages);
      pageToken = nextPageToken;
      pageCount++;
      console.log(`📧 [Gmail Sync] Page ${pageCount}: fetched ${messages.length} messages (total: ${allMessages.length}, hasMore: ${!!pageToken})`);
    } while (pageToken);

    // Update last sync time AFTER all pages fetched successfully
    await prisma.emailIntegration.update({
      where: { businessId },
      data: { lastSyncedAt: new Date() }
    });

    console.log(`📧 [Gmail Sync] Complete: ${allMessages.length} messages in ${pageCount} page(s)`);
    return allMessages;
  } catch (error) {
    console.error('Sync messages error:', error);
    throw error;
  }
}

/**
 * Disconnect Gmail
 */
async disconnect(businessId) {
  try {
    await prisma.emailIntegration.update({
      where: { businessId },
      data: { 
        connected: false,
        lastSyncedAt: null  // ← BUNU EKLE
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Disconnect error:', error);
    throw error;
  }
}

  /**
   * Parse Gmail message to standard format
   */
  parseMessage(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };

    // Get body content + attachment metadata (content NOT downloaded — security measure)
    let bodyHtml = '';
    let bodyText = '';
    const attachmentMeta = [];

    const processPayload = (payload) => {
      if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data || '', 'base64').toString('utf-8');
      } else if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data || '', 'base64').toString('utf-8');
      }

      if (payload.parts) {
        for (const part of payload.parts) {
          // Collect attachment METADATA only (no content download)
          if (part.filename && part.body?.attachmentId) {
            attachmentMeta.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size || 0
            });
          }
          // Process text parts recursively
          if (!part.filename && !part.body?.attachmentId) {
            processPayload(part);
          }
        }
      }
    };

    if (message.payload) {
      processPayload(message.payload);
    }

    // Convert HTML to plain text if needed
    if (!bodyText && bodyHtml) {
      bodyText = convert(bodyHtml, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ]
      });
    }

    // Strip quoted content from replies to show only the new message
    const cleanBodyText = stripQuotedContent(bodyText);

    // Parse from address
    const fromRaw = getHeader('From') || '';
    const fromMatch = fromRaw.match(/^(?:(.+?)\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
    const fromName = fromMatch ? (fromMatch[1] || '').replace(/"/g, '').trim() : '';
    const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

    return {
      messageId: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject') || '(No Subject)',
      from: {
        email: fromEmail,
        name: fromName
      },
      to: getHeader('To') || '',
      date: getHeader('Date') || '',
      inReplyTo: getHeader('In-Reply-To'),
      references: getHeader('References'),
      bodyText: cleanBodyText,
      bodyHtml,
      attachments: attachmentMeta, // Metadata only — file content NOT downloaded (security)
      snippet: message.snippet,
      labelIds: message.labelIds || [],
      isUnread: (message.labelIds || []).includes('UNREAD')
    };
  }
}

export default new GmailService();
