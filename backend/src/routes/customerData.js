import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import multer from 'multer';
import XLSX from 'xlsx';

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
 * Normalize phone number for consistent matching
 * Removes all formatting, keeps only digits
 * Returns normalized format for comparison
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-numeric characters except +
  let cleaned = String(phone).replace(/[^\d+]/g, '');

  // Remove leading + if exists
  cleaned = cleaned.replace(/^\+/, '');

  // Handle Turkish numbers
  if (cleaned.startsWith('90') && cleaned.length >= 12) {
    // Already has country code (905XXXXXXXXX)
    return cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Turkish number with leading 0 (05XXXXXXXXX) -> 905XXXXXXXXX
    return '90' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('5')) {
    // Turkish mobile without prefix (5XXXXXXXXX) -> 905XXXXXXXXX
    return '90' + cleaned;
  }

  // Return as-is for other formats
  return cleaned || null;
}

/**
 * Parse CSV/Excel file and return rows
 * Uses UTF-8 encoding to preserve Turkish characters
 */
function parseFile(buffer, filename) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    codepage: 65001,  // UTF-8 encoding for Turkish characters
    raw: false
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false
  });

  if (data.length === 0) {
    throw new Error('File is empty or has no data rows');
  }

  const columns = Object.keys(data[0]);

  return { data, columns };
}

/**
 * Parse monetary value (handles Turkish formatting)
 * Examples: "15.750,00", "15750.00", "15750", "15.750 TL"
 */
function parseMoneyValue(value) {
  if (!value) return null;

  let cleaned = String(value)
    .replace(/[TL₺\s]/gi, '')  // Remove currency symbols
    .trim();

  // Handle Turkish format (15.750,00) vs US format (15,750.00)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine format by position
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Turkish format: 15.750,00 -> 15750.00
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 15,750.00 -> 15750.00
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma: could be decimal separator (15,50) or thousand (15,750)
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal separator: 15,50 -> 15.50
      cleaned = cleaned.replace(',', '.');
    } else {
      // Thousand separator: 15,750 -> 15750
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse date value (handles multiple formats)
 * Examples: "15.01.2025", "15/01/2025", "2025-01-15"
 */
function parseDateValue(value) {
  if (!value) return null;

  const str = String(value).trim();

  // Try DD.MM.YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try JS Date parsing as fallback
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;

  return null;
}

// ============================================================
// ROUTES
// ============================================================

router.use(authenticateToken);

/**
 * GET /api/customer-data/template
 * Download Excel template for customer data import
 */
router.get('/template', async (req, res) => {
  try {
    // Create sample data with all supported columns
    const sampleData = [
      {
        'İşletme/Müşteri Adı': 'ABC Ticaret Ltd. Şti.',
        'Yetkili': 'Ahmet Yılmaz',
        'Telefon': '5321234567',
        'Email': 'ahmet@abc.com',
        'VKN': '1234567890',
        'TC No': '',
        'SGK Borcu': '15750.00',
        'SGK Vadesi': '15.01.2025',
        'Vergi Borcu': '8320.00',
        'Vergi Vadesi': '26.01.2025',
        'Diğer Borç': '',
        'Diğer Borç Açıklama': '',
        'Beyanname Türü': 'KDV',
        'Beyanname Dönemi': '2024/12',
        'Beyanname Tarihi': '26.01.2025',
        'Beyanname Durumu': 'Bekliyor',
        'Notlar': 'Önemli müşteri',
        'Etiketler': 'VIP, Kurumsal'
      },
      {
        'İşletme/Müşteri Adı': 'XYZ İnşaat A.Ş.',
        'Yetkili': 'Mehmet Demir',
        'Telefon': '+905331234568',
        'Email': 'mehmet@xyz.com',
        'VKN': '9876543210',
        'TC No': '',
        'SGK Borcu': '25000.00',
        'SGK Vadesi': '20.01.2025',
        'Vergi Borcu': '12500.00',
        'Vergi Vadesi': '26.01.2025',
        'Diğer Borç': '5000.00',
        'Diğer Borç Açıklama': 'Danışmanlık ücreti',
        'Beyanname Türü': 'Muhtasar',
        'Beyanname Dönemi': '2024/12',
        'Beyanname Tarihi': '26.01.2025',
        'Beyanname Durumu': 'Verildi',
        'Notlar': '',
        'Etiketler': 'Kurumsal'
      }
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // İşletme/Müşteri Adı
      { wch: 18 }, // Yetkili
      { wch: 15 }, // Telefon
      { wch: 22 }, // Email
      { wch: 12 }, // VKN
      { wch: 12 }, // TC No
      { wch: 12 }, // SGK Borcu
      { wch: 12 }, // SGK Vadesi
      { wch: 12 }, // Vergi Borcu
      { wch: 12 }, // Vergi Vadesi
      { wch: 12 }, // Diğer Borç
      { wch: 20 }, // Diğer Borç Açıklama
      { wch: 15 }, // Beyanname Türü
      { wch: 15 }, // Beyanname Dönemi
      { wch: 15 }, // Beyanname Tarihi
      { wch: 15 }, // Beyanname Durumu
      { wch: 25 }, // Notlar
      { wch: 20 }, // Etiketler
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Müşteri Verileri');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=musteri-verileri-sablon.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

/**
 * POST /api/customer-data/parse
 * Upload and parse file, return columns and preview data
 */
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
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
 * POST /api/customer-data/import
 * Import customer data from Excel/CSV file
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const businessId = req.businessId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { columnMapping } = req.body;

    // Parse file
    const { data } = parseFile(req.file.buffer, req.file.originalname);

    // Parse column mapping
    let mapping = {};
    try {
      mapping = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping || {};
    } catch (e) {
      console.error('Column mapping parse error:', e);
    }

    // Default column mappings (Turkish headers)
    const defaultMapping = {
      companyName: ['İşletme/Müşteri Adı', 'Müşteri Adı', 'İşletme Adı', 'Firma', 'Company', 'companyName'],
      contactName: ['Yetkili', 'Yetkili Kişi', 'Contact', 'contactName'],
      phone: ['Telefon', 'Tel', 'Phone', 'phone'],
      email: ['Email', 'E-mail', 'E-posta', 'email'],
      vkn: ['VKN', 'Vergi Kimlik No', 'vkn'],
      tcNo: ['TC No', 'TC Kimlik No', 'TC', 'tcNo'],
      sgkDebt: ['SGK Borcu', 'SGK', 'sgkDebt'],
      sgkDueDate: ['SGK Vadesi', 'SGK Vade', 'sgkDueDate'],
      taxDebt: ['Vergi Borcu', 'Vergi', 'taxDebt'],
      taxDueDate: ['Vergi Vadesi', 'Vergi Vade', 'taxDueDate'],
      otherDebt: ['Diğer Borç', 'Diğer', 'otherDebt'],
      otherDebtNote: ['Diğer Borç Açıklama', 'otherDebtNote'],
      declarationType: ['Beyanname Türü', 'declarationType'],
      declarationPeriod: ['Beyanname Dönemi', 'declarationPeriod'],
      declarationDueDate: ['Beyanname Tarihi', 'Beyanname Son Tarih', 'declarationDueDate'],
      declarationStatus: ['Beyanname Durumu', 'declarationStatus'],
      notes: ['Notlar', 'Not', 'Notes', 'notes'],
      tags: ['Etiketler', 'Tags', 'tags']
    };

    // Helper to find column value
    const findValue = (row, fieldName) => {
      // First check explicit mapping
      if (mapping[fieldName]) {
        return row[mapping[fieldName]] || null;
      }

      // Then try default mappings
      const possibleNames = defaultMapping[fieldName] || [];
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== '') {
          return row[name];
        }
      }

      return null;
    };

    const results = {
      success: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      try {
        // Get required fields
        const companyName = findValue(row, 'companyName');
        const rawPhone = findValue(row, 'phone');

        if (!companyName) {
          results.failed++;
          results.errors.push({ row: rowNum, error: 'İşletme/Müşteri adı zorunludur' });
          continue;
        }

        if (!rawPhone) {
          results.failed++;
          results.errors.push({ row: rowNum, error: 'Telefon numarası zorunludur' });
          continue;
        }

        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (!normalizedPhone) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Geçersiz telefon numarası: ${rawPhone}` });
          continue;
        }

        // Build custom fields JSON
        const customFields = {};

        // Financial data
        const sgkDebt = parseMoneyValue(findValue(row, 'sgkDebt'));
        if (sgkDebt !== null) customFields.sgkDebt = sgkDebt;

        const sgkDueDate = parseDateValue(findValue(row, 'sgkDueDate'));
        if (sgkDueDate) customFields.sgkDueDate = sgkDueDate.toISOString();

        const taxDebt = parseMoneyValue(findValue(row, 'taxDebt'));
        if (taxDebt !== null) customFields.taxDebt = taxDebt;

        const taxDueDate = parseDateValue(findValue(row, 'taxDueDate'));
        if (taxDueDate) customFields.taxDueDate = taxDueDate.toISOString();

        const otherDebt = parseMoneyValue(findValue(row, 'otherDebt'));
        if (otherDebt !== null) customFields.otherDebt = otherDebt;

        const otherDebtNote = findValue(row, 'otherDebtNote');
        if (otherDebtNote) customFields.otherDebtNote = otherDebtNote;

        // Declaration data
        const declarationType = findValue(row, 'declarationType');
        if (declarationType) customFields.declarationType = declarationType;

        const declarationPeriod = findValue(row, 'declarationPeriod');
        if (declarationPeriod) customFields.declarationPeriod = declarationPeriod;

        const declarationDueDate = parseDateValue(findValue(row, 'declarationDueDate'));
        if (declarationDueDate) customFields.declarationDueDate = declarationDueDate.toISOString();

        const declarationStatus = findValue(row, 'declarationStatus');
        if (declarationStatus) customFields.declarationStatus = declarationStatus;

        // Parse tags
        const tagsRaw = findValue(row, 'tags');
        let tags = [];
        if (tagsRaw) {
          tags = String(tagsRaw).split(/[,;]/).map(t => t.trim()).filter(t => t);
        }

        // Build customer data object
        const customerDataObj = {
          companyName: String(companyName).trim(),
          phone: normalizedPhone,
          contactName: findValue(row, 'contactName') || null,
          email: findValue(row, 'email') || null,
          vkn: findValue(row, 'vkn') || null,
          tcNo: findValue(row, 'tcNo') || null,
          notes: findValue(row, 'notes') || null,
          tags,
          customFields: Object.keys(customFields).length > 0 ? customFields : null
        };

        // Upsert - update if phone exists, create otherwise
        const existing = await prisma.customerData.findUnique({
          where: {
            businessId_phone: {
              businessId,
              phone: normalizedPhone
            }
          }
        });

        if (existing) {
          await prisma.customerData.update({
            where: { id: existing.id },
            data: customerDataObj
          });
          results.updated++;
        } else {
          await prisma.customerData.create({
            data: {
              businessId,
              ...customerDataObj
            }
          });
          results.success++;
        }

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        results.failed++;
        results.errors.push({ row: rowNum, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Import completed: ${results.success} created, ${results.updated} updated, ${results.failed} failed`,
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: error.message || 'Failed to import customer data'
    });
  }
});

/**
 * GET /api/customer-data
 * List all customer data for the business with pagination
 */
router.get('/', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { page = 1, limit = 50, search, tag } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = { businessId };

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { vkn: { contains: search } }
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [customerData, total] = await Promise.all([
      prisma.customerData.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.customerData.count({ where })
    ]);

    res.json({
      customerData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / take)
      }
    });

  } catch (error) {
    console.error('List customer data error:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

/**
 * GET /api/customer-data/lookup
 * Lookup customer by phone number (for AI assistant)
 */
router.get('/lookup', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const customer = await prisma.customerData.findUnique({
      where: {
        businessId_phone: {
          businessId,
          phone: normalizedPhone
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        errorTR: 'Müşteri bulunamadı'
      });
    }

    res.json({ customer });

  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
});

/**
 * GET /api/customer-data/:id
 * Get a single customer data record
 */
router.get('/:id', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const customer = await prisma.customerData.findFirst({
      where: { id, businessId }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

/**
 * POST /api/customer-data
 * Create a new customer data record
 */
router.post('/', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { companyName, phone, contactName, email, vkn, tcNo, notes, tags, customFields } = req.body;

    if (!companyName || !phone) {
      return res.status(400).json({
        error: 'Company name and phone are required',
        errorTR: 'İşletme adı ve telefon zorunludur'
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if phone already exists
    const existing = await prisma.customerData.findUnique({
      where: {
        businessId_phone: {
          businessId,
          phone: normalizedPhone
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'A customer with this phone number already exists',
        errorTR: 'Bu telefon numarasına sahip müşteri zaten mevcut'
      });
    }

    const customer = await prisma.customerData.create({
      data: {
        businessId,
        companyName,
        phone: normalizedPhone,
        contactName,
        email,
        vkn,
        tcNo,
        notes,
        tags: tags || [],
        customFields: customFields || null
      }
    });

    res.status(201).json({ customer });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * PUT /api/customer-data/:id
 * Update a customer data record
 */
router.put('/:id', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { companyName, phone, contactName, email, vkn, tcNo, notes, tags, customFields } = req.body;

    // Check if customer exists
    const existing = await prisma.customerData.findFirst({
      where: { id, businessId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // If phone is being changed, check for duplicates
    let normalizedPhone = existing.phone;
    if (phone && phone !== existing.phone) {
      normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      const duplicate = await prisma.customerData.findUnique({
        where: {
          businessId_phone: {
            businessId,
            phone: normalizedPhone
          }
        }
      });

      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({
          error: 'A customer with this phone number already exists',
          errorTR: 'Bu telefon numarasına sahip başka bir müşteri mevcut'
        });
      }
    }

    const customer = await prisma.customerData.update({
      where: { id },
      data: {
        companyName: companyName || existing.companyName,
        phone: normalizedPhone,
        contactName: contactName !== undefined ? contactName : existing.contactName,
        email: email !== undefined ? email : existing.email,
        vkn: vkn !== undefined ? vkn : existing.vkn,
        tcNo: tcNo !== undefined ? tcNo : existing.tcNo,
        notes: notes !== undefined ? notes : existing.notes,
        tags: tags !== undefined ? tags : existing.tags,
        customFields: customFields !== undefined ? customFields : existing.customFields
      }
    });

    res.json({ customer });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * DELETE /api/customer-data/bulk
 * Delete multiple customer data records
 * NOTE: This route MUST be before /:id to avoid "bulk" being matched as an ID
 */
router.delete('/bulk', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const result = await prisma.customerData.deleteMany({
      where: {
        id: { in: ids },
        businessId
      }
    });

    res.json({
      success: true,
      message: `${result.count} customers deleted`,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete customers' });
  }
});

/**
 * DELETE /api/customer-data/:id
 * Delete a customer data record
 */
router.delete('/:id', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const existing = await prisma.customerData.findFirst({
      where: { id, businessId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await prisma.customerData.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Customer deleted' });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

/**
 * GET /api/customer-data/tags
 * Get all unique tags used by this business
 */
router.get('/tags/list', async (req, res) => {
  try {
    const businessId = req.businessId;

    const customers = await prisma.customerData.findMany({
      where: { businessId },
      select: { tags: true }
    });

    // Extract unique tags
    const tagSet = new Set();
    customers.forEach(c => {
      if (c.tags && Array.isArray(c.tags)) {
        c.tags.forEach(tag => tagSet.add(tag));
      }
    });

    res.json({ tags: Array.from(tagSet).sort() });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;
