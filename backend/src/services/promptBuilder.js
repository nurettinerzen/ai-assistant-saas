import { BASE_RULES } from '../config/prompts/base-rules.js';
import { BUSINESS_TEMPLATES } from '../config/prompts/business-templates.js';
import { TONE_RULES } from '../config/prompts/tone-rules.js';

/**
 * Asistan için tam prompt oluşturur
 * @param {Object} assistant - Asistan objesi
 * @param {Object} business - Business objesi
 * @param {Array} integrations - Aktif entegrasyon listesi
 * @returns {String} Birleştirilmiş prompt
 */
export function buildAssistantPrompt(assistant, business, integrations = []) {

  // 1. Business type'a göre template seç
  const businessType = business.businessType || 'OTHER';
  const template = BUSINESS_TEMPLATES[businessType] || BUSINESS_TEMPLATES.OTHER;

  // 2. Ton kurallarını al
  const tone = assistant.tone || 'professional';
  const toneRules = TONE_RULES[tone] || TONE_RULES.professional;

  // 3. Değişkenler
  const variables = {
    business_name: business.name || 'İşletme',
    assistant_name: assistant.name || 'Asistan',
    default_language: business.language === 'TR' ? 'Türkçe' : (business.language === 'EN' ? 'English' : business.language || 'Türkçe'),
    working_hours: ''
  };

  // 4. Prompt birleştir
  let prompt = BASE_RULES;
  prompt += '\n\n' + template;
  prompt += '\n\n' + toneRules;

  // 5. Kullanıcının özel notlarını ekle
  if (assistant.customNotes && assistant.customNotes.trim()) {
    prompt += `\n\n## İŞLETME ÖZEL BİLGİLER\n${assistant.customNotes}`;
  }

  // 6. Mevcut custom prompt varsa ekle (assistant.systemPrompt veya assistant.prompt)
  const customPrompt = assistant.systemPrompt;
  if (customPrompt && customPrompt.trim()) {
    prompt += `\n\n## EK TALİMATLAR\n${customPrompt}`;
  }

  // 7. Aktif entegrasyonları belirt
  if (integrations.length > 0) {
    const integrationNames = integrations.map(i => {
      const names = {
        'check_order_status': 'Sipariş durumu sorgulama',
        'get_product_stock': 'Stok kontrolü',
        'get_tracking_info': 'Kargo takip',
        'create_appointment': 'Randevu oluşturma',
        'check_appointment': 'Randevu sorgulama',
        'cancel_appointment': 'Randevu iptal',
        'take_order': 'Sipariş alma',
        'check_menu': 'Menü bilgisi'
      };
      return names[i] || i;
    });
    prompt += `\n\n## KULLANILAN ARAÇLAR\nŞu işlemleri yapabilirsin: ${integrationNames.join(', ')}`;
  }

  // 8. Dinamik context - Business timezone kullan
  const now = new Date();
  const timezone = business.timezone || 'Europe/Istanbul';
  const locale = business.language === 'TR' ? 'tr-TR' : 'en-US';

  const dateStr = now.toLocaleDateString(locale, {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });

  if (business.language === 'TR') {
    prompt += `\n\n## GÜNCEL BİLGİLER
- Bugün: ${dateStr}
- Saat: ${timeStr}
- Saat Dilimi: ${timezone}`;
  } else {
    prompt += `\n\n## CURRENT INFORMATION
- Today: ${dateStr}
- Time: ${timeStr}
- Timezone: ${timezone}`;
  }

  // 9. Çalışma saatleri varsa ekle
  if (variables.working_hours) {
    prompt += `\n- Çalışma saatleri: ${variables.working_hours}`;
  }

  // 10. Değişkenleri yerine koy
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return prompt;
}

/**
 * Aktif tool listesini döndürür
 * @param {Object} business - Business objesi
 * @param {Array} integrations - Integration listesi
 * @returns {Array} Tool isimleri
 */
export function getActiveTools(business, integrations = []) {
  const tools = [];

  // Integration'lara göre tool ekle
  const integrationTypes = integrations.map(i => i.type);

  // E-ticaret entegrasyonları
  if (integrationTypes.includes('SHOPIFY') ||
      integrationTypes.includes('WOOCOMMERCE') ||
      integrationTypes.includes('TRENDYOL') ||
      integrationTypes.includes('IKAS') ||
      integrationTypes.includes('IDEASOFT') ||
      integrationTypes.includes('TICIMAX')) {
    tools.push('check_order_status', 'get_product_stock', 'get_tracking_info');
  }

  // Takvim entegrasyonları
  if (integrationTypes.includes('GOOGLE_CALENDAR') ||
      integrationTypes.includes('CALENDLY')) {
    tools.push('create_appointment', 'check_appointment', 'cancel_appointment');
  }

  // Kargo entegrasyonları
  if (integrationTypes.includes('YURTICI_KARGO') ||
      integrationTypes.includes('ARAS_KARGO') ||
      integrationTypes.includes('MNG_KARGO') ||
      integrationTypes.includes('SHIPSTATION')) {
    if (!tools.includes('get_tracking_info')) {
      tools.push('get_tracking_info');
    }
  }

  // Restoran ise sipariş alma
  if (business.businessType === 'RESTAURANT') {
    tools.push('take_order', 'check_menu');
  }

  // Randevu bazlı işletmeler
  if (business.businessType === 'SALON' || business.businessType === 'CLINIC') {
    if (!tools.includes('create_appointment')) {
      tools.push('create_appointment', 'check_appointment', 'cancel_appointment');
    }
  }

  return tools;
}
