import express from 'express';
import elevenLabsService from '../services/elevenlabs.js';

const router = express.Router();

// Demo configuration from environment variables
const DEMO_CONFIG = {
  agentId: process.env.ELEVENLABS_DEMO_AGENT_ID,
  phoneNumberId: process.env.ELEVENLABS_DEMO_PHONE_NUMBER_ID
};

// Demo request endpoint - Initiate outbound call to user using 11Labs
router.post('/demo/request-call', async (req, res) => {
  try {
    const { phoneNumber, language = 'TR', name } = req.body;

    // Validate phone number
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Telefon numarasi gereklidir'
      });
    }

    // Clean phone number - ensure E.164 format
    let cleanPhone = phoneNumber.replace(/\D/g, '');

    // Add country code if not present (assume Turkey for now)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '90' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) {
      cleanPhone = '90' + cleanPhone;
    }
    cleanPhone = '+' + cleanPhone;

    // Check if demo is configured
    if (!DEMO_CONFIG.agentId || !DEMO_CONFIG.phoneNumberId) {
      console.log('📞 Demo call requested but not configured:', {
        hasAgentId: !!DEMO_CONFIG.agentId,
        hasPhoneNumberId: !!DEMO_CONFIG.phoneNumberId
      });
      return res.status(400).json({
        success: false,
        error: 'Demo sistemi henuz yapilandirilmadi. Lutfen daha sonra tekrar deneyin.'
      });
    }

    console.log('📞 Initiating demo outbound call:', {
      to: cleanPhone.slice(0, -4) + '****',
      language,
      name
    });

    // Initiate outbound call via 11Labs
    const result = await elevenLabsService.initiateOutboundCall({
      agentId: DEMO_CONFIG.agentId,
      phoneNumberId: DEMO_CONFIG.phoneNumberId,
      toNumber: cleanPhone,
      clientData: {
        caller_name: name || 'Demo User',
        language: language,
        demo: true
      }
    });

    console.log('✅ Demo call initiated:', result);

    res.json({
      success: true,
      message: 'Demo araması başlatıldı! Telefonunuz birazdan çalacak.',
      callId: result.call_sid || result.conversation_id,
      callType: 'outbound'
    });

  } catch (error) {
    console.error('Demo call error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Demo araması başlatılamadı. Lütfen tekrar deneyin.'
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
      message: 'Geri bildiriminiz icin tesekkurler!'
    });

  } catch (error) {
    console.error('Demo feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Legacy demo request endpoint (for landing page form - simple contact form)
router.post('/demo-request', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    console.log('📞 Demo request received (contact form):', { name, email, phone });

    // TODO: Store demo requests in database and/or send notification

    res.json({
      success: true,
      message: 'Demo talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz!'
    });
  } catch (error) {
    console.error('Demo request error:', error);
    res.status(500).json({ error: 'Demo talebi işlenemedi' });
  }
});

export default router;
