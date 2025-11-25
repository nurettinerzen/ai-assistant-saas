import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

// GET /api/knowledge/documents
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    const documents = await prisma.knowledgeBase.findMany({
      where: { 
        businessId,
        type: 'DOCUMENT'
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
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

    // Update document with extracted content
    await prisma.knowledgeBase.update({
      where: { id: documentId },
      data: {
        content,
        status: 'ACTIVE'
      }
    });

    console.log(`✅ Document ${documentId} processed successfully`);
    
    // TODO: Sync with VAPI assistant's knowledge base
    // This would require VAPI's knowledge base API endpoint
    
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
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
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
    
    const faqs = await prisma.knowledgeBase.findMany({
      where: { 
        businessId,
        type: 'FAQ'
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ faqs });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
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

    const faq = await prisma.knowledgeBase.create({
      data: {
        businessId,
        type: 'FAQ',
        title: question.substring(0, 100), // Use first 100 chars as title
        question,
        answer,
        category,
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

// GET /api/knowledge/urls
router.get('/urls', authenticateToken, async (req, res) => {
  try {
    res.json({ urls: [] });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ error: 'Failed to fetch URLs' });
  }
});

// POST /api/knowledge/urls
router.post('/urls', authenticateToken, async (req, res) => {
  try {
    const { url, crawlDepth } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // TODO: Save to database and start crawling
    const urlEntry = {
      id: Date.now(),
      url,
      crawlDepth: crawlDepth || 1,
      status: 'crawling',
      pageCount: 0,
      lastCrawled: null,
      createdAt: new Date()
    };

    res.json({ url: urlEntry, message: 'URL added successfully' });
  } catch (error) {
    console.error('Error adding URL:', error);
    res.status(500).json({ error: 'Failed to add URL' });
  }
});

// DELETE /api/knowledge/urls/:id
router.delete('/urls/:id', authenticateToken, async (req, res) => {
  try {
    // TODO: Delete from database
    res.json({ message: 'URL deleted' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ error: 'Failed to delete URL' });
  }
});

export default router;