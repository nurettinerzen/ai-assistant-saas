# PHONE Outbound V1 — Analiz Raporu
**Tarih**: 2026-02-16
**Durum**: V1 flow-runner AKTIF DEGIL — lifecycle webhook'lar backend'e ulasmiyor

---

## 1. Mevcut Durum Ozeti

### Calisan Kisimlar
- Batch call olusturma ve 11Labs'e gonderme CALISIYOR
- Arama tetikleniyor, musteri ile konusuluyor, arama tamamlaniyor
- DNC (Do Not Call) tablosu ve precheck HAZIR
- Feature flag'ler set edildi (PHONE_OUTBOUND_V1_ENABLED=true, CANARY_IDS=1)
- CallLog kayitlari olusturuluyor (sync ile)
- SSRF korumalari aktif ve calisiyor

### Calismayen Kisim
- **V1 flow-runner devreye GIRMIYOR**
- 11Labs lifecycle webhook'lari (conversation.started, conversation.ended) backend'e ulasmadi
- Loglarda `[MAIN_WEBHOOK_HIT]` veya `[LEGACY_WEBHOOK_HIT]` HICBIR ZAMAN gorulmedi
- Aramalar 11Labs'in kendi LLM'i (Gemini 2.5 Flash) + system prompt ile calisiyor

---

## 2. Yapilan Degisiklikler (Bu Oturum)

| Dosya | Degisiklik | Amac |
|-------|-----------|------|
| `feature-flags.js` | Startup flag logu eklendi | Deploy sonrasi flag degerlerini dogrulamak |
| `webhooks.js` | `[LEGACY_WEBHOOK_HIT]` logu eklendi (3 endpoint) | Legacy hatin kullanilip kullanilmadigini izlemek |
| `elevenlabs.js` | `[MAIN_WEBHOOK_HIT]` logu + signature uyarisi | Yeni hatin kullanilip kullanilmadigini izlemek |
| `elevenlabs.js` (service) | `platform_settings` URL'leri legacy'den yeniye guncellendi | `buildAgentConfig`'de webhook URL fix |
| `assistant.js` | Agent CREATE'e `platform_settings` eklendi | Yeni agent'lar dogru webhook URL'leriyle olusturulsun |
| `assistant.js` | Agent UPDATE'e `platform_settings` eklendi | Guncellenen agent'lar da dogru URL alsın |
| `assistant.js` | callType validation eklendi (her iki test-call endpoint) | Hangi flow calistigini garanti altina almak |
| `phoneNumber.js` | callType validation eklendi | Ayni amac |
| `schema.prisma` | DoNotCall modeli | DNC persistence |
| `add_do_not_call_table.sql` | Migration (Supabase'de uygulandi) | DoNotCall tablosu olusturma |
| `PHONE_OUTBOUND_V1_PROD_RUNBOOK.md` | Prod test kilavuzu | Test adimlari ve kontrol listesi |

Commit'ler:
1. `c9def74` — Ana V1 implementasyon + DNC + callType + runbook
2. `4661b56` — buildAgentConfig webhook URL fix (legacy -> main)
3. `b867e6f` — Agent UPDATE'e platform_settings eklendi
4. `f12d39a` — Agent CREATE'e platform_settings eklendi

---

## 3. Temel Sorun: Webhook Delivery

### Problem
11Labs, arama lifecycle event'lerini (conversation.started, conversation.ended) backend'e gondermesi gerekiyor. Bu event'ler geldiginde:
1. `conversation.started` → V1 flow-runner baslatilir, ilk script uretilir
2. Tool call → V1 flow-runner kullanici yanitini siniflandirir (YES/NO/LATER/DONT_CALL/ASK_AGENT)
3. `conversation.ended` → CallLog finalize edilir, slot release edilir

Ancak **hicbir lifecycle event backend'e ulasmadi** (3 arama testi yapildi, hicbirinde webhook logu gorulmedi).

### Olasi Sebepler

#### A. 11Labs platform_settings Formati Yanlis Olabilir
Agent create/update'de gonderilen `platform_settings` yapisi:
```json
{
  "platform_settings": {
    "post_call_webhook": {
      "url": "https://api.telyx.ai/api/elevenlabs/webhook"
    },
    "conversation_initiation_client_data_webhook": {
      "url": "https://api.telyx.ai/api/elevenlabs/webhook"
    }
  }
}
```
11Labs API dokumantasyonunda bu alanin tam formatini dogrulamak gerekiyor. Bazi olasiliklar:
- `platform_settings` yerine `server_events` veya `webhooks` anahtari gerekiyor olabilir
- URL formatinda ek parametreler (secret, headers) gerekiyor olabilir
- Webhook'lar phone number seviyesinde ayarlaniyor olabilir (agent seviyesinde degil)

#### B. 11Labs Webhook'lari Gonderiyor Ama Render Redirect/WAF Engelliyor
- Render'da ozel domain routing veya WAF kurallari webhook'u engelliyor olabilir
- 11Labs'in IP araligi Render tarafindan bloklanmis olabilir
- SSL/TLS handshake sorunu olabilir

#### C. 11Labs Batch Call API'si Lifecycle Webhook Gondermeyebilir
- Batch call'lar normal tek aramalardan farkli olabilir
- Batch call API'si `platform_settings` webhook'larini tetiklemiyor olabilir
- Sadece "realtime" (widget/phone direct) aramalar lifecycle event gonderiyor olabilir

#### D. 11Labs Agent Config'de Webhook Kabul Etmemis Olabilir
- `createAgent` response'unda `platform_settings` donus yapiyor mu kontrol edilmeli
- 11Labs sessizce ignoring yapiyor olabilir (hata vermeden)

### Dogrulama Adimlari (Yazilimci Icin)

1. **11Labs API ile dogrudan agent config kontrol et:**
```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/convai/agents/agent_2501khja4qffe88rrawnmgn6s9ew
```
Response'da `platform_settings` bolumune bak — webhook URL'leri dogru mu?

2. **11Labs dokumantasyonu kontrol et:**
   - https://elevenlabs.io/docs/api-reference/conversational-ai
   - `platform_settings` vs `server_events` vs `webhooks` — hangi alan gecerli?
   - Batch call'lar lifecycle webhook tetikliyor mu?

3. **Render log seviyesini artir:**
   - Network level loglar (incoming request'ler) — 11Labs'ten gelen istekler gorunuyor mu?
   - Render dashboard → Events → HTTP requests

4. **Alternatif test: Widget uzerinden arama yap:**
   - 11Labs dashboard'da agent'in Preview/Widget'ini kullan
   - Bu sekilde arama yapildiginda webhook tetikleniyor mu kontrol et
   - Eger widget ile calisiyor ama batch call ile calismiyorsa → batch call API webhook gondermiyordur

5. **11Labs webhook delivery logs:**
   - 11Labs dashboard'da agent → webhooks bolumunde delivery log var mi?
   - Failed delivery'ler gorunuyor mu?

---

## 4. Mimari Akis (V1 Flow Runner)

```
Batch Call Trigger
    |
    v
11Labs Batch API ──> 11Labs arama baslatir
    |
    v
11Labs conversation.started ──webhook──> /api/elevenlabs/webhook
    |                                         |
    |                                    handleConversationStarted()
    |                                         |
    |                                    isPhoneOutboundV1Enabled({ businessId })
    |                                         |
    |                                    [V1 Branch] runOutboundV1Turn()
    |                                         |
    |                                    flowRunner.runFlowStep() → opening script
    |                                         |
    |                                    Return: { prompt_override: script }
    v
Musteri konusur
    |
    v
11Labs tool_call ──webhook──> /api/elevenlabs/webhook?agentId=xxx
    |                              |
    |                         handleToolCall()
    |                              |
    |                         [V1 Branch] runOutboundV1Turn(userUtterance)
    |                              |
    |                         labelClassifier → YES/NO/LATER/DONT_CALL/ASK_AGENT/UNKNOWN
    |                              |
    |                         applyOutboundV1Actions() → DNC/callback/followup/log
    |                              |
    |                         Return: { message: nextScriptText }
    v
11Labs conversation.ended ──webhook──> /api/elevenlabs/webhook
    |                                       |
    |                                  handleConversationEnded()
    |                                       |
    |                                  CallLog finalize + slot release
    v
TAMAMLANDI
```

**Simdiki durum**: Ilk adim (conversation.started webhook) hic tetiklenmiyor, bu yuzden tum V1 akisi bypass ediliyor.

---

## 5. V1 Flow Runner Ozellikleri (Hazir, Webhook Sorunu Cozulunce Aktif Olacak)

### Label Siniflandirma (KEYWORD_ONLY modu)
| Label | Turkce Tetikleyiciler | Aksyon |
|-------|----------------------|--------|
| YES | evet, olur, tamam | log_call_outcome |
| NO | hayir, istemiyorum | log_call_outcome |
| LATER | daha sonra, simdi degil | schedule_followup |
| DONT_CALL | beni aramayin | set_do_not_call |
| ASK_AGENT | temsilci, yetkili | create_callback |
| UNKNOWN | (taninamadi) | retry (max 2) |

### DTMF Destegi
| Tus | Label |
|-----|-------|
| 1 | YES |
| 2 | NO |
| 3 | LATER |
| 4 | ASK_AGENT |
| 9 | DONT_CALL |

### Desteklenen Arama Tipleri
- BILLING_REMINDER (odeme hatirlatma)
- APPOINTMENT_REMINDER (randevu hatirlatma)
- SHIPPING_UPDATE (kargo bilgilendirme)

### Tool Allowlist (V1'de sadece bu 4 tool calisir)
- log_call_outcome
- create_callback
- set_do_not_call
- schedule_followup

### Guvenlik
- DNC fail-closed: Numara DNC listesinde → arama baslamaz
- Tool allowlist: V1'de izinsiz tool cagrilari reddedilir
- Off-topic detection: Siparis/kargo sorusu → temsilciye yonlendir
- Inbound kapalı: PHONE_INBOUND_ENABLED=false

---

## 6. Guvenlik Bulgulari (Bu Oturumdaki Loglardan)

### SSRF Saldiri Denemesi (BLOKLANDI)
- IP: `172.182.202.197`
- `http://127.0.0.1/admin` → BLOKLANDI
- `http://169.254.169.254/latest/meta-data` (AWS metadata) → BLOKLANDI
- Durum: SSRF korumalari dogru calisiyor

### Cross-Tenant Erisim Denemesi (BLOKLANDI)
- IP: `172.182.202.197`
- Business/28'e erisim denemesi → 403 BLOKLANDI
- Durum: Tenant izolasyonu dogru calisiyor

### Auth Failure Dizisi
- Ayni IP'den coklu auth_failure
- jwt malformed + invalid signature denemeleri
- Durum: Otomatik guvenlik taramasi/saldiri denemesi

**Oneri**: Bu IP'yi izle, tekrarlarsa rate limiting veya IP ban dusun.

---

## 7. Oncelikli Aksiyon Listesi

### P0 — Webhook Delivery Sorunu (V1'in Calismasi Icin ZORUNLU)
1. 11Labs API'den agent config cekerek `platform_settings`'in kabul edilip edilmedigini dogrula
2. 11Labs dokumantasyonunda batch call webhook delivery davranisini kontrol et
3. Widget uzerinden test arama yap — webhook gelip gelmedigini izle
4. 11Labs dashboard'da webhook delivery log/failure log kontrol et

### P1 — Gelisim Ogeleri
1. Webhook signature dogrulamasi: Prod'da `ELEVENLABS_WEBHOOK_SECRET` set edildiginden emin ol
2. Legacy webhook endpoint'leri izlemeye devam et — hic hit almiyorsa temizlenebilir
3. `customer_name` mapping sorunu: Batch call'da `customer_name: "15/01/2024"` donuyor — Excel kolon eslestirmesi kontrol edilmeli

### P2 — Iyilestirmeler
1. V1 flow-runner testlerini genislet (edge case'ler)
2. Batch call sonrasi otomatik arama kalitesi analizi
3. Classifier mode'a LLM_LABEL_ONLY icin fallback mekanizmasi

---

## 8. Test Sonuclari

| Test | Sonuc |
|------|-------|
| phone-outbound-v1-flow-runner.test.js | 2/2 PASS |
| phone-outbound-v1-label-classifier.test.js | 3/3 PASS |
| phone-outbound-v1-webhook.integration.test.js | 4/4 PASS |
| **Toplam** | **9/9 PASS** |

---

## 9. Dosya Listesi

### Yeni Dosyalar
- `backend/src/phone-outbound-v1/flowRunner.js` — State machine flow runner
- `backend/src/phone-outbound-v1/labelClassifier.js` — Keyword/LLM siniflandirici
- `backend/src/phone-outbound-v1/policy.js` — Tool allowlist, off-topic detection
- `backend/src/phone-outbound-v1/outcomeWriter.js` — DNC/callback/followup persistence
- `backend/src/phone-outbound-v1/flows.v1.json` — 3 arama tipi konfigurasyonu
- `backend/src/phone-outbound-v1/index.js` — Module export
- `backend/prisma/migrations/add_do_not_call_table.sql` — DoNotCall migration
- `backend/docs/PHONE_OUTBOUND_V1_PROD_RUNBOOK.md` — Prod test kilavuzu
- `backend/tests/unit/phone-outbound-v1-*.test.js` — 3 test dosyasi

### Degistirilen Dosyalar
- `backend/prisma/schema.prisma` — DoNotCall model eklendi
- `backend/src/config/feature-flags.js` — V1 flag'ler + startup log
- `backend/src/services/safeCallInitiator.js` — DNC precheck
- `backend/src/routes/batchCalls.js` — DNC filtering
- `backend/src/routes/elevenlabs.js` — Webhook hit log + signature uyarisi
- `backend/src/routes/webhooks.js` — Legacy hit loglari
- `backend/src/routes/assistant.js` — platform_settings (create+update) + callType validation
- `backend/src/routes/phoneNumber.js` — callType validation
- `backend/src/services/elevenlabs.js` — buildAgentConfig webhook URL fix
