import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin, requireAdminMfa } from '../middleware/adminAuth.js';
import { createLead, getLeadByResponseToken, getLeadConstants, handleLeadCtaResponse } from '../services/leadService.js';
import {
  createLeadPreviewSession,
  finishLeadPreviewSession,
  registerLeadPreviewConversation,
  LEAD_PREVIEW_MAX_DURATION_SECONDS,
  LeadPreviewError
} from '../services/leadPreviewService.js';
import { buildFrontendUrl } from '../config/runtime.js';

const router = express.Router();
const {
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_TEMPERATURE,
} = getLeadConstants();

function parseFieldData(fieldData = []) {
  const result = {};
  if (!Array.isArray(fieldData)) return result;

  for (const item of fieldData) {
    const key = String(item?.name || '').trim().toLowerCase();
    if (!key) continue;
    const values = Array.isArray(item?.values) ? item.values : [];
    result[key] = values.length <= 1 ? (values[0] ?? null) : values;
  }

  return result;
}

function pickFirst(fields, keys = []) {
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && String(fields[key]).trim() !== '') {
      return fields[key];
    }
  }
  return null;
}

function ensureLeadIngestAuthorized(req) {
  const configuredSecret = String(process.env.LEAD_INGEST_SECRET || '').trim();
  if (!configuredSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  const providedSecret = String(req.headers['x-lead-ingest-secret'] || '').trim();
  return configuredSecret.length > 0 && providedSecret === configuredSecret;
}

function buildResponseHtml({
  title,
  message,
  accent = '#006FEB',
}) {
  return `
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 16px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#051752,${accent});padding:30px 32px;color:#ffffff;">
                    <h1 style="margin:0;font-size:24px;">${title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0;font-size:16px;line-height:1.7;">${message}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function resolveLeadPreviewAssistant(lead) {
  const configuredOwnerEmail = String(
    process.env.LEAD_PREVIEW_OWNER_EMAIL ||
    process.env.PUBLIC_CONTACT_OWNER_EMAIL ||
    ''
  ).trim();
  const preferredAgentId = String(process.env.LEAD_PREVIEW_AGENT_ID || '').trim();
  const preferredAssistantName = String(process.env.LEAD_PREVIEW_ASSISTANT_NAME || '').trim();

  let previewBusinessId = null;

  if (configuredOwnerEmail) {
    const previewOwner = await prisma.user.findFirst({
      where: {
        email: {
          equals: configuredOwnerEmail,
          mode: 'insensitive'
        }
      },
      select: {
        businessId: true
      }
    });

    previewBusinessId = previewOwner?.businessId || null;
  }

  if (previewBusinessId && preferredAgentId) {
    return prisma.assistant.findFirst({
      where: {
        businessId: previewBusinessId,
        elevenLabsAgentId: preferredAgentId
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        callDirection: true,
        isActive: true
      }
    });
  }

  if (previewBusinessId && preferredAssistantName) {
    return prisma.assistant.findFirst({
      where: {
        businessId: previewBusinessId,
        isActive: true,
        elevenLabsAgentId: { not: null },
        name: {
          equals: preferredAssistantName,
          mode: 'insensitive'
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        callDirection: true,
        isActive: true
      }
    });
  }

  const candidateBusinessIds = [...new Set(
    [previewBusinessId, lead?.businessId].filter(Boolean)
  )];

  if (candidateBusinessIds.length === 0) {
    return null;
  }

  for (const businessId of candidateBusinessIds) {
    const assistant = await prisma.assistant.findFirst({
      where: {
        businessId,
        isActive: true,
        elevenLabsAgentId: { not: null }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        callDirection: true,
        isActive: true
      }
    });

    if (assistant) {
      return assistant;
    }
  }

  return null;
}

function buildLeadPreviewUrl(token) {
  return buildFrontendUrl(`/demo-preview/${encodeURIComponent(token)}`);
}

function getLeadPreviewDisplayName(previewAssistant) {
  const configuredDisplayName = String(process.env.LEAD_PREVIEW_DISPLAY_NAME || '').trim();
  return configuredDisplayName || previewAssistant?.name || 'Asistan';
}

function getLeadPreviewFirstMessage(previewAssistant) {
  const configuredFirstMessage = String(process.env.LEAD_PREVIEW_FIRST_MESSAGE || '').trim();
  if (configuredFirstMessage) {
    return configuredFirstMessage;
  }

  const assistantName = getLeadPreviewDisplayName(previewAssistant);
  return `Merhaba, ben ${assistantName}. Nasılsınız? Bugün nasılsınız?`;
}

function handleLeadPreviewError(res, error, fallbackMessage, responseMessage = 'Failed to prepare lead preview') {
  if (error instanceof LeadPreviewError) {
    return res.status(error.statusCode || 400).json({
      error: error.message,
      code: error.code || 'lead_preview_error'
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: responseMessage });
}

router.get('/respond/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const action = String(req.query.action || '').trim().toLowerCase();

    if (!['yes', 'no'].includes(action)) {
      return res.status(400).send(buildResponseHtml({
        title: 'Geçersiz işlem',
        message: 'Bu bağlantı artık geçerli değil veya eksik parametre içeriyor.',
        accent: '#ef4444',
      }));
    }

    const existingLead = await getLeadByResponseToken(token);
    if (!existingLead) {
      return res.status(404).send(buildResponseHtml({
        title: 'Lead bulunamadı',
        message: 'Bu bağlantıya ait kayıt bulunamadı.',
        accent: '#ef4444',
      }));
    }

    const result = await handleLeadCtaResponse(token, action);
    if (!result.success) {
      return res.status(400).send(buildResponseHtml({
        title: 'İşlem tamamlanamadı',
        message: 'Talebiniz işlenemedi. Lütfen daha sonra tekrar deneyin.',
        accent: '#ef4444',
      }));
    }

    if (action === 'yes') {
      return res.status(200).send(buildResponseHtml({
        title: 'Demo talebinizi aldık',
        message: 'Talebiniz ekibimize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.',
        accent: '#10b981',
      }));
    }

    return res.send(buildResponseHtml({
      title: 'Not edildi',
      message: 'Teşekkürler. Şu an ilgilenmediğinizi kaydettik.',
      accent: '#64748b',
    }));
  } catch (error) {
    console.error('Lead CTA response error:', error);
    return res.status(500).send(buildResponseHtml({
      title: 'Bir hata oluştu',
      message: 'Talebiniz işlenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
      accent: '#ef4444',
    }));
  }
});

router.post('/ingest/meta', async (req, res) => {
  try {
    if (!ensureLeadIngestAuthorized(req)) {
      return res.status(401).json({
        error: 'Unauthorized lead ingest request'
      });
    }

    const payload = req.body || {};
    const parsedFields = parseFieldData(payload.field_data || payload.fieldData || payload.fields || []);
    const flatFields = {
      ...parsedFields,
      ...payload.answers,
      ...payload,
    };

    const name = pickFirst(flatFields, ['full_name', 'name', 'ad_soyad']) || pickFirst(flatFields, ['company_name', 'company']) || 'Meta Lead';
    const email = pickFirst(flatFields, ['email', 'e-mail', 'mail']);
    const phone = pickFirst(flatFields, ['phone_number', 'phone', 'telefon', 'mobile_number']);
    const company = pickFirst(flatFields, ['company_name', 'company', 'sirket', 'şirket']);
    const businessType = pickFirst(flatFields, ['business_type', 'isletme_turu', 'işletme_türü']);
    const message = pickFirst(flatFields, ['message', 'mesaj', 'note', 'not']);

    const { lead, isDuplicate } = await createLead({
      source: LEAD_SOURCE.META_INSTANT_FORM,
      externalSourceId: payload.leadgen_id || payload.leadId || payload.id || null,
      name,
      email,
      phone,
      company,
      businessType,
      message,
      campaignName: payload.campaign_name || payload.campaignName || null,
      adsetName: payload.adset_name || payload.adsetName || null,
      adName: payload.ad_name || payload.adName || null,
      formName: payload.form_name || payload.formName || null,
      sourceSubmittedAt: payload.created_time ? new Date(payload.created_time) : null,
      rawPayload: payload
    });

    res.status(isDuplicate ? 200 : 201).json({
      success: true,
      isDuplicate,
      leadId: lead.id,
      status: lead.status
    });
  } catch (error) {
    console.error('Meta lead ingest error:', error);
    res.status(500).json({
      error: 'Failed to ingest Meta lead'
    });
  }
});

router.get('/preview/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const activate = String(req.query.activate || '').trim() === '1';

    const existingLead = await getLeadByResponseToken(token);
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    let lead = existingLead;
    let actionTaken = null;

    if (activate) {
      const result = await handleLeadCtaResponse(token, 'yes');
      if (!result.success) {
        return res.status(400).json({ error: 'Failed to activate lead preview' });
      }
      lead = result.lead || existingLead;
      actionTaken = result.actionTaken || null;
    }

    const refreshedLead = await getLeadByResponseToken(token);
    const previewAssistant = await resolveLeadPreviewAssistant(refreshedLead || lead);
    const effectiveLead = refreshedLead || lead;
    const previewDisplayName = getLeadPreviewDisplayName(previewAssistant);
    let previewAccessToken = null;

    if (activate && previewAssistant?.id && effectiveLead?.id) {
      const previewSession = await createLeadPreviewSession({
        leadId: effectiveLead.id,
        assistantId: previewAssistant.id
      });
      previewAccessToken = previewSession.previewAccessToken;
    }

    return res.json({
      leadName: effectiveLead?.name || null,
      status: effectiveLead?.status || null,
      ctaResponse: effectiveLead?.ctaResponse || null,
      actionTaken,
      previewAssistantId: previewAssistant?.id || null,
      previewAssistantName: previewAssistant?.name || null,
      previewAssistantCallDirection: previewAssistant?.callDirection || null,
      previewDisplayName,
      previewFirstMessage: getLeadPreviewFirstMessage(previewAssistant),
      previewAccessToken,
      previewMaxDurationSeconds: LEAD_PREVIEW_MAX_DURATION_SECONDS,
    });
  } catch (error) {
    return handleLeadPreviewError(res, error, 'Lead preview error:', 'Failed to prepare lead preview');
  }
});

router.post('/preview/session/connect', async (req, res) => {
  try {
    const { previewAccessToken, conversationId } = req.body || {};
    const session = await registerLeadPreviewConversation({
      previewAccessToken,
      conversationId
    });

    return res.json({
      success: true,
      status: session.status,
      expiresAt: session.expiresAt,
      previewMaxDurationSeconds: LEAD_PREVIEW_MAX_DURATION_SECONDS
    });
  } catch (error) {
    return handleLeadPreviewError(res, error, 'Lead preview connect error:', 'Failed to connect lead preview session');
  }
});

router.post('/preview/session/end', async (req, res) => {
  try {
    const { previewAccessToken, reason } = req.body || {};
    const session = await finishLeadPreviewSession({
      previewAccessToken,
      reason
    });

    return res.json({
      success: true,
      status: session?.status || null,
      endReason: session?.endReason || null
    });
  } catch (error) {
    return handleLeadPreviewError(res, error, 'Lead preview end error:', 'Failed to close lead preview session');
  }
});

router.use(authenticateToken);
router.use(isAdmin);
router.use(requireAdminMfa);

router.get('/stats', async (_req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [total, hot, newCount, emailed, positive, calledToday] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { temperature: LEAD_TEMPERATURE.HOT } }),
      prisma.lead.count({ where: { status: LEAD_STATUS.NEW } }),
      prisma.lead.count({ where: { status: LEAD_STATUS.EMAILED } }),
      prisma.lead.count({
        where: {
          status: {
            in: [LEAD_STATUS.POSITIVE, LEAD_STATUS.CALL_QUEUED, LEAD_STATUS.CALLED]
          }
        }
      }),
      prisma.lead.count({
        where: {
          lastContactedAt: { gte: today },
          status: {
            in: [LEAD_STATUS.CALLED, LEAD_STATUS.CALL_QUEUED]
          }
        }
      })
    ]);

    res.json({
      total,
      hot,
      new: newCount,
      emailed,
      positive,
      calledToday
    });
  } catch (error) {
    console.error('Lead stats error:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      status,
      source,
      temperature,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNumber - 1) * take;
    const where = {};

    if (status) where.status = status;
    if (source) where.source = source;
    if (temperature) where.temperature = temperature;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [
          { receivedAtUtc: 'desc' }
        ],
        skip,
        take,
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 3
          },
          callbackRequests: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              createdAt: true,
              assistantId: true
            }
          }
        }
      }),
      prisma.lead.count({ where })
    ]);

    res.json({
      items,
      total,
      page: pageNumber,
      pageSize: take,
      totalPages: Math.max(1, Math.ceil(total / take))
    });
  } catch (error) {
    console.error('Lead list error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' }
        },
        callbackRequests: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const previewAssistant = await resolveLeadPreviewAssistant(lead);

    res.json({
      ...lead,
      previewAssistantId: previewAssistant?.id || null,
      previewAssistantName: previewAssistant?.name || null,
      previewAssistantCallDirection: previewAssistant?.callDirection || null,
    });
  } catch (error) {
    console.error('Lead detail error:', error);
    res.status(500).json({ error: 'Failed to fetch lead detail' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.lead.findUnique({
      where: { id: req.params.id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.temperature) updates.temperature = req.body.temperature;
    if (req.body.notes !== undefined) updates.notes = req.body.notes || null;
    if (req.body.nextFollowUpAt !== undefined) {
      updates.nextFollowUpAt = req.body.nextFollowUpAt ? new Date(req.body.nextFollowUpAt) : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextLead = await tx.lead.update({
        where: { id: req.params.id },
        data: updates
      });

      if (req.body.status && req.body.status !== existing.status) {
        await tx.leadActivity.create({
          data: {
            leadId: nextLead.id,
            type: 'STATUS_CHANGED',
            message: `Lead durumu ${existing.status} -> ${req.body.status} güncellendi.`,
            actorType: 'admin',
            actorLabel: req.admin?.email || 'admin'
          }
        });
      }

      if (req.body.notes !== undefined && req.body.notes !== existing.notes) {
        await tx.leadActivity.create({
          data: {
            leadId: nextLead.id,
            type: 'NOTE_UPDATED',
            message: 'Lead notu güncellendi.',
            actorType: 'admin',
            actorLabel: req.admin?.email || 'admin'
          }
        });
      }

      return nextLead;
    });

    res.json(updated);
  } catch (error) {
    console.error('Lead update error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

export default router;
