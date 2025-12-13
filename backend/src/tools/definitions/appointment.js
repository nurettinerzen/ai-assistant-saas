/**
 * Appointment Tool Definition
 * Creates appointments in business's calendar
 */

export default {
  name: 'create_appointment',
  description: 'Creates a new appointment/reservation for the customer. Use this when customer wants to book, schedule, or reserve an appointment.',
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Appointment date in YYYY-MM-DD format'
      },
      time: {
        type: 'string',
        description: 'Appointment time in HH:MM format (24-hour)'
      },
      customer_name: {
        type: 'string',
        description: 'Customer\'s full name'
      },
      customer_phone: {
        type: 'string',
        description: 'Customer\'s phone number'
      },
      service_type: {
        type: 'string',
        description: 'Type of service requested (optional)'
      }
    },
    required: ['date', 'time', 'customer_name', 'customer_phone']
  },
  // Metadata - which business types can use this tool
  allowedBusinessTypes: ['RESTAURANT', 'SALON', 'CLINIC', 'SERVICE', 'OTHER'],
  // Which integrations are required (at least one)
  requiredIntegrations: [] // None required - saves to DB at minimum
};
