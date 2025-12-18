/**
 * Product Stock Tool Definition
 * Checks product availability across e-commerce platforms
 */

export default {
  name: 'get_product_stock',
  description: 'Checks product stock/availability. Searches by product name, barcode, or SKU across connected e-commerce platforms.',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: 'Product name to search'
      },
      barcode: {
        type: 'string',
        description: 'Product barcode'
      },
      product_sku: {
        type: 'string',
        description: 'Product SKU code'
      }
    },
    required: [] // At least one parameter should be provided
  },
  allowedBusinessTypes: ['ECOMMERCE'],
  requiredIntegrations: ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX', 'ZAPIER'] // At least one required
};
