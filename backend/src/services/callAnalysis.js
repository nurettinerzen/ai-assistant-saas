/**
 * Call Analysis Service
 * Uses OpenAI to analyze call transcripts and generate summaries, topics, actions, and sentiment
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze a call transcript using OpenAI GPT-4o-mini
 * @param {Array} messages - Array of transcript messages [{speaker, text, timestamp}]
 * @param {number} duration - Call duration in seconds
 * @param {string} language - Output language ('tr' for Turkish, default)
 * @returns {Promise<Object>} Analysis results with summary, topics, actions, and sentiment
 */
export async function analyzeCall(messages, duration, language = 'tr') {
  try {
    if (!messages || messages.length === 0) {
      return {
        summary: null,
        keyTopics: [],
        actionItems: [],
        sentiment: 'neutral',
        sentimentScore: 0.5,
      };
    }

    // Format transcript for analysis
    const transcriptText = messages
      .map((msg) => `${msg.speaker === 'assistant' ? 'AI' : 'Müşteri'}: ${msg.text}`)
      .join('\n');

    // Create analysis prompt in Turkish
    const prompt = `Aşağıdaki müşteri hizmetleri görüşme kaydını analiz et ve şunları belirle:
1. Kısa özet (1-2 cümle, Türkçe)
2. Konuşulan ana konular (en fazla 5, dizi olarak, Türkçe)
3. Tespit edilen aksiyon maddeleri (en fazla 5, dizi olarak, Türkçe)
4. Genel duygu durumu (positive/neutral/negative)
5. Duygu skoru (0.0 - 1.0 arası, 0.0 çok olumsuz, 1.0 çok olumlu)

Görüşme süresi: ${Math.round(duration / 60)} dakika

Görüşme kaydı:
${transcriptText}

JSON formatında yanıt ver:
{
  "summary": "Görüşmenin kısa özeti (Türkçe)",
  "keyTopics": ["konu1", "konu2", "konu3"],
  "actionItems": ["aksiyon1", "aksiyon2"],
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen bir çağrı analiz asistanısın. Görüşme kayıtlarını analiz et ve yapılandırılmış içgörüleri JSON formatında TÜRKÇE olarak sun.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    // Validate and normalize the response
    return {
      summary: analysis.summary || null,
      keyTopics: Array.isArray(analysis.keyTopics) ? analysis.keyTopics.slice(0, 5) : [],
      actionItems: Array.isArray(analysis.actionItems) ? analysis.actionItems.slice(0, 5) : [],
      sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment)
        ? analysis.sentiment
        : 'neutral',
      sentimentScore: typeof analysis.sentimentScore === 'number'
        ? Math.max(0, Math.min(1, analysis.sentimentScore))
        : 0.5,
    };
  } catch (error) {
    console.error('❌ Call analysis error:', error);

    // Return default values on error
    return {
      summary: null,
      keyTopics: [],
      actionItems: [],
      sentiment: 'neutral',
      sentimentScore: 0.5,
    };
  }
}

/**
 * Generate a quick summary of a call (lightweight version)
 * @param {string} transcriptText - Plain text transcript
 * @returns {Promise<string>} Summary text
 */
export async function generateQuickSummary(transcriptText) {
  try {
    if (!transcriptText || transcriptText.trim().length === 0) {
      return null;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a call summarization assistant. Create brief, one-sentence summaries of customer service calls.',
        },
        {
          role: 'user',
          content: `Summarize this call in one sentence:\n\n${transcriptText.slice(0, 2000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Quick summary error:', error);
    return null;
  }
}

/**
 * Extract plain text from transcript messages for search
 * @param {Array} messages - Array of transcript messages
 * @returns {string} Plain text transcript
 */
export function extractTranscriptText(messages) {
  if (!messages || !Array.isArray(messages)) {
    return '';
  }

  return messages
    .map((msg) => msg.text || '')
    .join(' ')
    .trim();
}

// ============================================================================
// NORMALLEŞTİRİLMİŞ KATEGORİ/KONU BELİRLEME
// ============================================================================

/**
 * Tanımlı kategori ve konular
 * Her iş için standart kategoriler ve alt konular
 */
const NORMALIZED_CATEGORIES = {
  'Sipariş': [
    'Sipariş Durumu Sorgulama',
    'Yeni Sipariş Verme',
    'Sipariş İptali',
    'Sipariş Değişikliği',
    'Sipariş Onayı'
  ],
  'İade': [
    'İade Talebi',
    'İade Durumu',
    'İade Koşulları',
    'Değişim Talebi'
  ],
  'Ödeme': [
    'Ödeme Sorunu',
    'Fatura Bilgisi',
    'Ödeme Yöntemleri',
    'Taksit Seçenekleri'
  ],
  'Muhasebe': [
    'Borç Bilgisi',
    'Cari Hesap',
    'Mutabakat',
    'Beyanname Bilgisi',
    'Vergi Hesaplaması'
  ],
  'Ürün': [
    'Ürün Bilgisi',
    'Stok Durumu',
    'Fiyat Bilgisi',
    'Ürün Karşılaştırma'
  ],
  'Teslimat': [
    'Teslimat Takibi',
    'Teslimat Süresi',
    'Teslimat Adresi Değişikliği',
    'Teslimat Sorunu'
  ],
  'Destek': [
    'Teknik Destek',
    'Şikayet',
    'Öneri',
    'Genel Bilgi'
  ],
  'Randevu': [
    'Randevu Alma',
    'Randevu İptali',
    'Randevu Değişikliği',
    'Randevu Hatırlatma'
  ],
  'Genel': [
    'Selamlama',
    'Teşekkür',
    'Diğer'
  ]
};

/**
 * Transkript veya mesajlardan normalleştirilmiş kategori ve konu belirle
 * @param {string} transcript - Transkript metni
 * @returns {Promise<Object>} { normalizedCategory, normalizedTopic }
 */
export async function determineNormalizedTopic(transcript) {
  try {
    if (!transcript || transcript.trim().length < 20) {
      return {
        normalizedCategory: 'Genel',
        normalizedTopic: 'Diğer'
      };
    }

    // Kategorileri ve konuları prompt için hazırla
    const categoriesDescription = Object.entries(NORMALIZED_CATEGORIES)
      .map(([category, topics]) => `- ${category}: ${topics.join(', ')}`)
      .join('\n');

    const prompt = `Aşağıdaki müşteri görüşmesinin ana konusunu belirle.

## Mevcut Kategoriler ve Konular:
${categoriesDescription}

## Görüşme:
${transcript.slice(0, 2000)}

## Talimatlar:
1. Görüşmenin ANA konusunu belirle (müşterinin asıl amacı neydi?)
2. Yukarıdaki listeden en uygun kategori ve konuyu seç
3. Eğer hiçbir konu tam uymuyorsa, en yakın olanı seç
4. Selamlama/vedalaşma dışında bir konu yoksa "Genel > Diğer" seç

JSON formatında yanıt ver:
{
  "normalizedCategory": "Kategori adı",
  "normalizedTopic": "Konu adı"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen bir görüşme sınıflandırma asistanısın. Görüşmeleri önceden tanımlı kategorilere göre sınıflandır.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Geçerli kategori/konu kontrolü
    const category = result.normalizedCategory;
    const topic = result.normalizedTopic;

    // Kategori geçerli mi?
    if (NORMALIZED_CATEGORIES[category]) {
      // Konu bu kategoride var mı?
      if (NORMALIZED_CATEGORIES[category].includes(topic)) {
        return { normalizedCategory: category, normalizedTopic: topic };
      }
      // Konu geçersiz ama kategori geçerli - ilk konuyu kullan
      return {
        normalizedCategory: category,
        normalizedTopic: NORMALIZED_CATEGORIES[category][0]
      };
    }

    // Kategori geçersiz - varsayılan döndür
    return {
      normalizedCategory: 'Genel',
      normalizedTopic: 'Diğer'
    };
  } catch (error) {
    console.error('❌ determineNormalizedTopic error:', error);
    return {
      normalizedCategory: 'Genel',
      normalizedTopic: 'Diğer'
    };
  }
}

/**
 * Chat mesajlarından transcript metni oluştur
 * @param {Array} messages - Chat mesajları [{role, content}]
 * @returns {string} Transcript metni
 */
export function formatChatMessagesAsTranscript(messages) {
  if (!messages || !Array.isArray(messages)) {
    return '';
  }

  return messages
    .map((msg) => {
      const speaker = msg.role === 'assistant' ? 'AI' : 'Müşteri';
      return `${speaker}: ${msg.content || msg.text || ''}`;
    })
    .join('\n');
}

// ============================================================================
// YENİ DURUM ANALİZİ FONKSİYONLARI
// ============================================================================

/**
 * Arama transkriptini analiz eder ve içerik durumunu belirler
 * @param {string} transcript - Arama transkripti
 * @param {string} callType - 'inbound' veya 'outbound'
 * @returns {Promise<Object>} Analiz sonucu
 */
export async function analyzeCallContent(transcript, callType = 'inbound') {
  try {
    if (!transcript || transcript.trim().length < 50) {
      // Transkript çok kısa, analiz yapma
      return {
        totalRequests: 0,
        answeredRequests: 0,
        callbackCreated: false,
        customerSatisfied: null,
        unansweredCategories: [],
        summary: 'Transkript analiz için yeterli değil',
        callStatus: 'NEUTRAL'
      };
    }

    const prompt = `
Aşağıdaki telefon görüşmesi transkriptini analiz et.

## Analiz Kriterleri

1. **Müşteri Talepleri**: Müşteri kaç soru sordu veya kaç talep iletti?
2. **Cevaplanan Talepler**: Kaç tanesi asistan tarafından başarıyla cevaplandı/çözüldü?
3. **Geri Arama Kaydı**: Müşteriye geri arama sözü verildi mi?
4. **Görüşme Sonucu**: Müşteri memnun ayrıldı mı?
5. **Sorun Türleri**: Cevaplanamayan sorular hangi kategorilerde? (bilgi_eksikligi, yetki_disi, teknik_sorun, mesai_disi)

## Transkript
${transcript}

## Yanıt Formatı (JSON)
{
  "totalRequests": <sayı>,
  "answeredRequests": <sayı>,
  "callbackCreated": <boolean>,
  "customerSatisfied": <boolean | null>,
  "unansweredCategories": [<string>],
  "summary": "<kısa özet>"
}

Sadece JSON döndür, başka açıklama ekleme.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    // Durum hesapla
    const callStatus = calculateCallStatus(analysis);

    return {
      ...analysis,
      callStatus
    };
  } catch (error) {
    console.error('❌ analyzeCallContent error:', error);
    return null;
  }
}

/**
 * Analiz sonucuna göre içerik durumunu hesapla
 * @param {Object} analysis - Analiz sonucu
 * @returns {string} POSITIVE, NEUTRAL veya NEGATIVE
 */
function calculateCallStatus(analysis) {
  const { totalRequests, answeredRequests, callbackCreated } = analysis;

  // Hiç talep yoksa (sadece selamlama/vedalaşma)
  if (totalRequests === 0) {
    return 'NEUTRAL';
  }

  // Geri arama oluşturuldu ise
  if (callbackCreated) {
    return 'NEUTRAL'; // İnsana aktarıldı/geri arama
  }

  const answerRate = answeredRequests / totalRequests;

  if (answerRate >= 0.8) {
    return 'POSITIVE';  // %80+ cevaplandı
  } else if (answerRate >= 0.5) {
    return 'NEUTRAL';   // %50-80 cevaplandı
  } else {
    return 'NEGATIVE';  // %50'den az cevaplandı
  }
}

/**
 * Arama teknik sonucunu belirle
 * @param {Object} callData - 11Labs'tan gelen arama verisi
 * @returns {string} SUCCESS, FAILED, NO_ANSWER, VOICEMAIL, BUSY
 */
export function determineCallResult(callData) {
  // Hata varsa
  if (callData.error || callData.status === 'error' || callData.status === 'failed') {
    return 'FAILED';
  }

  // Sesli mesaj algılandı
  if (callData.voicemailDetected || callData.voicemail_detected) {
    return 'VOICEMAIL';
  }

  // Cevap verilmedi
  if (callData.status === 'no-answer' || callData.status === 'no_answer') {
    return 'NO_ANSWER';
  }

  // Süre çok kısaysa (5 saniyeden az)
  const duration = callData.duration || callData.call_duration || 0;
  if (duration < 5 && callData.status !== 'completed') {
    return 'NO_ANSWER';
  }

  // Meşgul
  if (callData.status === 'busy') {
    return 'BUSY';
  }

  // Başarılı arama
  return 'SUCCESS';
}

/**
 * Arama bittiğinde tam analiz yap
 * @param {string} conversationId - Arama ID
 * @param {string} transcript - Transkript
 * @param {Object} callData - Arama verisi
 * @returns {Promise<Object>} { callResult, callStatus, analysisData, voicemailDetected }
 */
export async function analyzeCompletedCall(conversationId, transcript, callData) {
  try {
    // Teknik sonuç belirle
    const callResult = determineCallResult(callData);

    // Voicemail kontrolü
    const voicemailDetected = callResult === 'VOICEMAIL';

    // İçerik analizi yap (sadece başarılı aramalar için)
    let callStatus = null;
    let analysisData = null;

    if (callResult === 'SUCCESS' && transcript) {
      const analysis = await analyzeCallContent(transcript);
      if (analysis) {
        callStatus = analysis.callStatus;
        analysisData = analysis;
      }
    }

    return {
      callResult,
      callStatus,
      analysisData,
      voicemailDetected
    };
  } catch (error) {
    console.error('❌ analyzeCompletedCall error:', error);
    return {
      callResult: 'FAILED',
      callStatus: null,
      analysisData: null,
      voicemailDetected: false
    };
  }
}

export default {
  analyzeCall,
  generateQuickSummary,
  extractTranscriptText,
  // Durum analizi fonksiyonları
  analyzeCallContent,
  determineCallResult,
  analyzeCompletedCall,
  // Normalleştirilmiş konu fonksiyonları
  determineNormalizedTopic,
  formatChatMessagesAsTranscript,
  NORMALIZED_CATEGORIES
};
