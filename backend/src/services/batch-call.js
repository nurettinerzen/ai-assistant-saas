/**
 * Batch Call Service
 * Handles collection campaign creation, execution, and monitoring
 *
 * Flow:
 * 1. Create campaign with selected customers
 * 2. Queue worker processes calls (max concurrent limit)
 * 3. VAPI makes outbound calls
 * 4. Webhook receives call results
 * 5. Campaign stats updated
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// VAPI Configuration
const VAPI_API_URL = 'https://api.vapi.ai';

class BatchCallService {
  /**
   * Create a new collection campaign
   * @param {number} businessId - Business ID
   * @param {Object} campaignData - Campaign configuration
   * @returns {Promise<Object>} Created campaign
   */
  async createCampaign(businessId, campaignData) {
    const {
      name,
      channel,
      customers,
      maxConcurrent = 5,
      callDelay = 5,
      maxRetries = 2,
      collectionScript
    } = campaignData;

    // Validate customers
    if (!customers || customers.length === 0) {
      throw new Error('At least one customer is required');
    }

    // Validate channel
    if (!['PHONE', 'WHATSAPP'].includes(channel)) {
      throw new Error('Invalid channel. Must be PHONE or WHATSAPP');
    }

    // Create campaign with calls in transaction
    const campaign = await prisma.$transaction(async (tx) => {
      // Create campaign
      const newCampaign = await tx.campaign.create({
        data: {
          businessId,
          name: name || `Tahsilat Kampanyası - ${new Date().toLocaleDateString('tr-TR')}`,
          channel,
          status: 'PENDING',
          totalCalls: customers.length,
          maxConcurrent,
          callDelay,
          maxRetries,
          collectionScript
        }
      });

      // Create campaign calls
      const callsData = customers.map(customer => ({
        campaignId: newCampaign.id,
        customerName: customer.name,
        customerPhone: this.normalizePhone(customer.phone),
        customerEmail: customer.email || null,
        invoiceId: customer.invoiceId || null,
        invoiceNumber: customer.invoiceNumber || null,
        invoiceAmount: customer.amount || customer.invoiceAmount || 0,
        invoiceCurrency: customer.currency || 'TRY',
        daysOverdue: customer.daysOverdue || 0,
        status: 'PENDING'
      }));

      await tx.campaignCall.createMany({
        data: callsData
      });

      return newCampaign;
    });

    console.log(`📞 Campaign created: ${campaign.id} with ${customers.length} calls`);

    return {
      success: true,
      campaign: await this.getCampaignWithStats(campaign.id)
    };
  }

  /**
   * Start a campaign
   * @param {number} campaignId - Campaign ID
   * @param {number} businessId - Business ID (for validation)
   * @returns {Promise<Object>} Updated campaign
   */
  async startCampaign(campaignId, businessId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, businessId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'RUNNING') {
      throw new Error('Campaign is already running');
    }

    if (campaign.status === 'COMPLETED') {
      throw new Error('Campaign is already completed');
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    console.log(`▶️ Campaign ${campaignId} started`);

    // Trigger the queue worker (async)
    this.processQueue(campaignId, businessId).catch(err => {
      console.error(`Queue processing error for campaign ${campaignId}:`, err);
    });

    return {
      success: true,
      message: 'Campaign started',
      campaign: await this.getCampaignWithStats(campaignId)
    };
  }

  /**
   * Pause a running campaign
   * @param {number} campaignId - Campaign ID
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Updated campaign
   */
  async pauseCampaign(campaignId, businessId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, businessId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'RUNNING') {
      throw new Error('Campaign is not running');
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' }
    });

    console.log(`⏸️ Campaign ${campaignId} paused`);

    return {
      success: true,
      message: 'Campaign paused',
      campaign: await this.getCampaignWithStats(campaignId)
    };
  }

  /**
   * Resume a paused campaign
   * @param {number} campaignId - Campaign ID
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Updated campaign
   */
  async resumeCampaign(campaignId, businessId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, businessId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'PAUSED') {
      throw new Error('Campaign is not paused');
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' }
    });

    console.log(`▶️ Campaign ${campaignId} resumed`);

    // Continue queue processing
    this.processQueue(campaignId, businessId).catch(err => {
      console.error(`Queue processing error for campaign ${campaignId}:`, err);
    });

    return {
      success: true,
      message: 'Campaign resumed',
      campaign: await this.getCampaignWithStats(campaignId)
    };
  }

  /**
   * Cancel a campaign
   * @param {number} campaignId - Campaign ID
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Updated campaign
   */
  async cancelCampaign(campaignId, businessId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, businessId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
      throw new Error('Campaign cannot be cancelled');
    }

    await prisma.$transaction([
      // Update campaign status
      prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date()
        }
      }),
      // Mark pending calls as skipped
      prisma.campaignCall.updateMany({
        where: {
          campaignId,
          status: { in: ['PENDING', 'QUEUED'] }
        },
        data: { status: 'SKIPPED' }
      })
    ]);

    console.log(`❌ Campaign ${campaignId} cancelled`);

    return {
      success: true,
      message: 'Campaign cancelled',
      campaign: await this.getCampaignWithStats(campaignId)
    };
  }

  /**
   * Get campaign with statistics
   * @param {number} campaignId - Campaign ID
   * @returns {Promise<Object>} Campaign with stats
   */
  async getCampaignWithStats(campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        calls: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!campaign) {
      return null;
    }

    // Calculate stats
    const stats = {
      total: campaign.calls.length,
      pending: campaign.calls.filter(c => c.status === 'PENDING').length,
      queued: campaign.calls.filter(c => c.status === 'QUEUED').length,
      inProgress: campaign.calls.filter(c => c.status === 'IN_PROGRESS').length,
      completed: campaign.calls.filter(c => c.status === 'COMPLETED').length,
      failed: campaign.calls.filter(c => ['FAILED', 'NO_ANSWER', 'BUSY'].includes(c.status)).length,
      skipped: campaign.calls.filter(c => c.status === 'SKIPPED').length
    };

    // Outcome stats
    const outcomes = {
      paymentPromised: campaign.calls.filter(c => c.outcome === 'PAYMENT_PROMISED').length,
      partialPayment: campaign.calls.filter(c => c.outcome === 'PARTIAL_PAYMENT').length,
      refused: campaign.calls.filter(c => c.outcome === 'PAYMENT_REFUSED').length,
      dispute: campaign.calls.filter(c => c.outcome === 'DISPUTE').length,
      other: campaign.calls.filter(c => c.outcome && !['PAYMENT_PROMISED', 'PARTIAL_PAYMENT', 'PAYMENT_REFUSED', 'DISPUTE'].includes(c.outcome)).length
    };

    // Total amounts
    const totalAmount = campaign.calls.reduce((sum, c) => sum + c.invoiceAmount, 0);
    const promisedAmount = campaign.calls
      .filter(c => c.outcome === 'PAYMENT_PROMISED' || c.outcome === 'PARTIAL_PAYMENT')
      .reduce((sum, c) => sum + (c.paymentAmount || c.invoiceAmount), 0);

    return {
      ...campaign,
      stats,
      outcomes,
      amounts: {
        total: totalAmount,
        promised: promisedAmount,
        successRate: stats.completed > 0 ? Math.round((outcomes.paymentPromised + outcomes.partialPayment) / stats.completed * 100) : 0
      }
    };
  }

  /**
   * Get campaigns for a business
   * @param {number} businessId - Business ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Campaigns list
   */
  async getCampaigns(businessId, filters = {}) {
    const { status, page = 1, limit = 20 } = filters;

    const where = { businessId };
    if (status) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { calls: true }
        }
      }
    });

    const total = await prisma.campaign.count({ where });

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get campaign calls
   * @param {number} campaignId - Campaign ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Calls list
   */
  async getCampaignCalls(campaignId, filters = {}) {
    const { status, page = 1, limit = 50 } = filters;

    const where = { campaignId };
    if (status) where.status = status;

    const calls = await prisma.campaignCall.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const total = await prisma.campaignCall.count({ where });

    return {
      calls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // ============================================================================
  // QUEUE PROCESSING
  // ============================================================================

  /**
   * Process campaign queue - makes calls in batches
   * @param {number} campaignId - Campaign ID
   * @param {number} businessId - Business ID
   */
  async processQueue(campaignId, businessId) {
    console.log(`🔄 Processing queue for campaign ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign || campaign.status !== 'RUNNING') {
      console.log(`Campaign ${campaignId} is not running, stopping queue`);
      return;
    }

    // Get business VAPI config
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        assistants: {
          where: { isActive: true },
          take: 1
        }
      }
    });

    if (!business?.vapiAssistantId && !business?.assistants?.[0]?.vapiAssistantId) {
      console.error(`Business ${businessId} has no VAPI assistant configured`);
      await this.failCampaign(campaignId, 'VAPI assistant not configured');
      return;
    }

    // Count active calls
    const activeCalls = await prisma.campaignCall.count({
      where: {
        campaignId,
        status: { in: ['QUEUED', 'IN_PROGRESS'] }
      }
    });

    // Get pending calls up to max concurrent limit
    const availableSlots = campaign.maxConcurrent - activeCalls;
    if (availableSlots <= 0) {
      console.log(`Campaign ${campaignId}: No available slots (${activeCalls}/${campaign.maxConcurrent})`);
      // Schedule retry
      setTimeout(() => this.processQueue(campaignId, businessId), 5000);
      return;
    }

    // Get next pending calls
    const pendingCalls = await prisma.campaignCall.findMany({
      where: {
        campaignId,
        status: 'PENDING'
      },
      take: availableSlots,
      orderBy: { createdAt: 'asc' }
    });

    if (pendingCalls.length === 0) {
      // Check if all calls are done
      const remainingCalls = await prisma.campaignCall.count({
        where: {
          campaignId,
          status: { in: ['PENDING', 'QUEUED', 'IN_PROGRESS'] }
        }
      });

      if (remainingCalls === 0) {
        await this.completeCampaign(campaignId);
        return;
      }

      // Some calls still in progress, wait
      setTimeout(() => this.processQueue(campaignId, businessId), 5000);
      return;
    }

    // Process each pending call
    for (const call of pendingCalls) {
      try {
        await this.initiateCall(call, business, campaign);
        // Delay between calls
        await this.delay(campaign.callDelay * 1000);
      } catch (error) {
        console.error(`Error initiating call ${call.id}:`, error);
        await prisma.campaignCall.update({
          where: { id: call.id },
          data: {
            status: 'FAILED',
            notes: error.message
          }
        });
      }
    }

    // Continue processing
    setTimeout(() => this.processQueue(campaignId, businessId), 5000);
  }

  /**
   * Initiate a single outbound call via VAPI
   * @param {Object} call - CampaignCall record
   * @param {Object} business - Business with VAPI config
   * @param {Object} campaign - Campaign record
   */
  async initiateCall(call, business, campaign) {
    console.log(`📞 Initiating call to ${call.customerName} (${call.customerPhone})`);

    // Mark as queued
    await prisma.campaignCall.update({
      where: { id: call.id },
      data: { status: 'QUEUED' }
    });

    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      throw new Error('VAPI API key not configured');
    }

    const assistantId = business.assistants?.[0]?.vapiAssistantId || business.vapiAssistantId;

    // Build dynamic system prompt for collection call
    const collectionPrompt = this.buildCollectionPrompt(call, business, campaign);

    // Get phone number to call from
    const fromPhoneId = business.vapiPhoneNumber;
    if (!fromPhoneId) {
      throw new Error('No VAPI phone number configured');
    }

    try {
      // Make VAPI outbound call
      const response = await axios.post(
        `${VAPI_API_URL}/call/phone`,
        {
          phoneNumberId: fromPhoneId,
          customer: {
            number: call.customerPhone,
            name: call.customerName
          },
          assistantId: assistantId,
          assistantOverrides: {
            firstMessage: this.getFirstMessage(call, business),
            model: {
              messages: [
                {
                  role: 'system',
                  content: collectionPrompt
                }
              ]
            }
          },
          metadata: {
            campaignId: campaign.id,
            callId: call.id,
            businessId: business.id
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const vapiCallId = response.data.id;

      // Update call with VAPI call ID
      await prisma.campaignCall.update({
        where: { id: call.id },
        data: {
          status: 'IN_PROGRESS',
          vapiCallId,
          startedAt: new Date()
        }
      });

      console.log(`✅ Call initiated: ${vapiCallId}`);

    } catch (error) {
      console.error('VAPI call error:', error.response?.data || error.message);

      // Check if should retry
      if (call.retryCount < campaign.maxRetries) {
        await prisma.campaignCall.update({
          where: { id: call.id },
          data: {
            status: 'PENDING',
            retryCount: call.retryCount + 1,
            notes: `Retry ${call.retryCount + 1}: ${error.message}`
          }
        });
      } else {
        await prisma.campaignCall.update({
          where: { id: call.id },
          data: {
            status: 'FAILED',
            notes: `Failed after ${call.retryCount + 1} attempts: ${error.message}`
          }
        });
      }
    }
  }

  /**
   * Handle VAPI webhook for call completion
   * @param {Object} webhookData - VAPI webhook payload
   */
  async handleCallWebhook(webhookData) {
    const { call, type } = webhookData;

    if (type !== 'call.ended' && type !== 'call-ended') {
      return;
    }

    const vapiCallId = call?.id;
    if (!vapiCallId) {
      console.log('ℹ️ No call ID in webhook - skipping batch call update');
      return;
    }

    // Find the campaign call by vapiCallId
    const campaignCall = await prisma.campaignCall.findFirst({
      where: { vapiCallId }
    });

    if (!campaignCall) {
      // Not a batch/campaign call - this is normal for regular inbound calls
      return;
    }

    console.log(`📞 Batch call ended for campaign call ${campaignCall.id}`);

    // Extract call data
    const duration = call.duration || 0;
    const transcript = call.transcript || [];
    const transcriptText = transcript.map(t => `${t.role}: ${t.content}`).join('\n');
    const endedReason = call.endedReason;

    // Determine outcome based on transcript/reason
    const outcome = this.analyzeCallOutcome(transcriptText, endedReason);

    // Extract payment promise details if applicable
    const paymentDetails = this.extractPaymentDetails(transcriptText);

    // Determine call status
    let status = 'COMPLETED';
    if (endedReason === 'no-answer' || endedReason === 'customer-did-not-answer') {
      status = 'NO_ANSWER';
    } else if (endedReason === 'busy' || endedReason === 'customer-busy') {
      status = 'BUSY';
    } else if (endedReason === 'voicemail' || endedReason === 'voicemail-reached') {
      status = 'VOICEMAIL';
    } else if (endedReason === 'error' || endedReason === 'assistant-error') {
      status = 'FAILED';
    }

    // Update campaign call
    await prisma.campaignCall.update({
      where: { id: campaignCall.id },
      data: {
        status,
        outcome,
        completedAt: new Date(),
        duration,
        transcript,
        transcriptText,
        summary: call.summary || null,
        paymentDate: paymentDetails.date,
        paymentAmount: paymentDetails.amount
      }
    });

    // Update campaign stats
    await this.updateCampaignStats(campaignCall.campaignId);

    console.log(`✅ Campaign call ${campaignCall.id} updated: ${status} - ${outcome}`);
  }

  /**
   * Analyze call transcript to determine outcome
   * @param {string} transcript - Call transcript text
   * @param {string} endedReason - VAPI ended reason
   * @returns {string} Outcome enum value
   */
  analyzeCallOutcome(transcript, endedReason) {
    const lowerTranscript = transcript.toLowerCase();

    // Payment promised indicators
    if (lowerTranscript.includes('ödeyeceğim') ||
        lowerTranscript.includes('ödeme yapacağım') ||
        lowerTranscript.includes('yarın öderim') ||
        lowerTranscript.includes('hemen öderim') ||
        lowerTranscript.includes('havale') ||
        lowerTranscript.includes('eft')) {
      return 'PAYMENT_PROMISED';
    }

    // Partial payment
    if (lowerTranscript.includes('taksit') ||
        lowerTranscript.includes('kısmen') ||
        lowerTranscript.includes('bir kısmını')) {
      return 'PARTIAL_PAYMENT';
    }

    // Refused
    if (lowerTranscript.includes('ödemeyeceğim') ||
        lowerTranscript.includes('param yok') ||
        lowerTranscript.includes('ödeyemem')) {
      return 'PAYMENT_REFUSED';
    }

    // Dispute
    if (lowerTranscript.includes('itiraz') ||
        lowerTranscript.includes('yanlış') ||
        lowerTranscript.includes('hata var')) {
      return 'DISPUTE';
    }

    // Callback requested
    if (lowerTranscript.includes('sonra arayın') ||
        lowerTranscript.includes('geri arar') ||
        lowerTranscript.includes('daha sonra')) {
      return 'CALLBACK_REQUESTED';
    }

    // No answer cases
    if (endedReason === 'no-answer' || endedReason === 'customer-did-not-answer') {
      return 'NO_RESPONSE';
    }

    return 'OTHER';
  }

  /**
   * Extract payment details from transcript
   * @param {string} transcript - Call transcript
   * @returns {Object} Payment details
   */
  extractPaymentDetails(transcript) {
    const details = { date: null, amount: null };

    // Try to find date mentions (Turkish format)
    const datePatterns = [
      /(\d{1,2})[\s\/\.\-](\d{1,2})[\s\/\.\-](\d{4})/,
      /yarın/i,
      /bugün/i,
      /pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar/i
    ];

    for (const pattern of datePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        if (match[0].toLowerCase() === 'yarın') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          details.date = tomorrow;
        } else if (match[0].toLowerCase() === 'bugün') {
          details.date = new Date();
        } else if (match[1] && match[2] && match[3]) {
          details.date = new Date(match[3], parseInt(match[2]) - 1, parseInt(match[1]));
        }
        break;
      }
    }

    // Try to find amount
    const amountMatch = transcript.match(/(\d+[\.,]?\d*)\s*(tl|lira|bin)/i);
    if (amountMatch) {
      let amount = parseFloat(amountMatch[1].replace(',', '.'));
      if (amountMatch[2].toLowerCase() === 'bin') {
        amount *= 1000;
      }
      details.amount = amount;
    }

    return details;
  }

  /**
   * Update campaign statistics
   * @param {number} campaignId - Campaign ID
   */
  async updateCampaignStats(campaignId) {
    const calls = await prisma.campaignCall.findMany({
      where: { campaignId }
    });

    const completed = calls.filter(c => c.status === 'COMPLETED').length;
    const successful = calls.filter(c =>
      c.outcome === 'PAYMENT_PROMISED' || c.outcome === 'PARTIAL_PAYMENT'
    ).length;
    const failed = calls.filter(c =>
      ['FAILED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL'].includes(c.status)
    ).length;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        completedCalls: completed,
        successfulCalls: successful,
        failedCalls: failed
      }
    });
  }

  /**
   * Mark campaign as completed
   * @param {number} campaignId - Campaign ID
   */
  async completeCampaign(campaignId) {
    await this.updateCampaignStats(campaignId);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    console.log(`✅ Campaign ${campaignId} completed`);
  }

  /**
   * Mark campaign as failed
   * @param {number} campaignId - Campaign ID
   * @param {string} reason - Failure reason
   */
  async failCampaign(campaignId, reason) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        completedAt: new Date()
      }
    });

    console.log(`❌ Campaign ${campaignId} failed: ${reason}`);
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Build collection call system prompt based on business language
   */
  buildCollectionPrompt(call, business, campaign) {
    const customScript = campaign.collectionScript || '';
    const lang = business.language || 'TR';

    if (lang === 'TR') {
      return `Sen ${business.name} şirketinin tahsilat asistanısın.
Şu anda ${call.customerName} ile görüşüyorsun.

MÜŞTERİ BİLGİLERİ:
- İsim: ${call.customerName}
- Fatura No: ${call.invoiceNumber || 'Bilinmiyor'}
- Borç Tutarı: ${call.invoiceAmount.toLocaleString('tr-TR')} ${call.invoiceCurrency}
- Gecikme: ${call.daysOverdue} gün

GÖREV:
1. Kendini kibarca tanıt (${business.name} tahsilat departmanı)
2. Ödenmemiş faturayı hatırlat
3. Ödeme durumunu sor
4. Ödeme planı veya tarih al
5. Teşekkür et ve görüşmeyi kapat

KURALLAR:
- Asla tehditkar veya kaba olma
- Profesyonel ve anlayışlı ol
- Müşteri itiraz ederse not al
- Ödeme sözü alırsan tarihi ve tutarı netleştir
- Görüşme 2-3 dakikayı geçmesin

${customScript ? `EK TALİMATLAR:\n${customScript}` : ''}

Konuşmayı Türkçe yap.`;
    } else {
      return `You are the collection assistant of ${business.name}.
You are currently speaking with ${call.customerName}.

CUSTOMER INFORMATION:
- Name: ${call.customerName}
- Invoice No: ${call.invoiceNumber || 'Unknown'}
- Amount Due: ${call.invoiceAmount.toLocaleString('en-US')} ${call.invoiceCurrency}
- Days Overdue: ${call.daysOverdue} days

TASKS:
1. Introduce yourself politely (${business.name} collections department)
2. Remind about the unpaid invoice
3. Ask about payment status
4. Get a payment plan or date
5. Thank them and close the conversation

RULES:
- Never be threatening or rude
- Be professional and understanding
- Take note if customer disputes
- If payment is promised, clarify the date and amount
- Keep the call under 2-3 minutes

${customScript ? `ADDITIONAL INSTRUCTIONS:\n${customScript}` : ''}

Speak in English.`;
    }
  }

  /**
   * Get first message for collection call based on business language
   */
  getFirstMessage(call, business, campaignType = 'COLLECTION') {
    const lang = business.language || 'TR';

    if (lang === 'TR') {
      if (campaignType === 'COLLECTION') {
        return `Merhaba ${call.customerName}, ben ${business.name}'den arıyorum. ${call.invoiceAmount.toLocaleString('tr-TR')} ${call.invoiceCurrency} tutarındaki faturanızla ilgili sizinle görüşmek istiyordum. Uygun musunuz?`;
      }
      // Default TR message
      return `Merhaba ${call.customerName}, ben ${business.name}'den arıyorum. Size nasıl yardımcı olabilirim?`;
    } else {
      // English and other languages
      if (campaignType === 'COLLECTION') {
        return `Hello ${call.customerName}, I'm calling from ${business.name}. I wanted to discuss your invoice of ${call.invoiceAmount.toLocaleString('en-US')} ${call.invoiceCurrency}. Is this a good time?`;
      }
      return `Hello ${call.customerName}, I'm calling from ${business.name}. How can I help you?`;
    }
  }

  /**
   * Normalize phone number
   */
  normalizePhone(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Turkish numbers
    if (cleaned.startsWith('0')) {
      cleaned = '90' + cleaned.substring(1);
    } else if (!cleaned.startsWith('90') && cleaned.length === 10) {
      cleaned = '90' + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // GLOBAL QUEUE PROCESSOR
  // ============================================================================

  /**
   * Process all running campaigns - called by setInterval in server.js
   * This is the main entry point for background queue processing
   */
  async processAllQueues() {
    try {
      // Find all running campaigns
      const runningCampaigns = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        include: {
          _count: {
            select: {
              calls: {
                where: { status: { in: ['PENDING', 'QUEUED', 'IN_PROGRESS'] } }
              }
            }
          }
        }
      });

      if (runningCampaigns.length === 0) {
        return; // No active campaigns
      }

      console.log(`🔄 Processing ${runningCampaigns.length} active campaigns`);

      // Process each campaign
      for (const campaign of runningCampaigns) {
        // Skip if no pending work
        if (campaign._count.calls === 0) {
          // Check if campaign should be completed
          const remainingCalls = await prisma.campaignCall.count({
            where: {
              campaignId: campaign.id,
              status: { in: ['PENDING', 'QUEUED', 'IN_PROGRESS'] }
            }
          });

          if (remainingCalls === 0) {
            await this.completeCampaign(campaign.id);
          }
          continue;
        }

        // Process this campaign's queue
        try {
          await this.processQueue(campaign.id, campaign.businessId);
        } catch (error) {
          console.error(`Error processing campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in processAllQueues:', error);
    }
  }
}

// Create singleton instance
const batchCallService = new BatchCallService();

// Export the global queue processor for server.js
export const processAllQueues = () => batchCallService.processAllQueues();

export default batchCallService;
