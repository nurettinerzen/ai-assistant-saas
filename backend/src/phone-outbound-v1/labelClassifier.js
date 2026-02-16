import OpenAI from 'openai';

export const PHONE_OUTBOUND_V1_LABELS = [
  'YES',
  'NO',
  'LATER',
  'DONT_CALL',
  'ASK_AGENT',
  'UNKNOWN'
];

const KEYWORD_PATTERNS = {
  DONT_CALL: [
    /\b(beni arama|bizi arama|aramayin|aramayin|arama)\b/i,
    /\b(dont call|do not call|stop calling|remove me|unsubscribe)\b/i,
    /\b(listeden cikar|numarami sil)\b/i
  ],
  ASK_AGENT: [
    /\b(temsilci\w*|yetkili\w*|operator\w*|insan\w*|canli destek)\b/i,
    /\b(agent\w*|human\w*|representative\w*|supervisor\w*)\b/i
  ],
  LATER: [
    /\b(daha sonra|sonra|simdi degil|uygun degilim)\b/i,
    /\b(later|not now|call later|another time)\b/i
  ],
  NO: [
    /\b(hayir|istemiyorum|uygun degil|reddediyorum)\b/i,
    /\b(no|nope|not interested|decline)\b/i
  ],
  YES: [
    /\b(evet|olur|uygun|tamam|onayliyorum)\b/i,
    /\b(yes|yeah|yep|okay|ok|sure|confirm)\b/i
  ]
};

let openaiClient = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openaiClient;
}

function normalizeText(raw = '') {
  return String(raw)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyByKeywords(utterance = '') {
  const normalized = normalizeText(utterance);
  if (!normalized) {
    return 'UNKNOWN';
  }

  const orderedLabels = ['DONT_CALL', 'ASK_AGENT', 'LATER', 'NO', 'YES'];

  for (const label of orderedLabels) {
    const patterns = KEYWORD_PATTERNS[label] || [];
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return label;
    }
  }

  return 'UNKNOWN';
}

function parseLLMLabel(rawLabel, allowedLabels) {
  const safeAllowed = Array.isArray(allowedLabels) && allowedLabels.length > 0
    ? allowedLabels
    : PHONE_OUTBOUND_V1_LABELS;

  const normalized = String(rawLabel || '').toUpperCase();
  const match = normalized.match(/\b(YES|NO|LATER|DONT_CALL|ASK_AGENT|UNKNOWN)\b/);
  const parsed = match ? match[1] : 'UNKNOWN';

  if (!safeAllowed.includes(parsed)) {
    return 'UNKNOWN';
  }

  return parsed;
}

async function classifyByLLM(utterance, allowedLabels) {
  const client = getOpenAIClient();
  if (!client) {
    return 'UNKNOWN';
  }

  const labelList = (allowedLabels && allowedLabels.length > 0
    ? allowedLabels
    : PHONE_OUTBOUND_V1_LABELS).join(', ');

  const prompt = [
    'Kullanici yanitini etikete cevir.',
    `Sadece su etiketlerden birini don: ${labelList}.`,
    'Cevapta aciklama, JSON veya ek metin verme.',
    `Yanit: "${String(utterance || '').slice(0, 280)}"`
  ].join('\n');

  try {
    const completion = await client.chat.completions.create({
      model: process.env.PHONE_OUTBOUND_V1_CLASSIFIER_MODEL || 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 8,
      messages: [
        {
          role: 'system',
          content: 'Sen bir etiketleyicisin. Sadece tek bir etiket donersin.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content;
    return parseLLMLabel(raw, allowedLabels);
  } catch (error) {
    console.error('⚠️ [PHONE_OUTBOUND_V1] LLM label classification failed:', error.message);
    return 'UNKNOWN';
  }
}

export async function classifyLabel({
  utterance = '',
  dtmfDigits = '',
  dtmfMap = null,
  allowedLabels = PHONE_OUTBOUND_V1_LABELS,
  classifierMode = 'KEYWORD_ONLY'
} = {}) {
  const cleanDigits = String(dtmfDigits || '').trim();
  if (cleanDigits && dtmfMap && dtmfMap[cleanDigits]) {
    const dtmfLabel = String(dtmfMap[cleanDigits]).toUpperCase();
    if ((allowedLabels || PHONE_OUTBOUND_V1_LABELS).includes(dtmfLabel)) {
      return dtmfLabel;
    }
  }

  if (classifierMode === 'LLM_LABEL_ONLY') {
    return classifyByLLM(utterance, allowedLabels);
  }

  const keywordLabel = classifyByKeywords(utterance);
  if ((allowedLabels || PHONE_OUTBOUND_V1_LABELS).includes(keywordLabel)) {
    return keywordLabel;
  }

  return 'UNKNOWN';
}

export default {
  classifyLabel,
  PHONE_OUTBOUND_V1_LABELS
};
