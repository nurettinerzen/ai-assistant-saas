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

// POST /api/knowledge/documents - Upload document
router.post('/documents', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // TODO: Save to database and process file
    const document = {
      id: Date.now(),
      name: req.file.originalname,
      type: path.extname(req.file.originalname).slice(1).toUpperCase(),
      size: req.file.size,
      status: 'processing',
      uploadedAt: new Date(),
      path: req.file.path
    };

    console.log('Document uploaded:', document);
    res.json({ document, message: 'Document uploaded successfully' });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE /api/knowledge/documents/:id
router.delete('/documents/:id', authenticateToken, async (req, res) => {
  try {
    // TODO: Delete from database
    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/knowledge/faqs
router.get('/faqs', authenticateToken, async (req, res) => {
  try {
    res.json({ faqs: [] });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// POST /api/knowledge/faqs
router.post('/faqs', authenticateToken, async (req, res) => {
  try {
    const { question, answer, category } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    // TODO: Save to database
    const faq = {
      id: Date.now(),
      question,
      answer,
      category,
      createdAt: new Date()
    };

    res.json({ faq, message: 'FAQ created successfully' });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

// DELETE /api/knowledge/faqs/:id
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    // TODO: Delete from database
    res.json({ message: 'FAQ deleted' });
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