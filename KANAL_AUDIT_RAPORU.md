# Telyx.AI Kanal Tutarlılık Audit Raporu

**Tarih:** 30 Aralık 2025
**Hazırlayan:** Claude Code Audit
**Versiyon:** 1.0

---

## Özet

Bu rapor, Telyx.AI platformundaki tüm iletişim kanallarının (Telefon, WhatsApp, Chat Widget, Email) mimari tutarlılığını analiz etmektedir. Sonuç olarak:

✅ **Unified Tool System** başarıyla implemente edilmiş
✅ Tüm kanallar merkezi tool sistemini kullanıyor
⚠️ Bazı minor tutarsızlıklar tespit edildi
⚠️ Knowledge Base tool olarak entegre değil (sadece prompt context)

---

## Bölüm 1: Kanal Mimarisi Karşılaştırması

### 1A: Kanal Özellik Tablosu

```
┌─────────────────┬───────────────┬───────────────┬───────────────┬───────────────┐
│ Özellik         │ Chat Widget   │ WhatsApp      │ Email         │ Telefon       │
├─────────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ LLM Provider    │ OpenAI        │ OpenAI        │ OpenAI        │ 11Labs+Gemini │
│ LLM Model       │ gpt-4o-mini   │ gpt-4o-mini   │ gpt-4o-mini   │ gemini-2.5-   │
│                 │               │               │               │ flash-lite    │
│ Tool System     │ OpenAI Fn     │ OpenAI Fn     │ OpenAI Fn     │ 11Labs        │
│                 │ Calling       │ Calling       │ Calling       │ Webhook       │
│ Tool Handler    │ Central       │ Central       │ Central       │ Central       │
│                 │ executeTool() │ executeTool() │ executeTool() │ executeTool() │
│ STT             │ N/A           │ N/A           │ N/A           │ 11Labs        │
│                 │               │               │               │ (scribe_v1)   │
│ TTS             │ N/A           │ N/A           │ N/A           │ 11Labs        │
│                 │               │               │               │ (turbo_v2_5)  │
│ Entry Point     │ /api/chat/    │ /api/whatsapp/│ /api/email/*  │ /api/         │
│                 │ widget        │ webhook       │               │ elevenlabs/*  │
│ Tool Loop       │ Single Pass   │ Recursive     │ Recursive     │ N/A           │
│                 │               │ (max 5)       │               │ (11Labs)      │
│ Max Iterations  │ 1             │ 5             │ 1             │ 5 (11Labs)    │
│ History Storage │ Stateless     │ In-memory     │ Database      │ 11Labs +      │
│                 │               │ (40 msg)      │               │ Database      │
└─────────────────┴───────────────┴───────────────┴───────────────┴───────────────┘
```

### 1B: Dosya Konumları

| Kanal | Ana Route Dosyası | Tool Integration |
|-------|------------------|------------------|
| Chat Widget | `backend/src/routes/chat.js` | ✅ Merkezi |
| WhatsApp | `backend/src/routes/whatsapp.js` | ✅ Merkezi |
| Email | `backend/src/services/email-ai.js` | ✅ Merkezi |
| Telefon | `backend/src/routes/elevenlabs.js` | ✅ Merkezi |

---

## Bölüm 2: Tool Listesi Karşılaştırması

### 2A: Kayıtlı Tool'lar

```
┌─────────────────────────┬───────────────┬───────────────┬───────────────┬───────────────┐
│ Tool                    │ Chat Widget   │ WhatsApp      │ Email         │ Telefon       │
├─────────────────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ create_appointment      │ ✅            │ ✅            │ ✅            │ ✅            │
│ send_order_notification │ ✅            │ ✅            │ ✅            │ ✅            │
│ check_order_status      │ ✅            │ ✅            │ ✅            │ ✅            │
│ get_product_stock       │ ✅            │ ✅            │ ✅            │ ✅            │
│ get_tracking_info       │ ✅            │ ✅            │ ✅            │ ✅            │
│ check_order_status_crm  │ ✅            │ ✅            │ ✅            │ ✅            │
│ check_stock_crm         │ ✅            │ ✅            │ ✅            │ ✅            │
│ check_ticket_status_crm │ ✅            │ ✅            │ ✅            │ ✅            │
│ customer_data_lookup    │ ✅            │ ✅            │ ✅            │ ✅            │
├─────────────────────────┼───────────────┼───────────────┼───────────────┼───────────────┤
│ end_call (system)       │ ❌            │ ❌            │ ❌            │ ✅            │
│ knowledge_base_search   │ ❌            │ ❌            │ ❌            │ ❌            │
│ transfer_to_human       │ ❌            │ ❌            │ ❌            │ ❌            │
└─────────────────────────┴───────────────┴───────────────┴───────────────┴───────────────┘
```

**Notlar:**
- `end_call` sadece telefon kanalında 11Labs system tool olarak ekleniyor
- `knowledge_base_search` hiçbir kanalda tool olarak mevcut değil (prompt context olarak kullanılıyor)
- `transfer_to_human` implemente edilmemiş

### 2B: Business Type - Tool Erişim Matrisi

```
┌─────────────────────────┬────────────┬────────┬────────┬─────────┬───────────┬───────┐
│ Tool                    │ RESTAURANT │ SALON  │ CLINIC │ SERVICE │ ECOMMERCE │ OTHER │
├─────────────────────────┼────────────┼────────┼────────┼─────────┼───────────┼───────┤
│ create_appointment      │ ✅         │ ✅     │ ✅     │ ✅      │ ❌        │ ✅    │
│ send_order_notification │ ✅         │ ❌     │ ❌     │ ❌      │ ❌        │ ❌    │
│ check_order_status      │ ❌         │ ❌     │ ❌     │ ❌      │ ✅        │ ❌    │
│ get_product_stock       │ ❌         │ ❌     │ ❌     │ ❌      │ ✅        │ ❌    │
│ get_tracking_info       │ ❌         │ ❌     │ ❌     │ ❌      │ ✅        │ ❌    │
│ check_order_status_crm  │ ❌         │ ❌     │ ❌     │ ✅      │ ✅        │ ✅    │
│ check_stock_crm         │ ❌         │ ❌     │ ❌     │ ✅      │ ✅        │ ✅    │
│ check_ticket_status_crm │ ❌         │ ❌     │ ❌     │ ✅      │ ✅        │ ✅    │
│ customer_data_lookup    │ ✅         │ ✅     │ ✅     │ ✅      │ ✅        │ ✅    │
└─────────────────────────┴────────────┴────────┴────────┴─────────┴───────────┴───────┘
```

---

## Bölüm 3: Unified Tool System Durumu

### 3A: Mimari Yapı ✅

Unified Tool System başarıyla implemente edilmiş:

```
backend/src/tools/
├── index.js                    # Ana giriş noktası
├── registry.js                 # Tool registry (definition + handler eşleştirme)
├── definitions/                # Tool tanımları (OpenAI format)
│   ├── index.js
│   ├── appointment.js
│   ├── customer-data-lookup.js
│   ├── order-notification.js
│   ├── order-status.js
│   ├── product-stock.js
│   ├── tracking-info.js
│   ├── crm-order-status.js
│   ├── crm-stock.js
│   └── crm-ticket-status.js
├── handlers/                   # Tool execution logic
│   └── *.js (her tool için)
└── utils/
    └── business-rules.js       # Business type erişim kuralları
```

### 3B: API Fonksiyonları ✅

```javascript
// Tüm kanallar tarafından kullanılan merkezi fonksiyonlar:
import { getActiveTools, executeTool, getActiveToolsForElevenLabs } from '../tools/index.js';

// OpenAI format (Chat, WhatsApp, Email)
const tools = getActiveTools(business);

// 11Labs format (Telefon)
const tools = getActiveToolsForElevenLabs(business);

// Tool execution (tüm kanallar)
const result = await executeTool(toolName, args, business, { channel: 'PHONE' });
```

### 3C: Kanal Entegrasyonu

| Kanal | Import | Kullanım | Durum |
|-------|--------|----------|-------|
| Chat | `getActiveTools`, `executeTool` | ✅ Doğru | ✅ |
| WhatsApp | `getActiveTools`, `executeTool` | ✅ Doğru | ✅ |
| Email | `getActiveTools`, `executeTool` | ✅ Doğru | ✅ |
| Telefon | `getActiveToolsForElevenLabs`, `executeTool` | ✅ Doğru | ✅ |

---

## Bölüm 4: 11Labs Telefon Entegrasyonu

### 4A: Mimari

```
Gelen Çağrı
    │
    ▼
11Labs Conversational AI
    │
    ├── STT (scribe_v1) ──▶ Ses → Metin
    │
    ├── LLM (gemini-2.5-flash-lite) ──▶ AI İşleme
    │
    ├── Tool Call (webhook) ──▶ POST /api/elevenlabs/webhook
    │       │
    │       ▼
    │   executeTool() ──▶ Merkezi Tool Sistemi
    │       │
    │       ▼
    │   Tool Handler (appointment, order, etc.)
    │       │
    │       ▼
    │   Response ──▶ 11Labs'a geri dön
    │
    └── TTS (eleven_turbo_v2_5) ──▶ Metin → Ses
```

### 4B: Tool Format Dönüşümü

**OpenAI Format (Kaynak):**
```json
{
  "type": "function",
  "function": {
    "name": "create_appointment",
    "description": "...",
    "parameters": { "type": "object", "properties": {...} }
  }
}
```

**11Labs Format (Dönüştürülmüş):**
```json
{
  "type": "webhook",
  "name": "create_appointment",
  "description": "...",
  "api_schema": {
    "url": "https://api.aicallcenter.app/api/elevenlabs/webhook",
    "method": "POST",
    "request_body_schema": {
      "type": "object",
      "properties": {
        "tool_name": { "type": "string" },
        ...original_properties
      }
    }
  }
}
```

Bu dönüşüm `getActiveToolsForElevenLabs()` fonksiyonu tarafından otomatik yapılıyor.

### 4C: Webhook Handler

**Dosya:** `backend/src/routes/elevenlabs.js` (satır 110-182)

```javascript
router.post('/webhook', async (req, res) => {
  // Event type: tool_call veya client_tool_call
  switch (eventType) {
    case 'tool_call':
    case 'client_tool_call':
      const result = await handleToolCall(event);
      return res.json(result);
    // ... diğer event'ler
  }
});

async function handleToolCall(event) {
  const { tool_name, parameters, conversation_id, agent_id } = event;

  // Business'ı bul
  const assistant = await prisma.assistant.findFirst({
    where: { elevenLabsAgentId: agent_id },
    include: { business: { include: { integrations: true } } }
  });

  // Merkezi tool sistemini kullan
  const result = await executeTool(tool_name, parameters, business, {
    channel: 'PHONE',
    conversationId: conversation_id,
    callerPhone: resolvedCallerPhone
  });

  return { success: result.success, result: result.data };
}
```

---

## Bölüm 5: Tespit Edilen Tutarsızlıklar

### 5A: Kritik Tutarsızlıklar ⚠️

#### 1. Chat Widget Tool Loop Eksikliği

**Sorun:** Chat widget sadece tek bir tool çağrısı yapabiliyor, recursive tool loop yok.

**Dosya:** `backend/src/routes/chat.js` (satır 132-186)

**Etkilenen Kanallar:** Chat Widget

**Mevcut Davranış:**
- AI bir tool çağırır
- Tool sonucu alınır
- Tek bir follow-up response oluşturulur
- Eğer AI başka bir tool çağırmak isterse, yapamaz

**Beklenen Davranış:**
- WhatsApp gibi recursive loop (max 5 iteration)

**Risk:** Orta

**Önerilen Düzeltme:**
```javascript
// chat.js'e processWithToolLoop ekle (whatsapp.js'den)
const MAX_TOOL_ITERATIONS = 5;

async function processWithToolLoop(client, messages, tools, business, context, model) {
  let iteration = 0;
  while (iteration < MAX_TOOL_ITERATIONS) {
    // ... WhatsApp'taki implementasyon
  }
}
```

#### 2. Email'de Tool Loop Yok

**Sorun:** Email channel tek pass tool execution yapıyor.

**Dosya:** `backend/src/services/email-ai.js` (satır 125-164)

**Risk:** Düşük (email genelde tek tool yeterli)

---

### 5B: Orta Öncelikli Tutarsızlıklar

#### 1. Knowledge Base Tool Olarak Yok

**Sorun:** Knowledge base içeriği sadece prompt context olarak ekleniyor, AI'ın dinamik olarak arama yapması için bir tool yok.

**Etkilenen:** Tüm kanallar

**Mevcut:** Knowledge base içeriği `buildAssistantPrompt()` ile system prompt'a ekleniyor.

**Öneri:** `search_knowledge_base` tool'u eklenebilir (opsiyonel)

#### 2. Conversation History Tutarsızlığı

| Kanal | Storage | Persistence |
|-------|---------|-------------|
| Chat | Yok (client gönderir) | Stateless |
| WhatsApp | In-memory Map | Session (max 40 msg) |
| Email | Database | Permanent |
| Telefon | 11Labs + Database | Permanent |

**Öneri:** WhatsApp için Redis/Database storage düşünülebilir (opsiyonel)

---

### 5C: Düşük Öncelikli (Nice to Have)

#### 1. LLM Model Tutarsızlığı

- Chat/WhatsApp/Email: `gpt-4o-mini`
- Telefon: `gemini-2.5-flash-lite` (11Labs üzerinden)

**Not:** Bu kasıtlı olabilir (ses için optimize). Değişiklik önerilmiyor.

#### 2. Typo: `hasTooll` fonksiyonu

**Dosya:** `backend/src/tools/index.js` (satır 135)

```javascript
export function hasTooll(toolName) {  // "hasTooll" değil "hasTool" olmalı
  return registry.has(toolName);
}
```

---

## Bölüm 6: Düzeltme Planı

### Kritik Düzeltme 1: Chat Widget Tool Loop

**Dosya:** `backend/src/routes/chat.js`

**Yapılacak:**
1. `MAX_TOOL_ITERATIONS` sabiti ekle
2. `processWithToolLoop` fonksiyonunu WhatsApp'tan adapte et
3. Widget handler'ı güncelle

**Kod Değişikliği:** ~50 satır
**Risk:** Düşük
**Test:** Chat widget'ta çoklu tool gerektiren senaryo test et

### Kritik Düzeltme 2: Typo Düzeltme

**Dosya:** `backend/src/tools/index.js`

**Yapılacak:**
1. `hasTooll` → `hasTool` olarak yeniden adlandır

**Kod Değişikliği:** 2 satır
**Risk:** Çok düşük (fonksiyon kullanılmıyor gibi görünüyor)

---

## Bölüm 7: Unified Tool System Şeması

```
                        ┌────────────────────────────────────────┐
                        │         TOOL REGISTRY                  │
                        │     (backend/src/tools/registry.js)    │
                        │                                        │
                        │  ┌──────────────┬──────────────────┐   │
                        │  │ Definitions  │    Handlers      │   │
                        │  ├──────────────┼──────────────────┤   │
                        │  │ appointment  │ appointment.js   │   │
                        │  │ order-status │ order-status.js  │   │
                        │  │ product-stock│ product-stock.js │   │
                        │  │ ...          │ ...              │   │
                        │  └──────────────┴──────────────────┘   │
                        └───────────────┬────────────────────────┘
                                        │
                        ┌───────────────┴────────────────────┐
                        │         TOOL INDEX                 │
                        │    (backend/src/tools/index.js)    │
                        │                                    │
                        │  getActiveTools(business)          │
                        │  getActiveToolsForElevenLabs()     │
                        │  executeTool(name, args, business) │
                        └───────────────┬────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
    ┌─────────▼─────────┐     ┌─────────▼─────────┐     ┌─────────▼─────────┐
    │  OpenAI Format    │     │  11Labs Format    │     │  Business Rules   │
    │                   │     │  (Webhook)        │     │                   │
    │  Chat Widget      │     │                   │     │  RESTAURANT: [..] │
    │  WhatsApp         │     │  Telefon          │     │  SALON: [...]     │
    │  Email            │     │                   │     │  ECOMMERCE: [..] │
    └───────────────────┘     └───────────────────┘     └───────────────────┘
              │                         │
              ▼                         ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                       MERKEZI TOOL EXECUTION                          │
    │                                                                       │
    │   executeTool(toolName, args, business, context)                      │
    │     → Validate business has access (business-rules.js)                │
    │     → Get handler from registry                                       │
    │     → Execute handler with context (channel, phone, etc.)             │
    │     → Return standardized result { success, data/error, message }     │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
```

---

## Bölüm 8: Sonuç ve Öneriler

### Genel Değerlendirme: ✅ İYİ

Unified Tool System başarıyla implemente edilmiş ve tüm kanallar tarafından kullanılıyor. Ana tutarlılık hedefi sağlanmış.

### Öncelikli Aksiyonlar

| # | Aksiyon | Öncelik | Efor | Risk |
|---|---------|---------|------|------|
| 1 | Chat widget tool loop ekle | Yüksek | Orta | Düşük |
| 2 | Typo düzelt (hasTooll) | Düşük | Düşük | Çok Düşük |
| 3 | Knowledge base tool (opsiyonel) | Düşük | Yüksek | Orta |

### İzlenmesi Gereken Konular

1. **WhatsApp conversation history:** Production'da memory leak riski var mı?
2. **11Labs LLM model:** Gemini vs GPT performans karşılaştırması
3. **Tool timeout:** Uzun süren tool'lar için timeout handling

---

## Ek: Hızlı Referans

### Tool Kullanım Örneği (Tüm Kanallar)

```javascript
import { getActiveTools, executeTool } from '../tools/index.js';

// 1. Business'a göre aktif tool'ları al
const tools = getActiveTools(business);

// 2. OpenAI'a tools parametresi olarak geç
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,
  tools: tools,
  tool_choice: 'auto'
});

// 3. Tool çağrısı varsa execute et
if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    const result = await executeTool(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments),
      business,
      { channel: 'CHAT', customerPhone: phone }
    );
  }
}
```

---

## Bölüm 9: Uygulanan Düzeltmeler

Bu audit sırasında aşağıdaki düzeltmeler uygulandı:

### Düzeltme 1: Typo Düzeltme ✅

**Dosya:** `backend/src/tools/index.js`

**Değişiklik:**
- `hasTooll` → `hasTool` olarak yeniden adlandırıldı
- Default export güncellendi

**Risk:** Çok düşük (fonksiyon aktif olarak kullanılmıyordu)

### Düzeltme 2: Chat Widget Recursive Tool Loop ✅

**Dosya:** `backend/src/routes/chat.js`

**Değişiklikler:**
1. `MAX_TOOL_ITERATIONS = 5` sabiti eklendi
2. `processWithToolLoop()` fonksiyonu eklendi (WhatsApp'tan adapte edildi)
3. Widget handler güncellendi - artık recursive tool loop kullanıyor

**Önceki Davranış:**
- Tek tool çağrısı yapılabiliyordu
- İkinci bir tool çağrısı gerekirse yapılamıyordu

**Yeni Davranış:**
- WhatsApp ile aynı: max 5 iterasyon
- AI birden fazla tool çağırabilir
- Her iterasyonda tool sonuçları AI'a geri gönderiliyor

**Test:**
```bash
# Chat widget'ta test senaryosu:
# 1. "Siparişimin durumunu ve kargo takibini öğrenmek istiyorum"
# 2. AI ilk check_order_status, sonra get_tracking_info çağırmalı
```

---

## Değişiklik Özeti

| Dosya | Değişiklik | Satır |
|-------|-----------|-------|
| `backend/src/tools/index.js` | `hasTooll` → `hasTool` | 135, 160 |
| `backend/src/routes/chat.js` | Recursive tool loop eklendi | +90 satır |

---

*Rapor Sonu*
