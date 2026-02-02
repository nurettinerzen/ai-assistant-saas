/**
 * CRM Webhook Endpoint
 * Public endpoint for receiving data from customer CRM/ERP systems
 *
 * Supports:
 * - Orders (order tracking)
 * - Stock (inventory)
 * - Tickets (service/repair)
 */

import express from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient.js';
import { normalizePhone as normalizePhoneUtil } from '../utils/text.js';

const router = express.Router();

/**
 * Verify CRM webhook signature
 * Uses X-CRM-Signature header with HMAC-SHA256
 * Format: timestamp=<unix_timestamp>,signature=<hmac_hex>
 */
function verifyCRMSignature(req, webhookSecret) {
  const signatureHeader = req.headers['x-crm-signature'];
  if (!signatureHeader) {
    console.error('❌ Missing X-CRM-Signature header');
    return false;
  }

  try {
    // Parse signature header
    const parts = {};
    signatureHeader.split(',').forEach(part => {
      const [key, value] = part.split('=');
      parts[key] = value;
    });

    const { timestamp, signature } = parts;
    if (!timestamp || !signature) {
      console.error('❌ Invalid signature format');
      return false;
    }

    // Verify timestamp (5 minute tolerance)
    const now = Math.floor(Date.now() / 1000);
    const timestampAge = now - parseInt(timestamp);
    if (timestampAge > 300 || timestampAge < -300) {
      console.error('❌ Signature timestamp too old or in future:', timestampAge, 'seconds');
      return false;
    }

    // Calculate expected signature: HMAC(timestamp.body, secret)
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ CRM signature verification error:', error.message);
    return false;
  }
}

/**
 * CRM Webhook Endpoint
 * POST /api/webhook/crm/:businessId/:webhookSecret
 *
 * SECURITY: Requires HMAC-SHA256 signature in X-CRM-Signature header
 * Format: timestamp=<unix_timestamp>,signature=<hmac_hex>
 * Signature payload: `${timestamp}.${JSON.stringify(body)}`
 *
 * IDEMPOTENCY: Optional event_id field ensures duplicate events are ignored
 */
router.post('/:businessId/:webhookSecret', async (req, res) => {
  try {
    const { businessId, webhookSecret } = req.params;
    const data = req.body;

    // Step 1: Verify webhook exists and is active
    const webhook = await prisma.crmWebhook.findFirst({
      where: {
        businessId: parseInt(businessId),
        webhookSecret: webhookSecret,
        isActive: true
      }
    });

    if (!webhook) {
      return res.status(401).json({ error: 'Invalid webhook credentials' });
    }

    // Step 2: SECURITY - Verify HMAC signature
    if (!verifyCRMSignature(req, webhookSecret)) {
      console.error('❌ CRM webhook signature verification failed for business:', businessId);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Data tipi kontrolü
    const { type, event_id } = data;
    if (!type || !['order', 'stock', 'ticket'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid data type. Must be: order, stock, or ticket'
      });
    }

    const bizId = parseInt(businessId);

    // Step 3: IDEMPOTENCY - Check if event already processed
    if (event_id) {
      // Generate unique idempotency key: businessId-type-eventId
      const idempotencyKey = `${bizId}-${type}-${event_id}`;

      // Check if this event was already processed
      const existingEvent = await prisma.crmWebhookEvent.findUnique({
        where: { idempotencyKey }
      });

      if (existingEvent) {
        console.log(`✅ CRM webhook idempotent: already processed event ${event_id} for business ${bizId}`);
        return res.status(200).json({
          success: true,
          type,
          id: existingEvent.recordId,
          idempotent: true,
          message: 'Event already processed'
        });
      }
    }

    let result;

    // Data tipine göre işle
    switch (type) {
      case 'order':
        result = await handleOrder(bizId, data);
        break;
      case 'stock':
        result = await handleStock(bizId, data);
        break;
      case 'ticket':
        result = await handleTicket(bizId, data);
        break;
    }

    // Step 4: Save event for idempotency (if event_id provided)
    if (event_id) {
      const idempotencyKey = `${bizId}-${type}-${event_id}`;
      try {
        await prisma.crmWebhookEvent.create({
          data: {
            idempotencyKey,
            businessId: bizId,
            eventType: type,
            eventId: event_id,
            recordId: result.id,
            processedAt: new Date()
          }
        });
      } catch (error) {
        // If unique constraint fails, event was processed concurrently
        // This is fine - the first one won
        if (error.code === 'P2002') {
          console.log(`⚠️ CRM webhook race condition detected for event ${event_id}, but data was already saved`);
        } else {
          console.error('Failed to save webhook event:', error);
          // Don't fail the request - data was already processed successfully
        }
      }
    }

    // Son data zamanını güncelle
    await prisma.crmWebhook.update({
      where: { id: webhook.id },
      data: { lastDataAt: new Date() }
    });

    res.json({ success: true, type, id: result.id });

  } catch (error) {
    console.error('CRM Webhook error:', error);

    // Validation errors
    if (error.message && error.message.startsWith('Missing required')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sipariş işleme
async function handleOrder(businessId, data) {
  const {
    order_number,
    customer_phone,
    customer_name,
    status,
    tracking_number,
    carrier,
    items,
    total_amount,
    estimated_delivery,
    updated_at
  } = data;

  // Validasyon
  if (!order_number || !customer_phone || !status) {
    throw new Error('Missing required fields: order_number, customer_phone, status');
  }

  // Telefon numarasını normalize et
  const phone = normalizePhone(customer_phone);

  return await prisma.crmOrder.upsert({
    where: {
      businessId_orderNumber: {
        businessId,
        orderNumber: order_number
      }
    },
    update: {
      customerPhone: phone,
      customerName: customer_name || null,
      status: status,
      trackingNumber: tracking_number || null,
      carrier: carrier || null,
      items: items || null,
      totalAmount: total_amount ? parseFloat(total_amount) : null,
      estimatedDelivery: estimated_delivery ? new Date(estimated_delivery) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    },
    create: {
      businessId,
      orderNumber: order_number,
      customerPhone: phone,
      customerName: customer_name || null,
      status: status,
      trackingNumber: tracking_number || null,
      carrier: carrier || null,
      items: items || null,
      totalAmount: total_amount ? parseFloat(total_amount) : null,
      estimatedDelivery: estimated_delivery ? new Date(estimated_delivery) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    }
  });
}

// Stok işleme
async function handleStock(businessId, data) {
  const {
    sku,
    product_name,
    in_stock,
    quantity,
    price,
    estimated_restock,
    updated_at
  } = data;

  // Validasyon
  if (!sku || !product_name) {
    throw new Error('Missing required fields: sku, product_name');
  }

  return await prisma.crmStock.upsert({
    where: {
      businessId_sku: {
        businessId,
        sku: sku
      }
    },
    update: {
      productName: product_name,
      inStock: in_stock !== undefined ? Boolean(in_stock) : (quantity > 0),
      quantity: quantity !== undefined ? parseInt(quantity) : null,
      price: price ? parseFloat(price) : null,
      estimatedRestock: estimated_restock ? new Date(estimated_restock) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    },
    create: {
      businessId,
      sku: sku,
      productName: product_name,
      inStock: in_stock !== undefined ? Boolean(in_stock) : (quantity > 0),
      quantity: quantity !== undefined ? parseInt(quantity) : null,
      price: price ? parseFloat(price) : null,
      estimatedRestock: estimated_restock ? new Date(estimated_restock) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    }
  });
}

// Servis/Arıza işleme
async function handleTicket(businessId, data) {
  const {
    ticket_number,
    customer_phone,
    customer_name,
    product,
    issue,
    status,
    notes,
    estimated_completion,
    cost,
    updated_at
  } = data;

  // Validasyon
  if (!ticket_number || !customer_phone || !product || !status) {
    throw new Error('Missing required fields: ticket_number, customer_phone, product, status');
  }

  // Telefon numarasını normalize et
  const phone = normalizePhone(customer_phone);

  return await prisma.crmTicket.upsert({
    where: {
      businessId_ticketNumber: {
        businessId,
        ticketNumber: ticket_number
      }
    },
    update: {
      customerPhone: phone,
      customerName: customer_name || null,
      product: product,
      issue: issue || null,
      status: status,
      notes: notes || null,
      estimatedCompletion: estimated_completion ? new Date(estimated_completion) : null,
      cost: cost ? parseFloat(cost) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    },
    create: {
      businessId,
      ticketNumber: ticket_number,
      customerPhone: phone,
      customerName: customer_name || null,
      product: product,
      issue: issue || null,
      status: status,
      notes: notes || null,
      estimatedCompletion: estimated_completion ? new Date(estimated_completion) : null,
      cost: cost ? parseFloat(cost) : null,
      externalUpdatedAt: updated_at ? new Date(updated_at) : new Date()
    }
  });
}

// P1 Fix: Use centralized phone normalization for consistency
// CRITICAL: All phone numbers must be stored in E.164 format (+90XXXXXXXXXX)
// Otherwise search queries won't match stored data
function normalizePhone(phone) {
  if (!phone) return '';
  return normalizePhoneUtil(phone);
}

export default router;
