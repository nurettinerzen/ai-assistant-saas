import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/voices
router.get('/', authenticateToken, async (req, res) => {
  try {
    // 11Labs voices - Including native Turkish voices
    const voices = [
      // English voices
      {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        gender: 'MALE',
        accent: 'American',
        description: 'A deep, professional male voice perfect for business calls.',
        language: 'EN',
        voiceKey: 'male-1-professional'
      },
      {
        id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        gender: 'MALE',
        accent: 'American',
        description: 'A warm, friendly male voice with great clarity.',
        language: 'EN',
        voiceKey: 'male-2-friendly'
      },
      {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A professional, confident female voice.',
        language: 'EN',
        voiceKey: 'female-1-professional'
      },
      {
        id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A warm, friendly female voice.',
        language: 'EN',
        voiceKey: 'female-2-warm'
      },
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A calm, professional female voice perfect for customer service.',
        language: 'EN',
        voiceKey: 'en-female-rachel'
      },
      {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh',
        gender: 'MALE',
        accent: 'American',
        description: 'A deep, authoritative male voice.',
        language: 'EN',
        voiceKey: 'en-male-josh'
      },
      
      // Native Turkish voices - Real 11Labs Turkish voice IDs
      {
        id: 'GvbLQkVki5VurnilV994',
        name: 'Caner Boyraz',
        gender: 'MALE',
        accent: 'Turkish (Istanbul)',
        description: 'Enerjik Türkçe erkek sesi - Doğal İstanbul aksanı.',
        language: 'TR',
        voiceKey: 'tr-male-1'
      },
      {
        id: 'ADt6orTrVUa6DCpMjrDW',
        name: 'Muharrem Kudu',
        gender: 'MALE',
        accent: 'Turkish',
        description: 'Akıcı ve güvenilir Türkçe erkek sesi.',
        language: 'TR',
        voiceKey: 'tr-male-2'
      },
      {
        id: 'g3LHrNTQNTFM2HUdizDR',
        name: 'Mehmet Ali Arslan',
        gender: 'MALE',
        accent: 'Turkish',
        description: 'Genç ve dinamik Türkçe erkek sesi.',
        language: 'TR',
        voiceKey: 'tr-male-3'
      },
      {
        id: 'dv1FlExW4kIBpj3BBTOM',
        name: 'Doruk Terzi',
        gender: 'MALE',
        accent: 'Turkish',
        description: 'Etkileyici ve samimi Türkçe erkek sesi.',
        language: 'TR',
        voiceKey: 'tr-male-4'
      },
      {
        id: 'A2nJYsJQbhz9yDiDndcv',
        name: 'Ersen Tahsin',
        gender: 'MALE',
        accent: 'Turkish',
        description: 'Olgun ve profesyonel Türkçe erkek sesi.',
        language: 'TR',
        voiceKey: 'tr-male-5'
      },
      {
        id: 'c4n2ypvZwjKx1uUi3vSG',
        name: 'Ayşe (Young Turkish)',
        gender: 'FEMALE',
        accent: 'Turkish',
        description: 'Genç ve enerjik Türkçe kadın sesi.',
        language: 'TR',
        voiceKey: 'tr-female-1'
      }
    ];

    res.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

export default router;
