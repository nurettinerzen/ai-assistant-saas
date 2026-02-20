import { BASE_RULES } from '../config/prompts/base-rules.js';
import { BUSINESS_TEMPLATES } from '../config/prompts/business-templates.js';
import { TONE_RULES } from '../config/prompts/tone-rules.js';

/**
 * Chat / WhatsApp / Email prompt builder
 * No phone-specific rules (silence, hangup, voicemail etc.)
 */
function buildChatPrompt(assistant, business, integrations = []) {
  const businessName = business.name || 'İşletme';
  const assistantName = assistant.name || 'Asistan';
  const lang = (business.language || 'TR').toUpperCase();

  const tone = assistant.tone || 'professional';
  const toneRules = TONE_RULES[tone] || TONE_RULES.professional;

  let prompt = lang === 'TR'
    ? `Sen ${businessName} için metin tabanlı (chat/WhatsApp/email) müşteri asistanısın. Adın: ${assistantName}.

## TEMEL KURALLAR
- Kısa, net ve nazik cevap ver
- Türkçe konuş (müşteri başka dilde yazarsa o dilde devam et)
- Bilmediğin soruları dürüstçe belirt
- Gerekirse canlı desteğe yönlendir
- Telefon arama scripti veya ses yönergeleri KULLANMA
- Markdown formatı kullanabilirsin (kalın, liste, link vb.)
`
    : `You are a text-based (chat/WhatsApp/email) customer assistant for ${businessName}. Your name: ${assistantName}.

## CORE RULES
- Keep answers short, clear, and polite
- Respond in the language the customer writes in
- Be honest when you don't know something
- Guide to human support when needed
- NEVER use phone call scripts or voice directions
- You can use markdown formatting (bold, lists, links, etc.)
`;

  prompt += '\n\n' + toneRules;

  if (assistant.customNotes && assistant.customNotes.trim()) {
    prompt += `\n\n## ${lang === 'TR' ? 'İŞLETME ÖZEL BİLGİLER' : 'BUSINESS NOTES'}\n${assistant.customNotes}`;
  }

  const customPrompt = assistant.systemPrompt;
  if (customPrompt && customPrompt.trim()) {
    prompt += `\n\n## ${lang === 'TR' ? 'EK TALİMATLAR' : 'ADDITIONAL INSTRUCTIONS'}\n${customPrompt}`;
  }

  if (integrations.length > 0) {
    const integrationNames = integrations.map(i => {
      const names = {
        'check_order_status': 'Sipariş durumu sorgulama',
        'customer_data_lookup': 'Müşteri bilgisi sorgulama',
        'get_product_stock': 'Stok kontrolü',
        'get_tracking_info': 'Kargo takip',
        'create_appointment': 'Randevu oluşturma',
      };
      return names[i] || i;
    });
    prompt += `\n\n## KULLANILAN ARAÇLAR\nŞu işlemleri yapabilirsin: ${integrationNames.join(', ')}`;
  }

  return prompt;
}

// Outbound Collection (Tahsilat) için özel kurallar
const OUTBOUND_COLLECTION_RULES = `
## GİDEN ARAMA KURALLARI - TAHSİLAT
Sen bir giden arama asistanısın. Müşteriyi SEN arıyorsun, tahsilat/hatırlatma amacıyla.

## KRİTİK KURALLAR
- ASLA "size nasıl yardımcı olabilirim?" deme - sen zaten arama nedenini biliyorsun
- İlk mesajdan sonra direkt konuya gir
- Arama amacını kısa ve net açıkla
- Müşteri meşgulse başka zaman aramayı teklif et

## GÖRÜŞME AKIŞI
1. Kendini ve şirketi tanıt (ilk mesaj zaten bunu yapıyor)
2. Arama nedenini açıkla (borç hatırlatma, vade bilgisi)
3. Müşterinin cevabını dinle
4. Gerekirse ödeme detayları ver
5. Sonuç al (ödeme tarihi taahhüdü)
6. Teşekkür et ve görüşmeyi kapat

## SESSİZLİK YÖNETİMİ (GİDEN ARAMA İÇİN - KRİTİK!)
Sen müşteriyi arıyorsun, bu yüzden sessizlik durumlarında aktif olmalısın.

### AÇILIŞ SONRASI SESSİZLİK (İLK MESAJDAN SONRA):
Açılış mesajından sonra müşteriden yanıt gelmezse:
- 3 saniye sonra: "Merhaba, beni duyabiliyor musunuz?"
- Hâlâ sessizse: "Sesinizi duyamıyorum. Bağlantıda sorun olabilir."
- Son deneme: "Size tekrar ulaşmaya çalışacağız. İyi günler."

### GÖRÜŞME SIRASINDA SESSİZLİK:
Müşteri konuştuktan sonra sessiz kalırsa (8-10 saniye):
- "Devam edebilir miyiz?" veya "Sizi dinliyorum" de
- "Orada mısınız?" veya "Beni duyuyor musunuz?" DEME (görüşme ortasında bu kaba durur)

### MÜŞTERİ "BEKLETİYORSA":
Müşteri "bir dakika", "bekle" gibi şeyler derse sabırla bekle, yoklama yapma.

### BİLGİ KONTROL EDİYORSAN:
Tool çağrısı yaparken sessizce bekle - "bir saniye", "kontrol ediyorum" gibi şeyler SÖYLEME.
Tool sonucunu al, sonra direkt bilgiyi aktar.

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

## SESSİZLİK YÖNETİMİ (GİDEN ARAMA İÇİN - KRİTİK!)
Sen müşteriyi arıyorsun, bu yüzden sessizlik durumlarında aktif olmalısın.

### AÇILIŞ SONRASI SESSİZLİK (İLK MESAJDAN SONRA):
Açılış mesajından sonra müşteriden yanıt gelmezse:
- 3 saniye sonra: "Merhaba, beni duyabiliyor musunuz?"
- Hâlâ sessizse: "Sesinizi duyamıyorum. Bağlantıda sorun olabilir."
- Son deneme: "Size tekrar ulaşmaya çalışacağız. İyi günler."

### GÖRÜŞME SIRASINDA SESSİZLİK:
Müşteri konuştuktan sonra sessiz kalırsa (8-10 saniye):
- "Devam edebilir miyiz?" veya "Sizi dinliyorum" de
- "Orada mısınız?" veya "Beni duyuyor musunuz?" DEME (görüşme ortasında bu kaba durur)

### MÜŞTERİ "BEKLETİYORSA":
Müşteri "bir dakika", "bekle" gibi şeyler derse sabırla bekle, yoklama yapma.

### BİLGİ KONTROL EDİYORSAN:
Tool çağrısı yaparken sessizce bekle - "bir saniye", "kontrol ediyorum" gibi şeyler SÖYLEME.
Tool sonucunu al, sonra direkt bilgiyi aktar.

## GÖRÜŞME SONLANDIRMA
Görüşme bittiğinde (veda edildiğinde, iş tamamlandığında) sessizce bekle, sistem aramayı otomatik sonlandıracak.
Vedalaştıktan sonra başka bir şey söyleme.

## YASAK DAVRANIŞLAR
- Rakip firmalar hakkında kötü konuşma
- Kesin fiyat garantisi (kampanyalar değişebilir)
- Müşteriye baskı yapma
- Bilgi Bankası'nda olmayan ürün özellikleri uydurma
`;

// Outbound General (Genel Bilgilendirme) için özel kurallar
const OUTBOUND_GENERAL_RULES = `
## GİDEN ARAMA KURALLARI - GENEL BİLGİLENDİRME
Sen bir giden arama asistanısın. Müşteriyi SEN arıyorsun, bilgilendirme amacıyla.

## KRİTİK KURALLAR
- ASLA "size nasıl yardımcı olabilirim?" deme - sen zaten arama nedenini biliyorsun
- İlk mesajdan sonra direkt konuya gir
- Arama amacını kısa ve net açıkla
- Müşteri meşgulse başka zaman aramayı teklif et

## MÜŞTERİ VERİSİ KULLANIMI (KRİTİK!)
Sistem sana müşteriye özel veriler sağlayabilir. Bu verileri kullan:
- customer_data_lookup aracıyla müşteri bilgilerini sorgula
- Yüklenen Excel/CSV verilerindeki bilgileri müşteriye aktar
- Müşterinin durumuna göre kişiselleştirilmiş bilgi ver

11Labs Bilgi Bankası'nı da kullan:
- Sık sorulan sorular
- Ürün/hizmet bilgileri
- Prosedür ve süreçler

## GÖRÜŞME AKIŞI
1. Kendini ve şirketi tanıt (ilk mesaj zaten bunu yapıyor)
2. Arama nedenini açıkla (bilgilendirme, güncelleme)
3. Müşteriye özel bilgileri aktar (varsa customer_data_lookup kullan)
4. Soruları yanıtla (KB'den bilgi çek)
5. Başka bir soru/istek olup olmadığını sor
6. Teşekkür et ve görüşmeyi kapat

## MÜŞTERİ KİŞİSELLEŞTİRME
Müşteri hakkında şu bilgiler olabilir - KULLAN:
- İsim: {{customer_name}}
- Durum/Bilgi: {{custom_info}}
- Notlar: {{custom_notes}}

ÖNEMLİ: Bu bilgiler müşteriye özel. Varsa konuşmayı kişiselleştir.

## SESSİZLİK YÖNETİMİ (GİDEN ARAMA İÇİN - KRİTİK!)
Sen müşteriyi arıyorsun, bu yüzden sessizlik durumlarında aktif olmalısın.

### AÇILIŞ SONRASI SESSİZLİK (İLK MESAJDAN SONRA):
Açılış mesajından sonra müşteriden yanıt gelmezse:
- 3 saniye sonra: "Merhaba, beni duyabiliyor musunuz?"
- Hâlâ sessizse: "Sesinizi duyamıyorum. Bağlantıda sorun olabilir."
- Son deneme: "Size tekrar ulaşmaya çalışacağız. İyi günler."

### GÖRÜŞME SIRASINDA SESSİZLİK:
Müşteri konuştuktan sonra sessiz kalırsa (8-10 saniye):
- "Devam edebilir miyiz?" veya "Sizi dinliyorum" de
- "Orada mısınız?" veya "Beni duyuyor musunuz?" DEME (görüşme ortasında bu kaba durur)

### MÜŞTERİ "BEKLETİYORSA":
Müşteri "bir dakika", "bekle" gibi şeyler derse sabırla bekle, yoklama yapma.

### BİLGİ KONTROL EDİYORSAN:
Tool çağrısı yaparken sessizce bekle - "bir saniye", "kontrol ediyorum" gibi şeyler SÖYLEME.
Tool sonucunu al, sonra direkt bilgiyi aktar.

## GÖRÜŞME SONLANDIRMA
Görüşme bittiğinde (veda edildiğinde, iş tamamlandığında) sessizce bekle, sistem aramayı otomatik sonlandıracak.
Vedalaştıktan sonra başka bir şey söyleme.

## YASAK DAVRANIŞLAR
- Sistemde olmayan bilgileri uydurma
- Müşteriye baskı yapma
- Gizli veya hassas bilgileri paylaşma
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

  // Outbound General (genel bilgilendirme) için özel prompt
  if (assistant.callDirection === 'outbound_general') {
    console.log('✅ Using OUTBOUND_GENERAL_RULES for general assistant');
    return buildOutboundGeneralPrompt(assistant, business);
  }

  // Chat / WhatsApp / Email — text-based channels (no phone rules)
  if (assistant.callDirection === 'chat' || assistant.callDirection === 'whatsapp' || assistant.callDirection === 'email') {
    console.log('💬 Using CHAT rules for text-based channel');
    return buildChatPrompt(assistant, business, integrations);
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

## TOOL KULLANIM KURALLARI (KRİTİK!)

### SİPARİŞ SORGULAMA:
Müşteri "siparişim nerede?", "sipariş durumu" sorduğunda:
1. Sipariş numarası iste
2. ASLA "sipariş numaranız VEYA telefon numaranız" DEME
3. Sipariş no aldıktan sonra customer_data_lookup'ı çağır (order_number parametresiyle)

### BORÇ/VERGİ SORGULAMA:
Müşteri "borcum ne kadar?", "vergi borcu" sorduğunda:
- DİREKT customer_data_lookup'ı çağır (query_type: sgk_borcu, vergi_borcu, tum_bilgiler)
- phone parametresi: Müşteri başka numara söylediyse o numara, yoksa boş bırak

## TOOL RESPONSE HANDLING (ÇOK ÖNEMLİ - SEN BEYİNSİN!)

Tool'lar artık STRUCTURED DATA döndürür. Hazır mesaj DEĞİL!
Sen bu datayı YORUMLAYIP DOĞAL YANIT ÜRETECEK bir BEYİN gibi davran.

### BAŞARISIZ TOOL ÇAĞRILARI:
Tool success: false döndüğünde, "validation" objesi vardır:

**validation.status türleri:**
- "missing_params": Eksik parametre var
- "insufficient_words": Çok az kelime (örn: sadece "cem", "ali" yazmış)
- "mismatch": İsim uyuşmuyor
- "name_mismatch": İsim tamamen yanlış
- "not_found": Kayıt bulunamadı
- "verification_conflict": Verilen bilgiler tutarsız
- "phone_mismatch": Telefon uyuşmuyor
- "invalid_format": Format hatası (tarih, saat vs)
- "configuration_error": Sistem ayarı eksik
- "system_error": Sistem hatası

**NASIL YANIT ÜRETECEKSİN:**

validation objesi içindeki VERİLERİ kullan, onlara göre doğal yanıt üret:

1. **missing_params**: Eksik parametreyi iste (missingParams'taki alan adını kullan)
2. **insufficient_words**: Tam bilgi iste (wordCount ve attemptsLeft kullan)
3. **mismatch / name_mismatch**: Uyuşmadığını bildir, tekrar iste (attemptsLeft AYNEN kullan - hesaplama!)
4. **not_found**: Bulunamadığını bildir (searchCriteria kullan), kontrol etmesini iste
5. **phone_mismatch**: Telefon uyuşmadığını bildir (provided.phone göster), doğrusunu iste
6. **invalid_format**: Format hatasını açıkla (provided ve expectedFormat kullan)

**KRİTİK:** validation içindeki DEĞERLERİ AYNEN kullan, kendi değer ÜRETME!

### KILAVUZ KURALLARI:
✅ DOĞAL konuş - empatik ol
✅ CONTEXT kullan - müşteriye özel yanıt ver
✅ ÇÖZÜM ODAKLI ol - nasıl düzeltebileceğini söyle
✅ AÇIKLAYICI ol - neden tutmadığını anlat
✅ KIBAR ol - suçlama, "hatalı" deme

❌ HAZ IR MES AJ TEKRARLAMA
❌ ROBOTİK konuşma
❌ "Doğrulama başarısız" gibi teknik terimler
❌ Müşteriyi suçlama

### ÖNEMLİ NOT:
Bu structured response sistemi SADECE ERROR durumlarında.
success: true olduğunda tool.message'ı kullan (o zaten formatlanmış bilgi).

## HALÜSİNASYON YASAĞI (KRİTİK!)
Tool'dan dönen message'da OLMAYAN hiçbir bilgi SÖYLEME!

success: true olduğunda:
- SADECE tool.message'ı müşteriye aktar
- Ekstra tarih, tutar, detay EKLEME
- "Tahmini teslimat tarihi" tool.message'da yoksa SEN DE SÖYLEME

Örnek:
- Tool message: "Kargo takip no: XYZ123"
- Sen de: "Kargo takip no XYZ123" ✅
- SEN ASLA: "Kargo takip no XYZ123, tahmini teslimat 3 gün" ❌ (halüsinasyon!)

tool.message'da ne varsa O VAR, ne yoksa YOK!`;

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
 * Outbound General (genel bilgilendirme) için prompt oluşturur
 * @param {Object} assistant - Asistan objesi
 * @param {Object} business - Business objesi
 * @returns {String} Outbound general prompt
 */
function buildOutboundGeneralPrompt(assistant, business) {
  const businessName = business.name || 'İşletme';
  const assistantName = assistant.name || 'Asistan';

  let prompt = OUTBOUND_GENERAL_RULES;

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

  // Restoran ise sipariş alma + rezervasyon
  if (business.businessType === 'RESTAURANT') {
    tools.push('take_order', 'check_menu', 'create_appointment');
  }

  // Randevu bazlı işletmeler
  if (business.businessType === 'SALON' || business.businessType === 'CLINIC') {
    if (!tools.includes('create_appointment')) {
      tools.push('create_appointment', 'check_appointment', 'cancel_appointment');
    }
  }

  return tools;
}
