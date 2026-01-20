/**
 * Tool Definitions Index
 * Exports all ACTIVE tool definitions
 *
 * Active tools:
 * - create_appointment: Appointments for service businesses
 * - send_order_notification: Order notifications to business owners
 * - check_order_by_number: E-commerce order lookup by order number
 * - check_order_by_phone: E-commerce order lookup by phone
 * - check_order_by_email: E-commerce order lookup by email
 * - get_product_stock: E-commerce product stock (Shopify/WooCommerce)
 * - get_tracking_info: E-commerce shipping tracking (Shopify/WooCommerce)
 * - check_order_status_crm: CRM order lookup
 * - check_stock_crm: CRM stock lookup
 * - check_ticket_status_crm: CRM ticket/service lookup
 */

import createAppointment from './appointment.js';
import sendOrderNotification from './order-notification.js';
// Order tools - split by identifier type
import checkOrderByNumber from './order-by-number.js';
import checkOrderByPhone from './order-by-phone.js';
import checkOrderByEmail from './order-by-email.js';
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
  // Order tools - split by identifier type
  checkOrderByNumber,
  checkOrderByPhone,
  checkOrderByEmail,
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
  // Order tools - split by identifier type
  checkOrderByNumber,
  checkOrderByPhone,
  checkOrderByEmail,
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
