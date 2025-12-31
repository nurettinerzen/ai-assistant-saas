# Knowledge Base Senkronizasyon Mimarisi

Bu doküman, Knowledge Base (KB) verilerinin tüm kanallara (Telefon, Chat, WhatsApp, Email) nasıl dinamik olarak senkronize edildiğini açıklar.

---

## Genel Bakış

Sistem, **business-based isolation** prensibiyle çalışır. Her business'ın:
- Kendi Knowledge Base'i vardır
- Birden fazla asistanı olabilir
- Tüm asistanlar aynı KB'yi paylaşır

```
Business A
├── Knowledge Base (FAQ, URL, Document)
├── Assistant 1 (Telefon) ──► 11Labs Agent 1
├── Assistant 2 (Telefon) ──► 11Labs Agent 2
└── Chat/WhatsApp/Email ──► OpenAI (dinamik KB sorgusu)

Business B
├── Knowledge Base (ayrı)
└── Assistant 1 ──► 11Labs Agent (ayrı)
```

---

## Kanal Bazlı KB Entegrasyonu

### 1. Telefon Kanalı (11Labs)

**Provider:** ElevenLabs Conversational AI

**KB Saklama Yöntemi:** 11Labs'ın kendi Knowledge Base sistemi (RAG)

**Nasıl Çalışır:**
1. KB eklendiğinde → 11Labs API'sine doküman olarak upload edilir
2. Her asistanın kendi 11Labs agent'ı var
3. 11Labs, her çağrıda kendi RAG sistemiyle KB'yi sorgular

**Dosya:** `backend/src/routes/knowledge.js`

```javascript
// KB eklendiğinde TÜM aktif asistanlara sync
const assistants = await prisma.assistant.findMany({
  where: { businessId, isActive: true },
  select: { id: true, elevenLabsAgentId: true, name: true }
});

for (const assistant of assistants) {
  if (assistant.elevenLabsAgentId) {
    await elevenLabsService.addKnowledgeDocument(assistant.elevenLabsAgentId, {
      name: docName,
      content: content
    });
  }
}
```

**11Labs API Endpoints:**
- `POST /convai/knowledge-base` - Text/content upload
- `POST /convai/knowledge-base/url` - URL scraping
- `PATCH /convai/agents/{agent_id}` - KB'yi agent'a bağlama
- `DELETE /convai/knowledge-base/{doc_id}` - KB silme

---

### 2. Chat Widget Kanalı

**Provider:** OpenAI (gpt-4o-mini)

**KB Saklama Yöntemi:** Veritabanı (Prisma/PostgreSQL)

**Nasıl Çalışır:**
1. Her mesajda veritabanından KB sorgulanır
2. System prompt'a context olarak eklenir
3. Tamamen dinamik - anında güncellenir

**Dosya:** `backend/src/routes/chat.js`

```javascript
// Her mesajda dinamik KB sorgusu
const knowledgeItems = await prisma.knowledgeBase.findMany({
  where: { businessId: business.id, status: 'ACTIVE' }
});

// System prompt'a ekleme
const messages = [
  {
    role: 'system',
    content: `${systemPromptBase}
${knowledgeContext}  // ◄── KB içeriği buraya eklenir
${toolInstructions}`
  },
  ...
];
```

---

### 3. WhatsApp Kanalı

**Provider:** OpenAI + Meta WhatsApp Business API

**KB Saklama Yöntemi:** Veritabanı (Prisma/PostgreSQL)

**Nasıl Çalışır:** Chat Widget ile aynı mantık

**Dosya:** `backend/src/routes/whatsapp.js`

```javascript
async function buildSystemPrompt(business, assistant) {
  // Dinamik KB sorgusu
  const knowledgeItems = await prisma.knowledgeBase.findMany({
    where: { businessId: business.id, status: 'ACTIVE' }
  });

  return `${basePrompt}
${knowledgeContext}
${toolInstructions}`;
}
```

---

### 4. Email Kanalı

**Provider:** OpenAI + SMTP

**KB Saklama Yöntemi:** Veritabanı (Prisma/PostgreSQL)

**Nasıl Çalışır:** Chat Widget ile aynı mantık

**Dosya:** `backend/src/services/email-ai.js`

---

## Senkronizasyon Senaryoları

### Senaryo 1: Yeni KB Eklendi

```
Kullanıcı KB ekliyor (FAQ/URL/Document)
         │
         ▼
┌─────────────────────────────────────┐
│  knowledge.js - POST /faqs          │
│  veya POST /urls veya POST /documents│
└─────────────────────────────────────┘
         │
         ├──► Veritabanına kaydet (tüm kanallar için)
         │
         └──► 11Labs'a upload (telefon için)
              │
              ▼
         ┌─────────────────────────────┐
         │ TÜM aktif asistanları bul   │
         │ (aynı business'a ait)       │
         └─────────────────────────────┘
              │
              ▼
         Her asistanın 11Labs agent'ına
         KB dokümanı olarak ekle
```

### Senaryo 2: Yeni Asistan Oluşturuldu

```
Kullanıcı yeni asistan oluşturuyor
         │
         ▼
┌─────────────────────────────────────┐
│  assistant.js - POST /assistants    │
└─────────────────────────────────────┘
         │
         ├──► 11Labs'da yeni agent oluştur
         │
         ├──► Telefon numarası varsa otomatik ata
         │
         └──► Mevcut TÜM KB'leri yeni asistana sync et
              │
              ▼
         ┌─────────────────────────────┐
         │ Business'ın tüm KB'lerini   │
         │ 11Labs'a upload et          │
         └─────────────────────────────┘
```

### Senaryo 3: KB Silindi

```
Kullanıcı KB siliyor
         │
         ▼
┌─────────────────────────────────────┐
│  knowledge.js - DELETE /faqs/:id    │
└─────────────────────────────────────┘
         │
         ├──► Veritabanından sil
         │
         └──► 11Labs'dan sil
              │
              ▼
         ┌─────────────────────────────┐
         │ TÜM asistanların agent'ından│
         │ KB dokümanını kaldır        │
         └─────────────────────────────┘
```

---

## Veritabanı Şeması

```prisma
model KnowledgeBase {
  id              String   @id @default(cuid())
  businessId      Int
  type            KBType   // FAQ, URL, DOCUMENT
  title           String?
  content         String?  @db.Text
  question        String?  // FAQ için
  answer          String?  // FAQ için
  url             String?  // URL için
  fileName        String?  // Document için
  filePath        String?
  fileSize        Int?
  mimeType        String?
  status          KBStatus // PROCESSING, ACTIVE, FAILED
  elevenLabsDocId String?  // 11Labs'daki doküman ID'si
  crawlDepth      Int?     @default(1)
  pageCount       Int?     @default(0)
  lastCrawled     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  business        Business @relation(fields: [businessId], references: [id])
}

enum KBType {
  FAQ
  URL
  DOCUMENT
}

enum KBStatus {
  PROCESSING
  ACTIVE
  FAILED
}
```

---

## 11Labs Entegrasyonu Detayları

### Servis Dosyası
`backend/src/services/elevenlabs.js`

### Ana Fonksiyonlar

```javascript
// KB dokümanı ekleme (text veya URL)
elevenLabsService.addKnowledgeDocument(agentId, {
  name: string,
  content?: string,  // Text içerik için
  url?: string       // URL için (11Labs scrape eder)
})

// KB'yi agent'a bağlama
elevenLabsService.addKnowledgeToAgent(agentId, documentId, name)

// KB'yi agent'tan kaldırma
elevenLabsService.removeKnowledgeFromAgent(agentId, documentId)

// KB dokümanını silme
elevenLabsService.deleteKnowledgeDocument(documentId)
```

### 11Labs Agent Config Yapısı

```javascript
{
  name: "Assistant Name",
  conversation_config: {
    agent: {
      prompt: {
        prompt: systemPrompt,
        llm: "gemini-2.5-flash-lite",
        tools: [...]
      },
      first_message: "Merhaba...",
      language: "tr"
    },
    tts: {
      voice_id: "...",
      model_id: "eleven_turbo_v2_5"
    },
    stt: {
      provider: "elevenlabs",
      model: "scribe_v1"
    }
  }
}
```

---

## Provider Değişikliği İçin Notlar

### 11Labs'tan Başka Bir Provider'a Geçiş

Eğer telefon provider'ı değiştirilirse (örn: Vapi, Bland.ai, Retell):

1. **KB Upload Mekanizması:**
   - `knowledge.js`'deki 11Labs çağrılarını yeni provider'a adapte et
   - `elevenLabsService.addKnowledgeDocument` → Yeni servis

2. **Agent Oluşturma:**
   - `assistant.js`'deki 11Labs agent oluşturma kodunu değiştir
   - `elevenLabsService.createAgent` → Yeni provider

3. **Yeni Provider KB Desteklemiyorsa:**
   - System prompt'a KB'yi inline olarak ekle (Chat/WhatsApp gibi)
   - `buildAssistantPrompt` fonksiyonuna KB context ekle

4. **Gerekli Değişiklik Dosyaları:**
   ```
   backend/src/services/elevenlabs.js     → Yeni provider servisi
   backend/src/routes/assistant.js        → Agent CRUD
   backend/src/routes/knowledge.js        → KB sync
   backend/src/routes/elevenlabs.js       → Webhook handler
   ```

### Chat/WhatsApp/Email Provider Değişikliği

OpenAI'dan başka bir LLM'e geçiş (örn: Anthropic, Gemini):

1. **API Client Değişikliği:**
   - `chat.js` ve `whatsapp.js`'deki OpenAI client'ı değiştir
   - Tool/function calling formatını adapte et

2. **KB Entegrasyonu Değişmez:**
   - Veritabanı sorgusu aynı kalır
   - Sadece system prompt formatı değişebilir

---

## Özet Tablo

| Kanal | Provider | KB Saklama | KB Sorgu Zamanı | Dosya |
|-------|----------|------------|-----------------|-------|
| Telefon | 11Labs | 11Labs KB (RAG) | Her çağrıda (11Labs yapar) | elevenlabs.js |
| Chat | OpenAI | PostgreSQL | Her mesajda | chat.js |
| WhatsApp | OpenAI | PostgreSQL | Her mesajda | whatsapp.js |
| Email | OpenAI | PostgreSQL | Her email'de | email-ai.js |

---

## Versiyon

- **Son Güncelleme:** 31 Aralık 2024
- **Versiyon:** 2.0
- **Değişiklik:** Tüm asistanlara KB sync mekanizması eklendi
