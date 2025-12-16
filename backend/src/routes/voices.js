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
  // TURKISH - using actual 11Labs Turkish voices
tr: [
    { id: 'tr-m-cihan', voice_id: 'Md4RAnfKt9kVIbvqUxly', name: 'Cihan', accent: 'Turkish', gender: 'male', description: 'Profesyonel erkek ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/EssLD6WbhOTGIoaNSeoJVncYe812/voices/Md4RAnfKt9kVIbvqUxly/64c78a1e-1ffb-434e-8572-c5bb9f18e2c4.mp3' },
    { id: 'tr-m-yunus', voice_id: 'Q5n6GDIjpN0pLOlycRFT', name: 'Yunus', accent: 'Turkish', gender: 'male', description: 'Karizmatik erkek ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/hmBU2trKB2hw1VCZYKUk7n9zfwP2/voices/Q5n6GDIjpN0pLOlycRFT/b01f7a6e-3e30-47a0-8b9f-d6987e25163c.mp3' },
    { id: 'tr-m-murat', voice_id: 'xouejoTN10DvXRSlXvmB', name: 'Murat', accent: 'Turkish', gender: 'male', description: 'Deneyimli erkek ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/oprsCAF2LpPdjUiJs7W6JHIjxMg2/voices/xouejoTN10DvXRSlXvmB/18070134-9ffe-4e87-907b-96a6410d5b7d.mp3' },
    { id: 'tr-m-sukru', voice_id: 'pMQM2vAjnEa9PmfDvgkY', name: 'Şükrü', accent: 'Turkish', gender: 'male', description: 'Güvenilir erkek ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/e38d0dd07ef84d7f82003e8028ade68f/voices/pMQM2vAjnEa9PmfDvgkY/ikMvxEZK1IAvzge4BY0u.mp3' },
    { id: 'tr-f-aslihan', voice_id: '973ByT3y0FasCLLTLBAL', name: 'Aslıhan', accent: 'Turkish', gender: 'female', description: 'Profesyonel kadın ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/yOsT3S9G9JaOe6iwHGTc6MTQDH73/voices/973ByT3y0FasCLLTLBAL/d0253eca-154c-498e-84b4-d107b1938168.mp3' },
    { id: 'tr-f-ecem', voice_id: 'PVbzZmwmdI99VcmuRK7G', name: 'Ecem', accent: 'Turkish', gender: 'female', description: 'Genç kadın ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/sIiYnRQWXKRCtsXHgjdLDc6NSZW2/voices/PVbzZmwmdI99VcmuRK7G/d005c731-034f-4288-ac0c-1b607a69a405.mp3' },
    { id: 'tr-f-gokce', voice_id: 'oPC5I9GKjMReiaM29gjY', name: 'Gökçe', accent: 'Turkish', gender: 'female', description: 'Sıcak kadın ses', provider: '11labs', preview_url: 'https://storage.googleapis.com/eleven-public-prod/database/user/vVKic6viINPymeEg3vbDtuIJ0LZ2/voices/oPC5I9GKjMReiaM29gjY/TCHpvhpoS2nZ7wcuT6Py.mp3' }
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
async function enrichVoicesWithPreviews(voices) {
  const enrichedVoices = await Promise.all(
    voices.map(async (voice) => {
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

    // Enrich with preview URLs if requested
    if (withSamples === 'true') {
      voices = await enrichVoicesWithPreviews(voices);
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
      allVoices[lang] = await enrichVoicesWithPreviews(VOICE_LIBRARY[lang]);
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

// GET sample audio for a voice from 11Labs
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
