import express from 'express';
import axios from 'axios';

const router = express.Router();

// 11Labs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// 🌍 VOICE LIBRARY - 15+ LANGUAGES SUPPORT
// Each language has 2 male + 2 female voices from 11Labs
// voice_id refers to actual 11Labs voice IDs
const VOICE_LIBRARY = {
  // TURKISH - 11Labs Turkish voices
  tr: [
    { id: 'tr-m-mirza', voice_id: 'EOVAuWqgSZN2Oel78Psj', name: 'Mirza', accent: 'Turkish', gender: 'male', description: 'Profesyonel erkek ses', provider: '11labs' },
    { id: 'tr-m-ali', voice_id: 'scOwDtmlUjD3prqpp97I', name: 'Ali', accent: 'Turkish', gender: 'male', description: 'Güvenilir erkek ses', provider: '11labs' },
    { id: 'tr-m-berat', voice_id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Berat', accent: 'Turkish', gender: 'male', description: 'Dinamik erkek ses', provider: '11labs' },
    { id: 'tr-m-yasir', voice_id: '1SM7GgM6IMuvQlz2BwM3', name: 'Yasir', accent: 'Turkish', gender: 'male', description: 'Samimi erkek ses', provider: '11labs' },
    { id: 'tr-f-eda', voice_id: '56AoDkrOh6qfVPDXZ7Pt', name: 'Eda', accent: 'Turkish', gender: 'female', description: 'Profesyonel kadın ses', provider: '11labs' },
    { id: 'tr-f-selen', voice_id: 'g6xIsTj2HwM6VR4iXFCw', name: 'Selen', accent: 'Turkish', gender: 'female', description: 'Enerjik kadın ses', provider: '11labs' },
    { id: 'tr-f-sare', voice_id: 'kdmDKE6EkgrWrrykO9Qt', name: 'Sare', accent: 'Turkish', gender: 'female', description: 'Sıcak kadın ses', provider: '11labs' },
    { id: 'tr-f-miray', voice_id: 'BZgkqPqms7Kj9ulSkVzn', name: 'Miray', accent: 'Turkish', gender: 'female', description: 'Dinamik kadın ses', provider: '11labs' }
  ],

  // ENGLISH - using actual 11Labs English voices
  en: [
    { id: 'en-m-josh', voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'American', gender: 'male', description: 'Professional American male', provider: '11labs' },
    { id: 'en-m-adam', voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'American', gender: 'male', description: 'Friendly American male', provider: '11labs' },
    { id: 'en-f-rachel', voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American', gender: 'female', description: 'Warm American female', provider: '11labs' },
    { id: 'en-f-bella', voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', accent: 'American', gender: 'female', description: 'Professional American female', provider: '11labs' }
  ],
  
  // GERMAN (Deutsch)
  de: [
    { id: 'de-m-marcus', name: 'Marcus', accent: 'German', gender: 'male', description: 'Professionelle männliche Stimme', provider: '11labs' },
    { id: 'de-m-lukas', name: 'Lukas', accent: 'German', gender: 'male', description: 'Freundliche männliche Stimme', provider: '11labs' },
    { id: 'de-f-sarah', name: 'Sarah', accent: 'German', gender: 'female', description: 'Warme weibliche Stimme', provider: '11labs' },
    { id: 'de-f-hannah', name: 'Hannah', accent: 'German', gender: 'female', description: 'Professionelle weibliche Stimme', provider: '11labs' }
  ],
  
  // FRENCH (Français)
  fr: [
    { id: 'fr-m-antoine', name: 'Antoine', accent: 'French', gender: 'male', description: 'Voix masculine professionnelle', provider: '11labs' },
    { id: 'fr-m-julien', name: 'Julien', accent: 'French', gender: 'male', description: 'Voix masculine chaleureuse', provider: '11labs' },
    { id: 'fr-f-marie', name: 'Marie', accent: 'French', gender: 'female', description: 'Voix féminine élégante', provider: '11labs' },
    { id: 'fr-f-sophie', name: 'Sophie', accent: 'French', gender: 'female', description: 'Voix féminine professionnelle', provider: '11labs' }
  ],
  
  // SPANISH (Español)
  es: [
    { id: 'es-m-diego', name: 'Diego', accent: 'Spanish', gender: 'male', description: 'Voz masculina profesional', provider: '11labs' },
    { id: 'es-m-carlos', name: 'Carlos', accent: 'Spanish', gender: 'male', description: 'Voz masculina cálida', provider: '11labs' },
    { id: 'es-f-lucia', name: 'Lucía', accent: 'Spanish', gender: 'female', description: 'Voz femenina elegante', provider: '11labs' },
    { id: 'es-f-elena', name: 'Elena', accent: 'Spanish', gender: 'female', description: 'Voz femenina profesional', provider: '11labs' }
  ],
  
  // ITALIAN (Italiano)
  it: [
    { id: 'it-m-marco', name: 'Marco', accent: 'Italian', gender: 'male', description: 'Voce maschile professionale', provider: '11labs' },
    { id: 'it-m-luca', name: 'Luca', accent: 'Italian', gender: 'male', description: 'Voce maschile calda', provider: '11labs' },
    { id: 'it-f-giulia', name: 'Giulia', accent: 'Italian', gender: 'female', description: 'Voce femminile elegante', provider: '11labs' },
    { id: 'it-f-chiara', name: 'Chiara', accent: 'Italian', gender: 'female', description: 'Voce femminile professionale', provider: '11labs' }
  ],
  
  // PORTUGUESE (Português)
  pt: [
    { id: 'pt-m-pedro', name: 'Pedro', accent: 'Portuguese', gender: 'male', description: 'Voz masculina profissional', provider: '11labs' },
    { id: 'pt-m-joao', name: 'João', accent: 'Portuguese', gender: 'male', description: 'Voz masculina calorosa', provider: '11labs' },
    { id: 'pt-f-ana', name: 'Ana', accent: 'Portuguese', gender: 'female', description: 'Voz feminina elegante', provider: '11labs' },
    { id: 'pt-f-maria', name: 'Maria', accent: 'Portuguese', gender: 'female', description: 'Voz feminina profissional', provider: '11labs' }
  ],
  
  // RUSSIAN (Русский)
  ru: [
    { id: 'ru-m-dmitri', name: 'Дмитрий', accent: 'Russian', gender: 'male', description: 'Профессиональный мужской голос', provider: '11labs' },
    { id: 'ru-m-alex', name: 'Александр', accent: 'Russian', gender: 'male', description: 'Тёплый мужской голос', provider: '11labs' },
    { id: 'ru-f-natasha', name: 'Наташа', accent: 'Russian', gender: 'female', description: 'Элегантный женский голос', provider: '11labs' },
    { id: 'ru-f-olga', name: 'Ольга', accent: 'Russian', gender: 'female', description: 'Профессиональный женский голос', provider: '11labs' }
  ],
  
  // ARABIC (العربية)
  ar: [
    { id: 'ar-m-ahmad', name: 'أحمد', accent: 'Arabic', gender: 'male', description: 'صوت ذكوري محترف', provider: '11labs' },
    { id: 'ar-m-omar', name: 'عمر', accent: 'Arabic', gender: 'male', description: 'صوت ذكوري دافئ', provider: '11labs' },
    { id: 'ar-f-fatima', name: 'فاطمة', accent: 'Arabic', gender: 'female', description: 'صوت أنثوي أنيق', provider: '11labs' },
    { id: 'ar-f-layla', name: 'ليلى', accent: 'Arabic', gender: 'female', description: 'صوت أنثوي محترف', provider: '11labs' }
  ],
  
  // JAPANESE (日本語)
  ja: [
    { id: 'ja-m-takeshi', name: 'タケシ', accent: 'Japanese', gender: 'male', description: 'プロフェッショナルな男性の声', provider: '11labs' },
    { id: 'ja-m-hiroshi', name: 'ヒロシ', accent: 'Japanese', gender: 'male', description: '温かい男性の声', provider: '11labs' },
    { id: 'ja-f-yuki', name: 'ユキ', accent: 'Japanese', gender: 'female', description: 'エレガントな女性の声', provider: '11labs' },
    { id: 'ja-f-sakura', name: 'サクラ', accent: 'Japanese', gender: 'female', description: 'プロフェッショナルな女性の声', provider: '11labs' }
  ],
  
  // KOREAN (한국어)
  ko: [
    { id: 'ko-m-minho', name: '민호', accent: 'Korean', gender: 'male', description: '전문적인 남성 목소리', provider: '11labs' },
    { id: 'ko-m-junho', name: '준호', accent: 'Korean', gender: 'male', description: '따뜻한 남성 목소리', provider: '11labs' },
    { id: 'ko-f-jiyeon', name: '지연', accent: 'Korean', gender: 'female', description: '우아한 여성 목소리', provider: '11labs' },
    { id: 'ko-f-soojin', name: '수진', accent: 'Korean', gender: 'female', description: '전문적인 여성 목소리', provider: '11labs' }
  ],
  
  // CHINESE (中文)
  zh: [
    { id: 'zh-m-wei', name: '伟', accent: 'Chinese', gender: 'male', description: '专业男性声音', provider: '11labs' },
    { id: 'zh-m-jun', name: '俊', accent: 'Chinese', gender: 'male', description: '温暖男性声音', provider: '11labs' },
    { id: 'zh-f-mei', name: '美', accent: 'Chinese', gender: 'female', description: '优雅女性声音', provider: '11labs' },
    { id: 'zh-f-ling', name: '玲', accent: 'Chinese', gender: 'female', description: '专业女性声音', provider: '11labs' }
  ],
  
  // HINDI (हिन्दी)
  hi: [
    { id: 'hi-m-raj', name: 'राज', accent: 'Hindi', gender: 'male', description: 'पेशेवर पुरुष आवाज़', provider: '11labs' },
    { id: 'hi-m-amit', name: 'अमित', accent: 'Hindi', gender: 'male', description: 'गर्म पुरुष आवाज़', provider: '11labs' },
    { id: 'hi-f-priya', name: 'प्रिया', accent: 'Hindi', gender: 'female', description: 'सुरुचिपूर्ण महिला आवाज़', provider: '11labs' },
    { id: 'hi-f-ananya', name: 'अनन्या', accent: 'Hindi', gender: 'female', description: 'पेशेवर महिला आवाज़', provider: '11labs' }
  ],
  
  // DUTCH (Nederlands)
  nl: [
    { id: 'nl-m-pieter', name: 'Pieter', accent: 'Dutch', gender: 'male', description: 'Professionele mannelijke stem', provider: '11labs' },
    { id: 'nl-m-lucas', name: 'Lucas', accent: 'Dutch', gender: 'male', description: 'Warme mannelijke stem', provider: '11labs' },
    { id: 'nl-f-emma', name: 'Emma', accent: 'Dutch', gender: 'female', description: 'Elegante vrouwelijke stem', provider: '11labs' },
    { id: 'nl-f-sophie', name: 'Sophie', accent: 'Dutch', gender: 'female', description: 'Professionele vrouwelijke stem', provider: '11labs' }
  ],
  
  // POLISH (Polski)
  pl: [
    { id: 'pl-m-piotr', name: 'Piotr', accent: 'Polish', gender: 'male', description: 'Profesjonalny głos męski', provider: '11labs' },
    { id: 'pl-m-jakub', name: 'Jakub', accent: 'Polish', gender: 'male', description: 'Ciepły głos męski', provider: '11labs' },
    { id: 'pl-f-anna', name: 'Anna', accent: 'Polish', gender: 'female', description: 'Elegancki głos damski', provider: '11labs' },
    { id: 'pl-f-zofia', name: 'Zofia', accent: 'Polish', gender: 'female', description: 'Profesjonalny głos damski', provider: '11labs' }
  ],
  
  // SWEDISH (Svenska)
  sv: [
    { id: 'sv-m-erik', name: 'Erik', accent: 'Swedish', gender: 'male', description: 'Professionell manlig röst', provider: '11labs' },
    { id: 'sv-m-oscar', name: 'Oscar', accent: 'Swedish', gender: 'male', description: 'Varm manlig röst', provider: '11labs' },
    { id: 'sv-f-emma', name: 'Emma', accent: 'Swedish', gender: 'female', description: 'Elegant kvinnlig röst', provider: '11labs' },
    { id: 'sv-f-maja', name: 'Maja', accent: 'Swedish', gender: 'female', description: 'Professionell kvinnlig röst', provider: '11labs' }
  ]
};

// Cache for 11Labs preview URLs (to avoid hitting API too often)
const previewUrlCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Helper to get preview URL from 11Labs
async function getPreviewUrl(voiceId) {
  // Check cache first
  const cached = previewUrlCache.get(voiceId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  try {
    if (!ELEVENLABS_API_KEY) {
      console.warn('⚠️ ELEVENLABS_API_KEY not configured - voice previews unavailable');
      return null;
    }

    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      timeout: 5000 // 5 second timeout
    });

    const previewUrl = response.data?.preview_url || null;

    // Cache the result (even if null to avoid repeated failed requests)
    previewUrlCache.set(voiceId, { url: previewUrl, timestamp: Date.now() });

    if (previewUrl) {
      console.log(`🎤 Got preview URL for voice ${voiceId}`);
    }

    return previewUrl;
  } catch (error) {
    console.error(`❌ Failed to get preview URL for voice ${voiceId}:`, error.message);
    // Cache the failure to avoid repeated requests
    previewUrlCache.set(voiceId, { url: null, timestamp: Date.now() });
    return null;
  }
}

// Enrich voices with preview URLs
async function enrichVoicesWithPreviews(voices, useTurkishPreview = false) {
  const enrichedVoices = await Promise.all(
    voices.map(async (voice) => {
      // For Turkish voices, use our Turkish preview endpoint
      if (useTurkishPreview && voice.id?.startsWith('tr-')) {
        // Use backend URL for Turkish preview
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
        return {
          ...voice,
          sampleUrl: `${backendUrl}/api/voices/preview/${voice.id}`
        };
      }
      // First check if preview_url already exists in voice object
      if (voice.preview_url) {
        return { ...voice, sampleUrl: voice.preview_url };
      }
      // Otherwise try to fetch from 11Labs API
      if (voice.voice_id) {
        const sampleUrl = await getPreviewUrl(voice.voice_id);
        return { ...voice, sampleUrl };
      }
      return voice;
    })
  );
  return enrichedVoices;
}

// GET all voices
router.get('/', async (req, res) => {
  const { language, withSamples } = req.query;

  // If specific language requested
  if (language && VOICE_LIBRARY[language.toLowerCase()]) {
    console.log('🎤 GET /api/voices - language:', language);
    let voices = VOICE_LIBRARY[language.toLowerCase()];
    const lang = language.toLowerCase();

    // Enrich with preview URLs if requested
    if (withSamples === 'true') {
      // Use Turkish preview for Turkish voices
      voices = await enrichVoicesWithPreviews(voices, lang === 'tr');
    }

    return res.json({
      voices,
      count: voices.length
    });
  }

  // Return all voices organized by language
  const allVoices = {};

  // If withSamples requested, enrich all voices with preview URLs
  if (withSamples === 'true') {
    for (const lang of Object.keys(VOICE_LIBRARY)) {
      // Use Turkish preview for Turkish voices
      allVoices[lang] = await enrichVoicesWithPreviews(VOICE_LIBRARY[lang], lang === 'tr');
    }
  } else {
    Object.keys(VOICE_LIBRARY).forEach(lang => {
      allVoices[lang] = VOICE_LIBRARY[lang];
    });
  }

  res.json({
    voices: allVoices,
    languages: Object.keys(VOICE_LIBRARY),
    totalVoices: Object.values(VOICE_LIBRARY).flat().length
  });
});

// GET voice by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  console.log('🎤 GET /api/voices/:id - id:', id);
  
  // Search across all languages
  let foundVoice = null;
  for (const lang in VOICE_LIBRARY) {
    foundVoice = VOICE_LIBRARY[lang].find(v => v.id === id);
    if (foundVoice) {
      foundVoice = { ...foundVoice, language: lang };
      break;
    }
  }
  
  if (!foundVoice) {
    return res.status(404).json({ error: 'Voice not found' });
  }
  
  res.json({ voice: foundVoice });
});

// GET voices by language code
router.get('/language/:code', (req, res) => {
  const { code } = req.params;

  console.log('🎤 GET /api/voices/language/:code - code:', code);

  const voices = VOICE_LIBRARY[code.toLowerCase()];

  if (!voices) {
    return res.status(404).json({
      error: 'Language not supported',
      supportedLanguages: Object.keys(VOICE_LIBRARY)
    });
  }

  res.json({
    voices,
    language: code,
    count: voices.length
  });
});

// Turkish preview text for each voice
const TURKISH_PREVIEW_TEXT = {
  'tr-m-mirza': 'Merhaba, ben Mirza. Size nasıl yardımcı olabilirim?',
  'tr-m-ali': 'Merhaba, ben Ali. Bugün size nasıl yardımcı olabilirim?',
  'tr-m-berat': 'Merhaba, ben Berat. Sizinle tanıştığıma memnun oldum.',
  'tr-m-yasir': 'Merhaba, ben Yasir. Size yardımcı olmak için buradayım.',
  'tr-f-eda': 'Merhaba, ben Eda. Size nasıl yardımcı olabilirim?',
  'tr-f-selen': 'Merhaba, ben Selen. Bugün size nasıl yardımcı olabilirim?',
  'tr-f-sare': 'Merhaba, ben Sare. Sizinle tanıştığıma memnun oldum.',
  'tr-f-miray': 'Merhaba, ben Miray. Size yardımcı olmak için buradayım.'
};

// Cache for Turkish preview audio
const turkishPreviewCache = new Map();
const PREVIEW_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// GET Turkish preview audio for a voice
router.get('/preview/:voiceId', async (req, res) => {
  const { voiceId } = req.params;

  try {
    // Find voice in our library
    let voice = null;
    let elevenLabsVoiceId = voiceId;

    for (const lang in VOICE_LIBRARY) {
      voice = VOICE_LIBRARY[lang].find(v => v.id === voiceId);
      if (voice) {
        elevenLabsVoiceId = voice.voice_id || voiceId;
        break;
      }
    }

    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: '11Labs API key not configured' });
    }

    // Check cache first
    const cached = turkishPreviewCache.get(voiceId);
    if (cached && Date.now() - cached.timestamp < PREVIEW_CACHE_TTL) {
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(cached.audio);
    }

    // Get Turkish preview text
    const previewText = TURKISH_PREVIEW_TEXT[voiceId] || `Merhaba, ben ${voice.name}. Size nasıl yardımcı olabilirim?`;

    // Generate Turkish audio using 11Labs TTS
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${elevenLabsVoiceId}`,
      {
        text: previewText,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.0
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    // Cache the audio
    turkishPreviewCache.set(voiceId, {
      audio: Buffer.from(response.data),
      timestamp: Date.now()
    });

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));

  } catch (error) {
    console.error('Failed to generate Turkish preview:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// GET sample audio for a voice from 11Labs (original English preview)
router.get('/sample/:voiceId', async (req, res) => {
  const { voiceId } = req.params;

  try {
    // Find voice in our library to get 11Labs voice_id
    let voice = null;
    let elevenLabsVoiceId = voiceId;

    for (const lang in VOICE_LIBRARY) {
      voice = VOICE_LIBRARY[lang].find(v => v.id === voiceId);
      if (voice) {
        elevenLabsVoiceId = voice.voice_id || voiceId;
        break;
      }
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: '11Labs API key not configured' });
    }

    // Get voice info from 11Labs which includes preview URL
    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices/${elevenLabsVoiceId}`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    const voiceData = response.data;

    res.json({
      voiceId,
      elevenLabsVoiceId,
      name: voiceData.name,
      previewUrl: voiceData.preview_url,
      labels: voiceData.labels
    });
  } catch (error) {
    console.error('Failed to get voice sample:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get voice sample' });
  }
});

// GET all available voices from 11Labs
router.get('/elevenlabs/all', async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: '11Labs API key not configured' });
    }

    const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    const voices = response.data.voices.map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels,
      previewUrl: v.preview_url,
      category: v.category
    }));

    res.json({ voices, count: voices.length });
  } catch (error) {
    console.error('Failed to get 11Labs voices:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get 11Labs voices' });
  }
});

export default router;
