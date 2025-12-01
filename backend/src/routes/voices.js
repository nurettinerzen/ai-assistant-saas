import express from 'express';
const router = express.Router();

// 🌍 VOICE LIBRARY - 15+ LANGUAGES SUPPORT
// Each language has 2 male + 2 female voices from 11Labs
const VOICE_LIBRARY = {
  // TURKISH
  tr: [
    { id: 'tr-m-cihan', name: 'Cihan', accent: 'Turkish', gender: 'male', description: 'Profesyonel erkek ses', provider: '11labs' },
    { id: 'tr-m-yunus', name: 'Yunus', accent: 'Turkish', gender: 'male', description: 'Samimi erkek ses', provider: '11labs' },
    { id: 'tr-f-ecem', name: 'Ecem', accent: 'Turkish', gender: 'female', description: 'Genç kadın ses', provider: '11labs' },
    { id: 'tr-f-aslihan', name: 'Aslıhan', accent: 'Turkish', gender: 'female', description: 'Profesyonel kadın ses', provider: '11labs' }
  ],
  
  // ENGLISH
  en: [
    { id: 'en-m-jude', name: 'Jude', accent: 'American', gender: 'male', description: 'Professional American male', provider: '11labs' },
    { id: 'en-m-stokes', name: 'Stokes', accent: 'American', gender: 'male', description: 'Friendly American male', provider: '11labs' },
    { id: 'en-f-kayla', name: 'Kayla', accent: 'American', gender: 'female', description: 'Warm American female', provider: '11labs' },
    { id: 'en-f-shelby', name: 'Shelby', accent: 'British', gender: 'female', description: 'Professional British female', provider: '11labs' }
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

// GET all voices
router.get('/', (req, res) => {
  const { language } = req.query;
  
  console.log('🎤 GET /api/voices - language:', language);
  
  // If specific language requested
  if (language && VOICE_LIBRARY[language.toLowerCase()]) {
    return res.json({ 
      voices: VOICE_LIBRARY[language.toLowerCase()],
      count: VOICE_LIBRARY[language.toLowerCase()].length
    });
  }
  
  // Return all voices organized by language
  const allVoices = {};
  Object.keys(VOICE_LIBRARY).forEach(lang => {
    allVoices[lang] = VOICE_LIBRARY[lang];
  });
  
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

export default router;
