import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
import vapiKnowledgeService from '../services/vapiKnowledge.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = express.Router();
const prisma = new PrismaClient();

// ES modules için __dirname alternatifi
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, and CSV are allowed.'));
    }
  }
});

// GET /api/knowledge - Get all knowledge base items (documents, faqs, urls)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    // Return empty structure if no businessId
    if (!businessId) {
      return res.json({ documents: [], faqs: [], urls: [] });
    }

    let documents = [];
    let faqs = [];
    let urls = [];

    try {
      [documents, faqs, urls] = await Promise.all([
        prisma.knowledgeBase.findMany({
          where: { businessId, type: 'DOCUMENT' },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.knowledgeBase.findMany({
          where: { businessId, type: 'FAQ' },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.knowledgeBase.findMany({
          where: { businessId, type: 'URL' },
          orderBy: { createdAt: 'desc' }
        })
      ]);
    } catch (dbError) {
      console.log('KnowledgeBase query error, returning empty arrays:', dbError.message);
    }

    res.json({ documents, faqs, urls });
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    // Return empty arrays instead of error for better UX
    res.json({ documents: [], faqs: [], urls: [] });
  }
});

// GET /api/knowledge/documents
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    // Try to fetch documents, return empty array if table doesn't exist yet
    try {
      const documents = await prisma.knowledgeBase.findMany({
        where: { 
          businessId,
          type: 'DOCUMENT'
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ documents });
    } catch (dbError) {
      console.log('KnowledgeBase table may not exist yet, returning empty array');
      res.json({ documents: [] });
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.json({ documents: [] }); // Return empty array instead of error
  }
});

// Helper function to extract text from PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Helper function to extract text from DOCX
async function extractTextFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

// Helper function to extract text from TXT/CSV
async function extractTextFromTXT(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error('TXT reading error:', error);
    throw new Error('Failed to read text file');
  }
}

// POST /api/knowledge/documents - Upload document
router.post('/documents', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const businessId = req.businessId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Create initial database entry
    const document = await prisma.knowledgeBase.create({
      data: {
        businessId,
        type: 'DOCUMENT',
        title: req.file.originalname,
        fileName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path,
        status: 'PROCESSING'
      }
    });

    // Process file asynchronously
    processDocument(document.id, req.file.path, ext, businessId).catch(error => {
      console.error('Document processing failed:', error);
    });

    res.json({ 
      document, 
      message: 'Document uploaded and processing started' 
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Async function to process document
async function processDocument(documentId, filePath, ext, businessId) {
  try {
    let content = '';
    
    // Extract text based on file type
    switch (ext) {
      case '.pdf':
        content = await extractTextFromPDF(filePath);
        break;
      case '.docx':
        content = await extractTextFromDOCX(filePath);
        break;
      case '.txt':
      case '.csv':
        content = await extractTextFromTXT(filePath);
        break;
      default:
        throw new Error('Unsupported file type');
    }

    // Get business assistant ID
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { vapiAssistantId: true }
    });

    let vapiKnowledgeId = null;

    // Upload to VAPI if assistant exists
    if (business?.vapiAssistantId) {
      try {
        const document = await prisma.knowledgeBase.findUnique({
          where: { id: documentId }
        });
        const vapiResponse = await vapiKnowledgeService.uploadText(
          business.vapiAssistantId,
          document.title,
          content
        );
        vapiKnowledgeId = vapiResponse.id;
        console.log(`✅ Uploaded to VAPI knowledge base: ${vapiKnowledgeId}`);
      } catch (vapiError) {
        console.error('VAPI upload failed:', vapiError);
        // Continue even if VAPI fails
      }
    }

    // Update document with extracted content
    await prisma.knowledgeBase.update({
      where: { id: documentId },
      data: {
        content,
        vapiKnowledgeId,
        status: 'ACTIVE'
      }
    });

    console.log(`✅ Document ${documentId} processed successfully`);
    
  } catch (error) {
    console.error(`❌ Document ${documentId} processing failed:`, error);
    
    // Mark as failed
    await prisma.knowledgeBase.update({
      where: { id: documentId },
      data: { status: 'FAILED' }
    });
  }
}

// DELETE /api/knowledge/documents/:id
router.delete('/documents/:id', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    // Find document
    const document = await prisma.knowledgeBase.findFirst({
      where: { 
        id,
        businessId,
        type: 'DOCUMENT'
      },
      include: { business: { select: { vapiAssistantId: true } } }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from VAPI if exists
    if (document.vapiKnowledgeId && document.business?.vapiAssistantId) {
      try {
        await vapiKnowledgeService.deleteKnowledge(
          document.business.vapiAssistantId,
          document.vapiKnowledgeId
        );
        console.log(`✅ Deleted from VAPI: ${document.vapiKnowledgeId}`);
      } catch (vapiError) {
        console.error('VAPI delete failed:', vapiError);
      }
    }

    // Delete file from filesystem
    if (document.filePath) {
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }

    // Delete from database
    await prisma.knowledgeBase.delete({
      where: { id }
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/knowledge/faqs
router.get('/faqs', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    try {
      const faqs = await prisma.knowledgeBase.findMany({
        where: { 
          businessId,
          type: 'FAQ'
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ faqs });
    } catch (dbError) {
      console.log('KnowledgeBase table may not exist yet, returning empty array');
      res.json({ faqs: [] });
    }
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.json({ faqs: [] });
  }
});

// POST /api/knowledge/faqs
router.post('/faqs', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { question, answer, category } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    // Get business assistant ID
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { vapiAssistantId: true }
    });

    let vapiKnowledgeId = null;

    // Upload to VAPI if assistant exists
    if (business?.vapiAssistantId) {
      try {
        const content = `Q: ${question}\nA: ${answer}`;
        const vapiResponse = await vapiKnowledgeService.uploadText(
          business.vapiAssistantId,
          `FAQ: ${question.substring(0, 50)}...`,
          content
        );
        vapiKnowledgeId = vapiResponse.id;
        console.log(`✅ FAQ uploaded to VAPI: ${vapiKnowledgeId}`);
      } catch (vapiError) {
        console.error('VAPI upload failed:', vapiError);
      }
    }

    const faq = await prisma.knowledgeBase.create({
      data: {
        businessId,
        type: 'FAQ',
        title: question.substring(0, 100),
        question,
        answer,
        category,
        vapiKnowledgeId,
        status: 'ACTIVE'
      }
    });

    res.json({ faq, message: 'FAQ created successfully' });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

// DELETE /api/knowledge/faqs/:id
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const faq = await prisma.knowledgeBase.findFirst({
      where: { 
        id,
        businessId,
        type: 'FAQ'
      }
    });

    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    await prisma.knowledgeBase.delete({
      where: { id }
    });

    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// Helper function to scrape URL content
async function scrapeURL(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TelyxBot/1.0)'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, header, footer, aside').remove();
    
    // Extract text content
    const title = $('title').text();
    const bodyText = $('body').text().trim().replace(/\s+/g, ' ');
    
    return {
      title,
      content: bodyText,
      success: true
    };
  } catch (error) {
    console.error('URL scraping error:', error.message);
    return {
      title: url,
      content: '',
      success: false,
      error: error.message
    };
  }
}

// GET /api/knowledge/urls
router.get('/urls', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    try {
      const urls = await prisma.knowledgeBase.findMany({
        where: { 
          businessId,
          type: 'URL'
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ urls });
    } catch (dbError) {
      console.log('KnowledgeBase table may not exist yet, returning empty array');
      res.json({ urls: [] });
    }
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.json({ urls: [] });
  }
});

// POST /api/knowledge/urls
router.post('/urls', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { url, crawlDepth } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Create database entry
    const urlEntry = await prisma.knowledgeBase.create({
      data: {
        businessId,
        type: 'URL',
        title: url,
        url,
        crawlDepth: crawlDepth || 1,
        pageCount: 0,
        status: 'PROCESSING'
      }
    });

    // Start crawling asynchronously
    crawlURL(urlEntry.id, url).catch(error => {
      console.error('URL crawling failed:', error);
    });

    res.json({ url: urlEntry, message: 'URL added and crawling started' });
  } catch (error) {
    console.error('Error adding URL:', error);
    res.status(500).json({ error: 'Failed to add URL' });
  }
});

// Async function to crawl URL
async function crawlURL(entryId, url) {
  try {
    const result = await scrapeURL(url);
    
    if (result.success) {
      // Get entry to find businessId
      const entry = await prisma.knowledgeBase.findUnique({
        where: { id: entryId },
        include: { business: { select: { vapiAssistantId: true } } }
      });

      let vapiKnowledgeId = null;

      // Upload to VAPI if assistant exists
      if (entry?.business?.vapiAssistantId) {
        try {
          const vapiResponse = await vapiKnowledgeService.uploadUrl(
            entry.business.vapiAssistantId,
            url,
            result.title || url
          );
          vapiKnowledgeId = vapiResponse.id;
          console.log(`✅ URL uploaded to VAPI: ${vapiKnowledgeId}`);
        } catch (vapiError) {
          console.error('VAPI URL upload failed:', vapiError);
        }
      }

      await prisma.knowledgeBase.update({
        where: { id: entryId },
        data: {
          title: result.title || url,
          content: result.content,
          vapiKnowledgeId,
          pageCount: 1,
          lastCrawled: new Date(),
          status: 'ACTIVE'
        }
      });
      console.log(`✅ URL ${entryId} crawled successfully`);
    } else {
      await prisma.knowledgeBase.update({
        where: { id: entryId },
        data: { 
          status: 'FAILED',
          content: `Error: ${result.error}`
        }
      });
      console.log(`❌ URL ${entryId} crawling failed`);
    }
  } catch (error) {
    console.error(`❌ URL ${entryId} crawling error:`, error);
    await prisma.knowledgeBase.update({
      where: { id: entryId },
      data: { status: 'FAILED' }
    });
  }
}

// DELETE /api/knowledge/urls/:id
router.delete('/urls/:id', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const urlEntry = await prisma.knowledgeBase.findFirst({
      where: { 
        id,
        businessId,
        type: 'URL'
      }
    });

    if (!urlEntry) {
      return res.status(404).json({ error: 'URL not found' });
    }

    await prisma.knowledgeBase.delete({
      where: { id }
    });

    res.json({ message: 'URL deleted successfully' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ error: 'Failed to delete URL' });
  }
});

export default router;