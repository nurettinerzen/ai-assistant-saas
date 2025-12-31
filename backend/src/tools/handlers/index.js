/**
 * Tool Handlers Index
 * Exports all ACTIVE tool handlers with their execute functions
 *
 * Active tools:
 * - create_appointment: Appointments for service businesses
 * - send_order_notification: Order notifications to business owners
 * - check_order_status: E-commerce order lookup (Shopify/WooCommerce)
 * - get_product_stock: E-commerce product stock (Shopify/WooCommerce)
 * - get_tracking_info: E-commerce shipping tracking (Shopify/WooCommerce)
 * - check_order_status_crm: CRM order lookup
 * - check_stock_crm: CRM stock lookup
 * - check_ticket_status_crm: CRM ticket/service lookup
 */

import appointmentHandler from './appointment.js';
import orderNotificationHandler from './order-notification.js';
import orderStatusHandler from './order-status.js';
import productStockHandler from './product-stock.js';
import trackingInfoHandler from './tracking-info.js';
// CRM Handlers
import crmOrderStatusHandler from './crm-order-status.js';
import crmStockHandler from './crm-stock.js';
import crmTicketStatusHandler from './crm-ticket-status.js';
// Customer Data Handler
import customerDataLookupHandler from './customer-data-lookup.js';

// Tool name -> handler mapping
const handlers = {
  'create_appointment': appointmentHandler,
  'send_order_notification': orderNotificationHandler,
  'check_order_status': orderStatusHandler,
  'get_product_stock': productStockHandler,
  'get_tracking_info': trackingInfoHandler,
  // CRM Handlers
  'check_order_status_crm': crmOrderStatusHandler,
  'check_stock_crm': crmStockHandler,
  'check_ticket_status_crm': crmTicketStatusHandler,
  // Customer Data Handler
  'customer_data_lookup': customerDataLookupHandler
};

export default handlers;

// Also export individual handlers for direct access
export {
  appointmentHandler,
  orderNotificationHandler,
  orderStatusHandler,
  productStockHandler,
  trackingInfoHandler,
  // CRM Handlers
  crmOrderStatusHandler,
  crmStockHandler,
  crmTicketStatusHandler,
  // Customer Data Handler
  customerDataLookupHandler
};
