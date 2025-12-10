/**
 * Chat Widget API
 * Handles text-based chat for embedded widget
 * WITH FUNCTION CALLING SUPPORT
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import googleCalendarService from '../services/google-calendar.js';

const router = express.Router();
const prisma = new PrismaClient();

// Lazy initialization
let openai = null;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// Function definitions for OpenAI
const functions = [
  {
    name: "create_appointment",
    description: "Creates an appointment in the business's Google Calendar when customer wants to book/schedule/reserve an appointment",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Appointment date in YYYY-MM-DD format"
        },
        time: {
          type: "string",
          description: "Appointment time in HH:MM format (24-hour)"
        },
        customer_name: {
          type: "string",
          description: "Customer's full name"
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number"
        },
        service_type: {
          type: "string",
          description: "Type of service requested (optional)"
        }
      },
      required: ["date", "time", "customer_name", "customer_phone"]
    }
  }
];

// POST /api/chat/widget - Public endpoint for widget
router.post('/widget', async (req, res) => {
  try {
    const { assistantId, message, conversationHistory = [] } = req.body;

    if (!assistantId || !message) {
      return res.status(400).json({ error: 'assistantId and message are required' });
    }

    const assistant = await prisma.assistant.findFirst({
      where: { vapiAssistantId: assistantId },
      include: { 
        business: {
          include: {
            integrations: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `Your name is ${assistant.name}. You work for ${assistant.business?.name || 'this business'}.

${assistant.systemPrompt || 'You are a helpful customer service assistant. Be friendly, concise, and helpful.'}

IMPORTANT: Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

When a customer wants to book an appointment:
1. Ask for their name if not provided
2. Ask for their phone number if not provided  
3. Ask what service they want (if applicable)
4. Ask for their preferred date and time
5. Use the create_appointment function to book it`
      },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call OpenAI with function calling
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      functions: functions,
      function_call: "auto",
      max_tokens: 500,
      temperature: 0.7
    });

    const responseMessage = completion.choices[0]?.message;

    // Check if AI wants to call a function
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      console.log('🔧 Function call detected:', functionName, functionArgs);

      if (functionName === 'create_appointment') {
        // Execute the appointment creation
        const result = await handleCreateAppointment(functionArgs, assistant.business);

        // Send result back to AI to generate final response
        const secondMessages = [
          ...messages,
          responseMessage,
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(result)
          }
        ];

        const secondCompletion = await getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: secondMessages,
          max_tokens: 500,
          temperature: 0.7
        });

        const finalReply = secondCompletion.choices[0]?.message?.content;

        return res.json({
          success: true,
          reply: finalReply,
          assistantName: assistant.name,
          functionCalled: functionName,
          appointmentCreated: result.success
        });
      }
    }

    // No function call, just return the text response
    const reply = responseMessage?.content || 'Sorry, I could not generate a response.';

    res.json({
      success: true,
      reply: reply,
      assistantName: assistant.name
    });

  } catch (error) {
    console.error('Chat widget error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Handle create_appointment function call
 */
async function handleCreateAppointment(args, business) {
  try {
    const { date, time, customer_name, customer_phone, service_type } = args;

    console.log('📅 Creating appointment:', { date, time, customer_name, customer_phone, service_type });

    // Parse appointment date/time
    let appointmentDateTime;
    try {
      appointmentDateTime = new Date(`${date}T${time}`);
      
      if (isNaN(appointmentDateTime.getTime())) {
        appointmentDateTime = new Date(`${date} ${time}`);
      }

      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error('Invalid date/time format');
      }
    } catch (error) {
      return {
        success: false,
        message: 'Invalid date or time format. Please provide date as YYYY-MM-DD and time as HH:MM'
      };
    }

    // Check if business has Google Calendar connected
    const googleCalendarIntegration = business.integrations?.find(
      i => i.type === 'GOOGLE_CALENDAR' && i.isActive
    );

    let calendarEventId = null;

    if (googleCalendarIntegration) {
      try {
        const { access_token, refresh_token } = googleCalendarIntegration.credentials;

        // Calculate end time
        const duration = business.bookingDuration || 30;
        const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

        // Create event in business's Google Calendar
        const event = await googleCalendarService.createEvent(
          access_token,
          refresh_token,
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          {
            summary: `${service_type || 'Appointment'} - ${customer_name}`,
            description: `Customer: ${customer_name}\nPhone: ${customer_phone}\nService: ${service_type || 'Not specified'}`,
            start: {
              dateTime: appointmentDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            },
            end: {
              dateTime: endDateTime.toISOString(),
              timeZone: 'Europe/Istanbul'
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 }
              ]
            }
          }
        );

        calendarEventId = event.id;
        console.log('✅ Google Calendar event created:', calendarEventId);

      } catch (calendarError) {
        console.error('❌ Google Calendar error:', calendarError);
        // Continue anyway - we'll still save to database
      }
    }

    // Save appointment to database
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerName: customer_name,
        customerPhone: customer_phone,
        appointmentDate: appointmentDateTime,
        duration: business.bookingDuration || 30,
        serviceType: service_type || null,
        status: 'CONFIRMED',
        notes: `Created via chat widget${calendarEventId ? ` - Google Calendar Event ID: ${calendarEventId}` : ''}`
      }
    });

    console.log('✅ Appointment saved to database:', appointment.id);

    return {
      success: true,
      message: `Appointment successfully created for ${date} at ${time}`,
      appointmentId: appointment.id,
      calendarEventId: calendarEventId
    };

  } catch (error) {
    console.error('❌ Create appointment error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create appointment'
    };
  }
}

// GET /api/chat/assistant/:assistantId
router.get('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    const assistant = await prisma.assistant.findFirst({
      where: { vapiAssistantId: assistantId },
      select: {
        name: true,
        business: {
          select: { name: true }
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json({
      name: assistant.name,
      businessName: assistant.business?.name || ''
    });

  } catch (error) {
    console.error('Get assistant error:', error);
    res.status(500).json({ error: 'Failed to get assistant info' });
  }
});

export default router;