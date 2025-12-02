import express from 'express';
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

// In-memory cache
const cache = {};

router.post('/', async (req, res) => {
  try {
    const { texts, targetLang } = req.body;
    
    if (!texts || !targetLang || targetLang === 'en') {
      return res.json({ translations: texts });
    }

    const results = [];
    const toTranslate = [];
    const indices = [];

    // Check cache first
    texts.forEach((text, i) => {
      const key = `${targetLang}:${text}`;
      if (cache[key]) {
        results[i] = cache[key];
      } else {
        toTranslate.push(text);
        indices.push(i);
      }
    });

    // Translate uncached texts
    if (toTranslate.length > 0) {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: toTranslate,
            target: targetLang,
            source: 'en',
            format: 'text'
          })
        }
      );

      const data = await response.json();
      
      if (data.data?.translations) {
        data.data.translations.forEach((t, i) => {
          const originalText = toTranslate[i];
          const translated = t.translatedText;
          cache[`${targetLang}:${originalText}`] = translated;
          results[indices[i]] = translated;
        });
      }
    }

    res.json({ translations: results });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed', translations: req.body.texts });
  }
});

export default router;
