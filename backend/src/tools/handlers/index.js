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
 */

import appointmentHandler from './appointment.js';
import orderNotificationHandler from './order-notification.js';
import orderStatusHandler from './order-status.js';
import productStockHandler from './product-stock.js';
import trackingInfoHandler from './tracking-info.js';

// Tool name -> handler mapping
const handlers = {
  'create_appointment': appointmentHandler,
  'send_order_notification': orderNotificationHandler,
  'check_order_status': orderStatusHandler,
  'get_product_stock': productStockHandler,
  'get_tracking_info': trackingInfoHandler
};

export default handlers;

// Also export individual handlers for direct access
export {
  appointmentHandler,
  orderNotificationHandler,
  orderStatusHandler,
  productStockHandler,
  trackingInfoHandler
};
