import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/voices
router.get('/', authenticateToken, async (req, res) => {
  try {
    // 11Labs voices (hardcoded for now)
    const voices = [
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A calm, professional female voice perfect for customer service.',
        language: 'EN'
      },
      {
        id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        gender: 'MALE',
        accent: 'American',
        description: 'A warm, friendly male voice with great clarity.',
        language: 'EN'
      },
      {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A strong, confident female voice.',
        language: 'EN'
      },
      {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        gender: 'FEMALE',
        accent: 'American',
        description: 'A soft, gentle female voice.',
        language: 'EN'
      },
      {
        id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli',
        gender: 'FEMALE',
        accent: 'American',
        description: 'An energetic, youthful female voice.',
        language: 'EN'
      },
      {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh',
        gender: 'MALE',
        accent: 'American',
        description: 'A deep, authoritative male voice.',
        language: 'EN'
      },
      {
        id: 'VR6AewLTigWG4xSOukaG',
        name: 'Arnold',
        gender: 'MALE',
        accent: 'American',
        description: 'A crisp, clear male voice.',
        language: 'EN'
      },
      {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        gender: 'MALE',
        accent: 'American',
        description: 'A deep, resonant male voice.',
        language: 'EN'
      }
    ];

    res.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

export default router;
