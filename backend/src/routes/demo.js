import express from 'express';

const router = express.Router();

// Demo request endpoint
router.post('/demo-request', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // TODO: VAPI ile gerçek arama yapılacak
    console.log('📞 Demo request received:', { name, email, phone });

    // Şimdilik sadece log'la, sonra VAPI entegre ederiz
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