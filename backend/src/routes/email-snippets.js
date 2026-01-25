import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getBusinessSnippets,
  getSnippetById,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  extractVariablesFromTemplate
} from '../core/email/rag/snippetService.js';

const router = express.Router();

/**
 * GET /api/email-snippets
 * Get all snippets for the business
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const snippets = await getBusinessSnippets(req.user.businessId);
    res.json({ success: true, snippets });
  } catch (error) {
    console.error('Error fetching snippets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/email-snippets/:id
 * Get a single snippet
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const snippet = await getSnippetById(req.params.id);

    if (!snippet) {
      return res.status(404).json({ success: false, error: 'Snippet not found' });
    }

    // Verify business ownership
    if (snippet.businessId !== req.user.businessId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, snippet });
  } catch (error) {
    console.error('Error fetching snippet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email-snippets
 * Create a new snippet
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      intent,
      language,
      tone,
      urgency,
      subject,
      body,
      variables,
      optionalVars
    } = req.body;

    // Validate required fields
    if (!name || !intent || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, intent, body'
      });
    }

    // Extract variables from body if not provided
    const extractedVars = extractVariablesFromTemplate(body);

    const snippet = await createSnippet({
      businessId: req.user.businessId,
      name,
      intent: intent.toUpperCase(),
      language: language || 'TR',
      tone: tone || 'professional',
      urgency: urgency?.toUpperCase(),
      subject,
      body,
      variables: variables || extractedVars,
      optionalVars: optionalVars || [],
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, snippet });
  } catch (error) {
    console.error('Error creating snippet:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A snippet with this name already exists'
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/email-snippets/:id
 * Update a snippet
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Verify ownership first
    const existing = await getSnippetById(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Snippet not found' });
    }

    if (existing.businessId !== req.user.businessId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const {
      name,
      intent,
      language,
      tone,
      urgency,
      subject,
      body,
      variables,
      optionalVars,
      enabled
    } = req.body;

    // Build update object
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (intent !== undefined) updates.intent = intent.toUpperCase();
    if (language !== undefined) updates.language = language;
    if (tone !== undefined) updates.tone = tone;
    if (urgency !== undefined) updates.urgency = urgency?.toUpperCase();
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) {
      updates.body = body;
      // Re-extract variables if body changed
      if (variables === undefined) {
        updates.variables = extractVariablesFromTemplate(body);
      }
    }
    if (variables !== undefined) updates.variables = variables;
    if (optionalVars !== undefined) updates.optionalVars = optionalVars;
    if (enabled !== undefined) updates.enabled = enabled;

    const snippet = await updateSnippet(req.params.id, updates);

    res.json({ success: true, snippet });
  } catch (error) {
    console.error('Error updating snippet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/email-snippets/:id
 * Delete a snippet
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Verify ownership first
    const existing = await getSnippetById(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Snippet not found' });
    }

    if (existing.businessId !== req.user.businessId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await deleteSnippet(req.params.id);

    res.json({ success: true, message: 'Snippet deleted' });
  } catch (error) {
    console.error('Error deleting snippet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email-snippets/preview
 * Preview a snippet with variables
 */
router.post('/preview', authenticateToken, async (req, res) => {
  try {
    const { body, variables } = req.body;

    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: body'
      });
    }

    // Extract variables from template
    const requiredVars = extractVariablesFromTemplate(body);

    // Apply provided variables
    let preview = body;
    for (const [varName, value] of Object.entries(variables || {})) {
      const pattern = new RegExp(`\\{${varName}\\}`, 'gi');
      preview = preview.replace(pattern, value);
    }

    // Find missing variables
    const missingVars = requiredVars.filter(v => {
      const pattern = new RegExp(`\\{${v}\\}`, 'gi');
      return pattern.test(preview);
    });

    res.json({
      success: true,
      preview,
      requiredVars,
      missingVars,
      providedVars: Object.keys(variables || {})
    });
  } catch (error) {
    console.error('Error previewing snippet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
