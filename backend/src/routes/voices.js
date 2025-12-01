import express from 'express';
const router = express.Router();

// Voice Library with full details
const VOICE_LIBRARY = {
  tr: [
    { id: 'tr-m-cihan', name: 'Cihan', accent: 'Turkish', gender: 'male', description: 'Profesyonel erkek ses' },
    { id: 'tr-m-yunus', name: 'Yunus', accent: 'Turkish', gender: 'male', description: 'Samimi erkek ses' },
    { id: 'tr-m-sukru', name: 'Şükrü', accent: 'Turkish', gender: 'male', description: 'Olgun erkek ses' },
    { id: 'tr-m-murat', name: 'Murat', accent: 'Turkish', gender: 'male', description: 'Enerjik erkek ses' },
    { id: 'tr-f-ecem', name: 'Ecem', accent: 'Turkish', gender: 'female', description: 'Genç kadın ses' },
    { id: 'tr-f-aslihan', name: 'Aslıhan', accent: 'Turkish', gender: 'female', description: 'Profesyonel kadın ses' },
    { id: 'tr-f-gokce', name: 'Gökçe', accent: 'Turkish', gender: 'female', description: 'Samimi kadın ses' },
    { id: 'tr-f-auralis', name: 'Auralis', accent: 'Turkish', gender: 'female', description: 'Zarif kadın ses' }
  ],
  en: [
    { id: 'en-m-jude', name: 'Jude', accent: 'American', gender: 'male', description: 'Professional American male' },
    { id: 'en-m-stokes', name: 'Stokes', accent: 'American', gender: 'male', description: 'Friendly American male' },
    { id: 'en-m-andrew', name: 'Andrew', accent: 'American', gender: 'male', description: 'Confident American male' },
    { id: 'en-m-ollie', name: 'Ollie', accent: 'British', gender: 'male', description: 'Sophisticated British male' },
    { id: 'en-f-kayla', name: 'Kayla', accent: 'American', gender: 'female', description: 'Warm American female' },
    { id: 'en-f-shelby', name: 'Shelby', accent: 'British', gender: 'female', description: 'Professional British female' },
    { id: 'en-f-roshni', name: 'Roshni', accent: 'British', gender: 'female', description: 'Elegant British female' },
    { id: 'en-f-meera', name: 'Meera', accent: 'British', gender: 'female', description: 'Friendly British female' }
  ]
};

// GET all voices
router.get('/', (req, res) => {
  const { language } = req.query;
  
  if (language && VOICE_LIBRARY[language.toLowerCase()]) {
    return res.json({ voices: VOICE_LIBRARY[language.toLowerCase()] });
  }
  
  res.json({ 
    voices: {
      turkish: VOICE_LIBRARY.tr,
      english: VOICE_LIBRARY.en
    }
  });
});

// GET voice by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const allVoices = [...VOICE_LIBRARY.tr, ...VOICE_LIBRARY.en];
  const voice = allVoices.find(v => v.id === id);
  
  if (!voice) {
    return res.status(404).json({ error: 'Voice not found' });
  }
  
  res.json({ voice });
});

export default router;