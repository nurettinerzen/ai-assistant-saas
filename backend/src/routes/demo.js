import express from 'express';
import elevenLabsService from '../services/elevenlabs.js';

const router = express.Router();

// Demo agent and phone number IDs - should be set in environment
// These are the 11Labs agent and phone number assigned to nurettin@telyx.ai for demos
const DEMO_AGENT_ID = process.env.DEMO_ELEVENLABS_AGENT_ID;
const DEMO_PHONE_NUMBER_ID = process.env.DEMO_ELEVENLABS_PHONE_NUMBER_ID;

// Demo request endpoint - Request a demo call using 11Labs
router.post('/demo/request-call', async (req, res) => {
  try {
    const { phoneNumber, language = 'TR' } = req.body;

    // Phone number is required for outbound calls
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean and validate phone number
    let cleanPhone = phoneNumber.replace(/\D/g, '');

    // Add country code if missing
    if (cleanPhone.length === 10) {
      // Turkish mobile starting with 5
      cleanPhone = '+90' + cleanPhone;
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      // Turkish format with leading 0
      cleanPhone = '+9' + cleanPhone;
    } else if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    if (cleanPhone.length < 12) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if 11Labs demo credentials are configured
    if (!DEMO_AGENT_ID || !DEMO_PHONE_NUMBER_ID) {
      console.log('📞 Demo call requested but 11Labs demo not configured:', { phoneNumber, language });
      return res.json({
        success: false,
        error: 'Demo sistemi henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.',
        demo: true
      });
    }

    console.log('📞 Initiating 11Labs demo call:', {
      toNumber: cleanPhone.slice(-4).padStart(cleanPhone.length, '*'),
      agentId: DEMO_AGENT_ID,
      phoneNumberId: DEMO_PHONE_NUMBER_ID,
      language
    });

    // Initiate outbound call via 11Labs
    const result = await elevenLabsService.initiateOutboundCall({
      agentId: DEMO_AGENT_ID,
      phoneNumberId: DEMO_PHONE_NUMBER_ID,
      toNumber: cleanPhone,
      clientData: {
        source: 'landing_page_demo',
        language: language
      }
    });

    console.log('✅ Demo call initiated:', {
      callSid: result.call_sid,
      phoneNumber: cleanPhone.slice(-4).padStart(cleanPhone.length, '*')
    });

    return res.json({
      success: true,
      message: language === 'TR'
        ? 'Demo araması başlatıldı! Telefonunuz birkaç saniye içinde çalacak.'
        : 'Demo call initiated! Your phone will ring shortly.',
      callId: result.call_sid,
      callType: 'outbound'
    });

  } catch (error) {
    console.error('Demo call error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Demo araması başlatılamadı. Lütfen daha sonra tekrar deneyin.'
    });
  }
});

// Demo feedback endpoint
router.post('/demo/feedback', async (req, res) => {
  try {
    const { callId, rating, feedback, wouldRecommend } = req.body;

    console.log('📝 Demo feedback received:', {
      callId,
      rating,
      feedback,
      wouldRecommend
    });

    // TODO: Store feedback in database for analytics

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Demo feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Legacy demo request endpoint (backward compatibility)
router.post('/demo-request', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    console.log('📞 Demo request received:', { name, email, phone });

    res.json({
      success: true,
      message: 'Demo request received successfully'
    });
  } catch (error) {
    console.error('Demo request error:', error);
    res.status(500).json({ error: 'Failed to process demo request' });
  }
});

export default router;
