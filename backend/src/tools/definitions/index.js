/**
 * Tool Definitions Index
 * Exports all ACTIVE tool definitions
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

import createAppointment from './appointment.js';
import sendOrderNotification from './order-notification.js';
import checkOrderStatus from './order-status.js';
import getProductStock from './product-stock.js';
import getTrackingInfo from './tracking-info.js';
// CRM Tools
import checkOrderStatusCrm from './crm-order-status.js';
import checkStockCrm from './crm-stock.js';
import checkTicketStatusCrm from './crm-ticket-status.js';
// Customer Data Tool
import customerDataLookup from './customer-data-lookup.js';
// Callback Tool
import createCallback from './create-callback.js';

// Export all definitions as an array
export const definitions = [
  createAppointment,
  sendOrderNotification,
  checkOrderStatus,
  getProductStock,
  getTrackingInfo,
  // CRM Tools
  checkOrderStatusCrm,
  checkStockCrm,
  checkTicketStatusCrm,
  // Customer Data Tool
  customerDataLookup,
  // Callback Tool
  createCallback
];

// Export individual definitions
export {
  createAppointment,
  sendOrderNotification,
  checkOrderStatus,
  getProductStock,
  getTrackingInfo,
  // CRM Tools
  checkOrderStatusCrm,
  checkStockCrm,
  checkTicketStatusCrm,
  // Customer Data Tool
  customerDataLookup,
  // Callback Tool
  createCallback
};

// Export as default map for easy lookup
const definitionsMap = {};
definitions.forEach(def => {
  definitionsMap[def.name] = def;
});

export default definitionsMap;
