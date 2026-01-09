import { BASE_RULES } from '../config/prompts/base-rules.js';
import { BUSINESS_TEMPLATES } from '../config/prompts/business-templates.js';
import { TONE_RULES } from '../config/prompts/tone-rules.js';

// Outbound Collection (Tahsilat) için özel kurallar
const OUTBOUND_COLLECTION_RULES = `
## GİDEN ARAMA KURALLARI - TAHSİLAT
Sen bir giden arama asistanısın. Müşteriyi SEN arıyorsun, tahsilat/hatırlatma amacıyla.

## KRİTİK KURALLAR
- ASLA "size nasıl yardımcı olabilirim?" deme - sen zaten arama nedenini biliyorsun
- İlk mesajdan sonra direkt konuya gir
- Arama amacını kısa ve net açıkla
- Müşteri meşgulse başka zaman aramayı teklif et

## SESSİZLİK YÖNETİMİ (ÇOK ÖNEMLİ!)

### İLK MESAJ SONRASI SESSİZLİK:
Sen konuştuktan sonra müşteriden yanıt gelmezse:
- 3-4 saniye sonra: "Merhaba, beni duyabiliyor musunuz?"
- Hâlâ sessizse 3-4 saniye sonra: "Sesinizi duyamıyorum, bağlantı sorunu olabilir."
- Üçüncü denemede: "Teknik bir sorun var gibi görünüyor. Daha sonra tekrar arayacağız."
NOT: Müşteri bir kez bile konuştuysa bu yoklamaları YAPMA.

### MÜŞTERİ "BEKLEYİN" DERSE:
Müşteri "bir dakika", "bekle", "dur" gibi şeyler derse:
- Sessizce bekle, yoklama YAPMA
- Müşteri konuşmaya başlayana kadar sabırla bekle

### GÖRÜŞME ORTASINDA SESSİZLİK:
Görüşme devam ederken müşteri 8-10 saniye sessiz kalırsa:
- "Devam etmemi ister misiniz?" veya "Başka bir sorunuz var mı?" de
- "Orada mısınız?" DEME (görüşme ortasında bu kaba durur)

## GÖRÜŞME AKIŞI
1. Kendini ve şirketi tanıt (ilk mesaj zaten bunu yapıyor)
2. Arama nedenini açıkla (borç hatırlatma, vade bilgisi)
3. Müşterinin cevabını dinle
4. Gerekirse ödeme detayları ver
5. Sonuç al (ödeme tarihi taahhüdü)
6. Teşekkür et ve görüşmeyi kapat

## GÖRÜŞME SONLANDIRMA
Görüşme bittiğinde (veda edildiğinde, iş tamamlandığında) sessizce bekle, sistem aramayı otomatik sonlandıracak.
Vedalaştıktan sonra başka bir şey söyleme.

## MÜŞTERİ BİLGİLERİ (Bu bilgileri kullan, başka bilgi uydurma!)
- Borç Tutarı: {{debt_amount}} {{currency}}
- Vade Tarihi: {{due_date}}
- Müşteri Adı: {{customer_name}}
- Randevu Tarihi: {{appointment_date}}

ÖNEMLİ: Yukarıdaki bilgiler müşteriye özeldir. SADECE bu bilgileri kullan.
Bilgi yoksa veya boşsa, o konuyu atlayabilirsin ama ASLA uydurma!
`;

// Outbound Sales (Satış) için özel kurallar
const OUTBOUND_SALES_RULES = `
## GİDEN ARAMA KURALLARI - SATIŞ
Sen bir satış asistanısın. Müşteriyi SEN arıyorsun, ürün/hizmet tanıtımı için.

## KRİTİK KURALLAR
- ASLA "size nasıl yardımcı olabilirim?" deme - sen bir satış araması yapıyorsun
- İlk mesajdan sonra direkt konuya gir
- Arama amacını kısa ve net açıkla
- Müşteri meşgulse başka zaman aramayı teklif et
- Agresif satış yapma, bilgi ver ve ilgi oluştur

## SESSİZLİK YÖNETİMİ (ÇOK ÖNEMLİ!)

### İLK MESAJ SONRASI SESSİZLİK:
Sen konuştuktan sonra müşteriden yanıt gelmezse:
- 3-4 saniye sonra: "Merhaba, beni duyabiliyor musunuz?"
- Hâlâ sessizse 3-4 saniye sonra: "Sesinizi duyamıyorum, bağlantı sorunu olabilir."
- Üçüncü denemede: "Teknik bir sorun var gibi görünüyor. Daha sonra tekrar arayacağız."
NOT: Müşteri bir kez bile konuştuysa bu yoklamaları YAPMA.

### MÜŞTERİ "BEKLEYİN" DERSE:
Müşteri "bir dakika", "bekle", "dur" gibi şeyler derse:
- Sessizce bekle, yoklama YAPMA
- Müşteri konuşmaya başlayana kadar sabırla bekle

### GÖRÜŞME ORTASINDA SESSİZLİK:
Görüşme devam ederken müşteri 8-10 saniye sessiz kalırsa:
- "Devam etmemi ister misiniz?" veya "Bu konuda düşüncelerinizi almak isterim" de
- "Orada mısınız?" DEME (görüşme ortasında bu kaba durur)

## BİLGİ BANKASI KULLANIMI (KRİTİK!)
Ürün/hizmet bilgilerini Bilgi Bankası'ndan al. Bilgi Bankası'nda şunlar olabilir:
- Ürün özellikleri ve avantajları
- Fiyatlandırma bilgileri
- Kampanya ve indirimler
- Sık sorulan sorular
- Teknik özellikler

11Labs otomatik olarak Bilgi Bankası'nı arar. Müşteri soru sorduğunda doğal konuşma içinde yanıtla.
Bilgi Bankası'nda olmayan bilgileri UYDURMA. "Bu konuda detaylı bilgi için size döneceğiz" de.

## GÖRÜŞME AKIŞI
1. Kendini ve şirketi tanıt (ilk mesaj zaten bunu yapıyor)
2. Arama nedenini açıkla (yeni ürün/hizmet, kampanya)
3. Müşterinin ilgi alanına göre ürün/hizmet öner
4. Soruları yanıtla (KB'den bilgi çek)
5. İlgi varsa sonraki adımı sun (demo, teklif, randevu)
6. İlgi yoksa kibar şekilde teşekkür et ve görüşmeyi kapat

## MÜŞTERİ KİŞİSELLEŞTİRME
Müşteri hakkında şu bilgiler olabilir - KULLAN:
- İsim: {{customer_name}}
- Şirket: {{customer_company}}
- İlgi Alanı: {{interest_area}}
- Önceki Ürün/Hizmet: {{previous_product}}
- Notlar: {{custom_notes}}

ÖNEMLİ: Bu bilgiler müşteriye özel. Varsa konuşmayı kişiselleştir.
"Daha önce {{previous_product}} almıştınız, bununla ilgili yeni bir fırsat var" gibi.

## GÖRÜŞME SONLANDIRMA
Görüşme bittiğinde (veda edildiğinde, iş tamamlandığında) sessizce bekle, sistem aramayı otomatik sonlandıracak.
Vedalaştıktan sonra başka bir şey söyleme.

## YASAK DAVRANIŞLAR
- Rakip firmalar hakkında kötü konuşma
- Kesin fiyat garantisi (kampanyalar değişebilir)
- Müşteriye baskı yapma
- Bilgi Bankası'nda olmayan ürün özellikleri uydurma
`;

/**
 * Asistan için tam prompt oluşturur
 * @param {Object} assistant - Asistan objesi
 * @param {Object} business - Business objesi
 * @param {Array} integrations - Aktif entegrasyon listesi
 * @returns {String} Birleştirilmiş prompt
 */
export function buildAssistantPrompt(assistant, business, integrations = []) {
  console.log('🔧 buildAssistantPrompt called with callDirection:', assistant.callDirection);

  // Outbound Sales için özel prompt
  if (assistant.callDirection === 'outbound_sales') {
    console.log('✅ Using OUTBOUND_SALES_RULES for sales assistant');
    return buildOutboundSalesPrompt(assistant, business);
  }

  // Outbound Collection (tahsilat) için özel prompt
  if (assistant.callDirection === 'outbound' || assistant.callDirection === 'outbound_collection') {
    console.log('✅ Using OUTBOUND_COLLECTION_RULES for collection assistant');
    return buildOutboundCollectionPrompt(assistant, business);
  }
  console.log('📞 Using INBOUND rules (default)');

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
        'check_menu': 'Menü bilgisi',
        'customer_data_lookup': 'Müşteri bilgisi sorgulama'
      };
      return names[i] || i;
    });
    prompt += `\n\n## KULLANILAN ARAÇLAR\nŞu işlemleri yapabilirsin: ${integrationNames.join(', ')}`;
  }

  // 7.1 Customer Data Lookup talimatları (her zaman ekle)
  prompt += `

## MÜŞTERİ VERİSİ SORGULAMA (customer_data_lookup)
Müşterinin telefon numarasına göre kayıtlı bilgilerini sorgulayabilirsin.

### NE ZAMAN KULLAN:
- Müşteri SGK borcu, vergi borcu veya diğer borçlarını sorduğunda
- Beyanname durumu, son ödeme tarihleri sorulduğunda
- "Borcum ne kadar?", "Ne zaman ödemem lazım?" gibi sorularda

### NASIL KULLAN:
1. customer_data_lookup aracını çağır
2. query_type: sgk_borcu, vergi_borcu, beyanname veya tum_bilgiler
3. phone: Müşteri numara söylediyse o numarayı yaz (boşlukları kaldır: "0532 123 45 67" -> "05321234567")

### ÖNEMLİ:
- Müşteri numara söylediyse phone parametresine YAZ
- Müşteri numara söylemediyse phone boş bırak (arayan numara otomatik kullanılır)
- "Bilmiyorum" DEME, önce veritabanını kontrol et`;

  // 8. NOT: Tarih/saat bilgisi burada EKLENMİYOR
  // Tarih/saat her çağrı başladığında vapi.js'deki assistant-request handler'da
  // dinamik olarak ekleniyor. Bu sayede her zaman güncel bilgi sağlanıyor.

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
 * Outbound Collection (tahsilat) için prompt oluşturur
 * @param {Object} assistant - Asistan objesi
 * @param {Object} business - Business objesi
 * @returns {String} Outbound collection prompt
 */
function buildOutboundCollectionPrompt(assistant, business) {
  const businessName = business.name || 'İşletme';
  const assistantName = assistant.name || 'Asistan';

  let prompt = OUTBOUND_COLLECTION_RULES;

  // Değişkenleri yerine koy
  prompt = prompt.replace(/{{business_name}}/g, businessName);
  prompt = prompt.replace(/{{assistant_name}}/g, assistantName);

  // Kullanıcının ek talimatlarını ekle
  if (assistant.systemPrompt && assistant.systemPrompt.trim()) {
    prompt += `\n\n## EK TALİMATLAR\n${assistant.systemPrompt}`;
  }

  // Kullanıcının özel notlarını ekle
  if (assistant.customNotes && assistant.customNotes.trim()) {
    prompt += `\n\n## İŞLETME BİLGİLERİ\n${assistant.customNotes}`;
  }

  return prompt;
}

/**
 * Outbound Sales (satış) için prompt oluşturur
 * @param {Object} assistant - Asistan objesi
 * @param {Object} business - Business objesi
 * @returns {String} Outbound sales prompt
 */
function buildOutboundSalesPrompt(assistant, business) {
  const businessName = business.name || 'İşletme';
  const assistantName = assistant.name || 'Asistan';

  let prompt = OUTBOUND_SALES_RULES;

  // Değişkenleri yerine koy
  prompt = prompt.replace(/{{business_name}}/g, businessName);
  prompt = prompt.replace(/{{assistant_name}}/g, assistantName);

  // Kullanıcının ek talimatlarını ekle (satış scripti, konuşma akışı)
  if (assistant.systemPrompt && assistant.systemPrompt.trim()) {
    prompt += `\n\n## SATIŞ SCRİPTİ / EK TALİMATLAR\n${assistant.systemPrompt}`;
  }

  // Kullanıcının özel notlarını ekle (ürün bilgileri, kampanya detayları)
  if (assistant.customNotes && assistant.customNotes.trim()) {
    prompt += `\n\n## ÜRÜN/HİZMET BİLGİLERİ\n${assistant.customNotes}`;
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
