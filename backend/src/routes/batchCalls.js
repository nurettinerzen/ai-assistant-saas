import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import multer from 'multer';
import XLSX from 'xlsx';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads (5MB max)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize phone number to E.164 format
 * Supports international numbers and Turkish numbers
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters except +
  let cleaned = String(phone).replace(/[^\d+]/g, '');

  // If already has + at the start, it's international format - keep as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Remove leading + if somehow in middle (shouldn't happen but safety)
  cleaned = cleaned.replace(/\+/g, '');

  // Handle numbers starting with country codes (without +)
  if (cleaned.startsWith('90') && cleaned.length >= 12) {
    // Turkish number with country code (905XXXXXXXXX)
    return '+' + cleaned;
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    // US/Canada number (1XXXXXXXXXX)
    return '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Turkish number with leading 0 (05XXXXXXXXX)
    return '+90' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('5')) {
    // Turkish mobile without country code (5XXXXXXXXX)
    return '+90' + cleaned;
  } else if (cleaned.length >= 10) {
    // Other international - assume it's complete, just add +
    return '+' + cleaned;
  }

  return null; // Invalid phone number
}

/**
 * Parse CSV/Excel file and return rows
 */
function parseFile(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON with headers
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (data.length === 0) {
    throw new Error('File is empty or has no data rows');
  }

  // Get column names from first row
  const columns = Object.keys(data[0]);

  return { data, columns };
}

/**
 * Check if plan allows batch calls
 */
async function checkBatchCallAccess(businessId) {
  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  // Only PROFESSIONAL and ENTERPRISE plans have batch call access
  const allowedPlans = ['PROFESSIONAL', 'ENTERPRISE'];
  return allowedPlans.includes(subscription?.plan);
}

// ============================================================
// ROUTES
// ============================================================

router.use(authenticateToken);

/**
 * GET /api/batch-calls/check-access
 * Check if business has access to batch calling
 * NOTE: This route must be defined BEFORE /:id to avoid being caught by it
 */
router.get('/check-access', async (req, res) => {
  try {
    const businessId = req.businessId;
    const hasAccess = await checkBatchCallAccess(businessId);

    res.json({
      hasAccess,
      message: hasAccess
        ? 'Batch calling is available'
        : 'Upgrade to Professional or Enterprise plan for batch calling'
    });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ error: 'Failed to check access' });
  }
});

/**
 * GET /api/batch-calls/template
 * Download Excel template for batch calling
 * NOTE: This route must be defined BEFORE /:id to avoid being caught by it
 */
router.get('/template', async (req, res) => {
  try {
    // Create sample data with Turkish date format (DD/MM/YYYY)
    const sampleData = [
      {
        'Telefon': '+905321234567',
        'Borç Tutarı': '1500',
        'Para Birimi': 'TL',
        'Vade Tarihi': '15/01/2024'
      },
      {
        'Telefon': '+905331234568',
        'Borç Tutarı': '2300',
        'Para Birimi': 'TL',
        'Vade Tarihi': '20/01/2024'
      },
      {
        'Telefon': '+905341234569',
        'Borç Tutarı': '800',
        'Para Birimi': 'USD',
        'Vade Tarihi': '25/01/2024'
      }
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Telefon
      { wch: 12 }, // Borç Tutarı
      { wch: 12 }, // Para Birimi
      { wch: 12 }, // Vade Tarihi
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toplu Arama');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=toplu-arama-sablon.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

/**
 * POST /api/batch-calls/parse
 * Upload and parse file, return columns and preview data
 */
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    const businessId = req.businessId;

    // Check plan access
    const hasAccess = await checkBatchCallAccess(businessId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Batch calling is only available for Professional and Enterprise plans',
        errorTR: 'Toplu arama özelliği sadece Profesyonel ve Kurumsal planlarda kullanılabilir',
        upgrade: true
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { data, columns } = parseFile(req.file.buffer, req.file.originalname);

    // Return first 5 rows as preview
    const preview = data.slice(0, 5);

    res.json({
      success: true,
      columns,
      preview,
      totalRows: data.length
    });
  } catch (error) {
    console.error('Parse file error:', error);
    res.status(400).json({
      error: error.message || 'Failed to parse file'
    });
  }
});

/**
 * POST /api/batch-calls
 * Create a new batch call campaign
 */
router.post('/', upload.single('file'), checkPermission('campaigns:view'), async (req, res) => {
  try {
    const businessId = req.businessId;

    // Check plan access
    const hasAccess = await checkBatchCallAccess(businessId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Batch calling is only available for Professional and Enterprise plans',
        errorTR: 'Toplu arama özelliği sadece Profesyonel ve Kurumsal planlarda kullanılabilir',
        upgrade: true
      });
    }

    const { name, assistantId, phoneNumberId, columnMapping, scheduledAt } = req.body;

    // Validate required fields
    if (!name || !assistantId || !phoneNumberId) {
      return res.status(400).json({
        error: 'Name, assistant, and phone number are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify assistant belongs to this business and is outbound type
    const assistant = await prisma.assistant.findFirst({
      where: {
        id: assistantId,
        businessId,
        isActive: true,
        callDirection: 'outbound'
      }
    });

    if (!assistant) {
      return res.status(404).json({
        error: 'Outbound assistant not found',
        errorTR: 'Giden arama asistanı bulunamadı'
      });
    }

    if (!assistant.elevenLabsAgentId) {
      return res.status(400).json({
        error: 'Assistant is not configured with 11Labs',
        errorTR: 'Asistan 11Labs ile yapılandırılmamış'
      });
    }

    // Verify phone number belongs to this business
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        businessId,
        status: 'ACTIVE'
      }
    });

    if (!phoneNumber) {
      return res.status(404).json({
        error: 'Phone number not found',
        errorTR: 'Telefon numarası bulunamadı'
      });
    }

    if (!phoneNumber.elevenLabsPhoneId) {
      return res.status(400).json({
        error: 'Phone number is not configured with 11Labs',
        errorTR: 'Telefon numarası 11Labs ile yapılandırılmamış'
      });
    }

    // Parse file
    const { data } = parseFile(req.file.buffer, req.file.originalname);

    // Parse column mapping
    let mapping = {};
    try {
      mapping = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping || {};
    } catch (e) {
      console.error('Column mapping parse error:', e);
    }

    // Build recipients list
    const recipients = [];
    const phoneColumn = mapping.phone || 'phone';
    let recipientIndex = 0;

    for (const row of data) {
      // Find phone number using mapping
      const rawPhone = row[phoneColumn] || row['phone'] || row['Phone'] || row['telefon'] || row['Telefon'] || row['phone_number'] || row['phoneNumber'];
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      if (!normalizedPhone) {
        console.log('Skipping invalid phone:', rawPhone);
        continue;
      }

      recipientIndex++;

      // Build recipient object with dynamic variables and ID for tracking
      const recipient = {
        id: `recipient_${recipientIndex}`,  // ID for webhook matching
        phone_number: normalizedPhone,
        status: 'pending'  // Initial status
      };

      // Map other columns to dynamic variables
      if (mapping.customer_name) {
        recipient.customer_name = String(row[mapping.customer_name] || '');
      }
      if (mapping.debt_amount) {
        recipient.debt_amount = String(row[mapping.debt_amount] || '');
      }
      if (mapping.currency) {
        recipient.currency = String(row[mapping.currency] || 'TL');
      }
      if (mapping.due_date) {
        recipient.due_date = String(row[mapping.due_date] || '');
      }
      if (mapping.appointment_date) {
        recipient.appointment_date = String(row[mapping.appointment_date] || '');
      }
      if (mapping.custom_1) {
        recipient.custom_1 = String(row[mapping.custom_1] || '');
      }
      if (mapping.custom_2) {
        recipient.custom_2 = String(row[mapping.custom_2] || '');
      }

      recipients.push(recipient);
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No valid phone numbers found in file',
        errorTR: 'Dosyada geçerli telefon numarası bulunamadı'
      });
    }

    // Create batch call in database first
    const batchCall = await prisma.batchCall.create({
      data: {
        businessId,
        assistantId,
        phoneNumberId,
        name,
        status: 'PENDING',
        totalRecipients: recipients.length,
        recipients: JSON.stringify(recipients),
        columnMapping: JSON.stringify(mapping),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      }
    });

    // Submit to 11Labs Batch Calling API
    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

      // Transform recipients to 11Labs format with dynamic_variables and metadata
      const elevenLabsRecipients = recipients.map((r) => {
        const dynamicVars = {};
        if (r.customer_name) dynamicVars.customer_name = r.customer_name;
        if (r.debt_amount) dynamicVars.debt_amount = r.debt_amount;
        if (r.due_date) dynamicVars.due_date = r.due_date;
        if (r.currency) dynamicVars.currency = r.currency;
        if (r.appointment_date) dynamicVars.appointment_date = r.appointment_date;
        if (r.custom_1) dynamicVars.custom_1 = r.custom_1;
        if (r.custom_2) dynamicVars.custom_2 = r.custom_2;

        return {
          id: r.id,  // Use the same ID stored in DB
          phone_number: r.phone_number,
          conversation_initiation_client_data: {
            dynamic_variables: dynamicVars,
            // Metadata for webhook processing
            metadata: {
              business_id: businessId.toString(),
              batch_call_id: batchCall.id,
              recipient_id: r.id,  // Use the same ID stored in DB
              channel: 'outbound'
            }
          }
        };
      });

      const batchPayload = {
        call_name: name,
        agent_id: assistant.elevenLabsAgentId,
        agent_phone_number_id: phoneNumber.elevenLabsPhoneId,
        recipients: elevenLabsRecipients,
        ...(scheduledAt && { scheduled_time_unix: Math.floor(new Date(scheduledAt).getTime() / 1000) })
      };

      console.log('📤 Submitting batch call to 11Labs:', {
        call_name: name,
        agent_id: assistant.elevenLabsAgentId,
        agent_phone_number_id: phoneNumber.elevenLabsPhoneId,
        recipientCount: elevenLabsRecipients.length
      });

      const response = await axios.post(
        'https://api.elevenlabs.io/v1/convai/batch-calling/submit',
        batchPayload,
        {
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ 11Labs batch call created:', response.data);

      // Update batch call with 11Labs ID
      await prisma.batchCall.update({
        where: { id: batchCall.id },
        data: {
          elevenLabsBatchId: response.data.batch_id,
          status: scheduledAt ? 'PENDING' : 'IN_PROGRESS',
          startedAt: scheduledAt ? null : new Date()
        }
      });

      res.json({
        success: true,
        batchCall: {
          ...batchCall,
          elevenLabsBatchId: response.data.batch_id
        },
        message: `Batch call created with ${recipients.length} recipients`
      });

    } catch (elevenLabsError) {
      console.error('❌ 11Labs batch call error:', elevenLabsError.response?.data || elevenLabsError.message);

      // Mark batch call as failed
      await prisma.batchCall.update({
        where: { id: batchCall.id },
        data: { status: 'FAILED' }
      });

      return res.status(500).json({
        error: 'Failed to submit batch call to 11Labs',
        details: elevenLabsError.response?.data || elevenLabsError.message
      });
    }

  } catch (error) {
    console.error('Create batch call error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create batch call'
    });
  }
});

/**
 * GET /api/batch-calls
 * List all batch calls for the business
 */
router.get('/', checkPermission('campaigns:view'), async (req, res) => {
  try {
    const businessId = req.businessId;

    // Check plan access
    const hasAccess = await checkBatchCallAccess(businessId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Batch calling is only available for Professional and Enterprise plans',
        errorTR: 'Toplu arama özelliği sadece Profesyonel ve Kurumsal planlarda kullanılabilir',
        upgrade: true
      });
    }

    const batchCalls = await prisma.batchCall.findMany({
      where: { businessId },
      include: {
        assistant: {
          select: { id: true, name: true }
        },
        phoneNumber: {
          select: { id: true, phoneNumber: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch status updates from 11Labs for in-progress campaigns
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    const updatedBatchCalls = await Promise.all(
      batchCalls.map(async (batch) => {
        // Check status for both PENDING and IN_PROGRESS batches
        if (batch.elevenLabsBatchId && (batch.status === 'IN_PROGRESS' || batch.status === 'PENDING')) {
          try {
            const response = await axios.get(
              `https://api.elevenlabs.io/v1/convai/batch-calling/${batch.elevenLabsBatchId}`,
              {
                headers: { 'xi-api-key': elevenLabsApiKey }
              }
            );

            const elevenLabsData = response.data;
            console.log(`📊 11Labs batch ${batch.id} status:`, elevenLabsData.status,
              `dispatched: ${elevenLabsData.total_calls_dispatched}/${elevenLabsData.total_calls_scheduled}`);

            // Update local status based on 11Labs status
            // 11Labs can return: pending, in_progress, completed, done, failed, cancelled
            let newStatus = batch.status;

            // Check if all calls are done (dispatched == scheduled and status shows completion)
            const allCallsDone = elevenLabsData.total_calls_dispatched === elevenLabsData.total_calls_scheduled
              && elevenLabsData.total_calls_dispatched > 0;

            if (elevenLabsData.status === 'completed' || elevenLabsData.status === 'done' ||
                (allCallsDone && elevenLabsData.status !== 'pending')) {
              newStatus = 'COMPLETED';
            } else if (elevenLabsData.status === 'in_progress' || elevenLabsData.total_calls_dispatched > 0) {
              newStatus = 'IN_PROGRESS';
            } else if (elevenLabsData.status === 'failed') {
              newStatus = 'FAILED';
            } else if (elevenLabsData.status === 'cancelled') {
              newStatus = 'CANCELLED';
            }

            // Update in database if status changed
            if (newStatus !== batch.status) {
              await prisma.batchCall.update({
                where: { id: batch.id },
                data: {
                  status: newStatus,
                  completedCalls: elevenLabsData.completed_calls || 0,
                  successfulCalls: elevenLabsData.successful_calls || 0,
                  failedCalls: elevenLabsData.failed_calls || 0,
                  ...(newStatus === 'COMPLETED' && { completedAt: new Date() })
                }
              });
            }

            return {
              ...batch,
              status: newStatus,
              completedCalls: elevenLabsData.completed_calls || batch.completedCalls,
              successfulCalls: elevenLabsData.successful_calls || batch.successfulCalls,
              failedCalls: elevenLabsData.failed_calls || batch.failedCalls
            };
          } catch (error) {
            console.error(`Failed to fetch 11Labs status for batch ${batch.id}:`, error.message);
            return batch;
          }
        }
        return batch;
      })
    );

    // Remove recipients from list response (too large)
    const cleanedBatchCalls = updatedBatchCalls.map(({ recipients, columnMapping, ...rest }) => rest);

    res.json({ batchCalls: cleanedBatchCalls });

  } catch (error) {
    console.error('List batch calls error:', error);
    res.status(500).json({ error: 'Failed to fetch batch calls' });
  }
});

/**
 * GET /api/batch-calls/:id
 * Get details of a specific batch call
 */
router.get('/:id', checkPermission('campaigns:view'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const batchCall = await prisma.batchCall.findFirst({
      where: {
        id,
        businessId
      },
      include: {
        assistant: {
          select: { id: true, name: true }
        },
        phoneNumber: {
          select: { id: true, phoneNumber: true }
        }
      }
    });

    if (!batchCall) {
      return res.status(404).json({ error: 'Batch call not found' });
    }

    // Fetch detailed status from 11Labs
    let callDetails = [];
    if (batchCall.elevenLabsBatchId) {
      try {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        const response = await axios.get(
          `https://api.elevenlabs.io/v1/convai/batch-calling/${batchCall.elevenLabsBatchId}`,
          {
            headers: { 'xi-api-key': elevenLabsApiKey }
          }
        );

        callDetails = response.data.recipients || [];
        const elevenLabsData = response.data;
        console.log(`📊 11Labs batch ${batchCall.id} detail status:`, elevenLabsData.status,
          `dispatched: ${elevenLabsData.total_calls_dispatched}/${elevenLabsData.total_calls_scheduled}`);

        // Update local status
        // 11Labs can return: pending, in_progress, completed, done, failed, cancelled
        let newStatus = batchCall.status;

        // Check if all calls are done
        const allCallsDone = elevenLabsData.total_calls_dispatched === elevenLabsData.total_calls_scheduled
          && elevenLabsData.total_calls_dispatched > 0;

        if (elevenLabsData.status === 'completed' || elevenLabsData.status === 'done' ||
            (allCallsDone && elevenLabsData.status !== 'pending')) {
          newStatus = 'COMPLETED';
        } else if (elevenLabsData.status === 'in_progress' || elevenLabsData.total_calls_dispatched > 0) {
          newStatus = 'IN_PROGRESS';
        } else if (elevenLabsData.status === 'failed') {
          newStatus = 'FAILED';
        } else if (elevenLabsData.status === 'cancelled') {
          newStatus = 'CANCELLED';
        }

        if (newStatus !== batchCall.status) {
          await prisma.batchCall.update({
            where: { id: batchCall.id },
            data: {
              status: newStatus,
              completedCalls: response.data.completed_calls || 0,
              successfulCalls: response.data.successful_calls || 0,
              failedCalls: response.data.failed_calls || 0,
              ...(newStatus === 'COMPLETED' && { completedAt: new Date() })
            }
          });
          batchCall.status = newStatus;
          batchCall.completedCalls = response.data.completed_calls || 0;
          batchCall.successfulCalls = response.data.successful_calls || 0;
          batchCall.failedCalls = response.data.failed_calls || 0;
        }
      } catch (error) {
        console.error('Failed to fetch 11Labs batch details:', error.message);
      }
    }

    // Parse recipients
    let recipients = [];
    try {
      recipients = JSON.parse(batchCall.recipients || '[]');
    } catch (e) {}

    // Merge recipients with call details
    const enrichedRecipients = recipients.map((recipient, index) => {
      const callDetail = callDetails.find(c => c.phone_number === recipient.phone_number) || {};
      return {
        ...recipient,
        status: callDetail.status || 'pending',
        duration: callDetail.duration || null,
        conversationId: callDetail.conversation_id || null
      };
    });

    res.json({
      batchCall: {
        ...batchCall,
        recipients: enrichedRecipients
      }
    });

  } catch (error) {
    console.error('Get batch call error:', error);
    res.status(500).json({ error: 'Failed to fetch batch call details' });
  }
});

/**
 * POST /api/batch-calls/:id/cancel
 * Cancel a batch call campaign
 */
router.post('/:id/cancel', checkPermission('campaigns:view'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const batchCall = await prisma.batchCall.findFirst({
      where: {
        id,
        businessId
      }
    });

    if (!batchCall) {
      return res.status(404).json({ error: 'Batch call not found' });
    }

    if (batchCall.status !== 'PENDING' && batchCall.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'Can only cancel pending or in-progress campaigns',
        errorTR: 'Sadece bekleyen veya devam eden kampanyalar iptal edilebilir'
      });
    }

    // Cancel in 11Labs
    if (batchCall.elevenLabsBatchId) {
      try {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        await axios.delete(
          `https://api.elevenlabs.io/v1/convai/batch-calling/${batchCall.elevenLabsBatchId}`,
          {
            headers: { 'xi-api-key': elevenLabsApiKey }
          }
        );
        console.log('✅ 11Labs batch call cancelled:', batchCall.elevenLabsBatchId);
      } catch (error) {
        console.error('Failed to cancel in 11Labs:', error.message);
        // Continue anyway to update local status
      }
    }

    // Update local status
    await prisma.batchCall.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      message: 'Batch call cancelled'
    });

  } catch (error) {
    console.error('Cancel batch call error:', error);
    res.status(500).json({ error: 'Failed to cancel batch call' });
  }
});

export default router;
