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
import prisma from '../prismaClient.js';

const router = express.Router();

/**
 * CRM Webhook Endpoint
 * POST /api/webhook/crm/:businessId/:webhookSecret
 */
router.post('/:businessId/:webhookSecret', async (req, res) => {
  try {
    const { businessId, webhookSecret } = req.params;
    const data = req.body;

    // Webhook doğrulama
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

    // Data tipi kontrolü
    const { type } = data;
    if (!type || !['order', 'stock', 'ticket'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid data type. Must be: order, stock, or ticket'
      });
    }

    const bizId = parseInt(businessId);
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

// Telefon numarası normalize
function normalizePhone(phone) {
  if (!phone) return '';
  // Sadece rakamları al
  let digits = phone.replace(/\D/g, '');
  // Türkiye için 0 ile başlıyorsa kaldır
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  // 90 ile başlıyorsa kaldır
  if (digits.startsWith('90') && digits.length > 10) {
    digits = digits.substring(2);
  }
  return digits;
}

export default router;
