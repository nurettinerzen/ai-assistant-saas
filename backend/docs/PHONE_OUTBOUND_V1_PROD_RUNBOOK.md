# PHONE Outbound V1 - Prod Test Runbook

## 1. Ortam Degiskenleri (Env Vars)

```env
PHONE_OUTBOUND_V1_ENABLED=true
PHONE_INBOUND_ENABLED=false
PHONE_OUTBOUND_V1_CLASSIFIER_MODE=KEYWORD_ONLY
PHONE_OUTBOUND_V1_CANARY_BUSINESS_IDS=<TEST_BUSINESS_ID>
ELEVENLABS_WEBHOOK_SECRET=<secret>
```

> **KRITIK**: `PHONE_OUTBOUND_V1_CANARY_BUSINESS_IDS` bos birakilirsa V1 hicbir business icin calisMAZ (fail-closed). En az 1 business ID girilmeli.

Startup loglarinda dogrulama:
```
grep "PHONE V1 startup config" <log>
```

Beklenen cikti:
```
[feature-flags] PHONE V1 startup config:
  PHONE_OUTBOUND_V1_ENABLED     = true
  PHONE_INBOUND_ENABLED          = false
  PHONE_OUTBOUND_V1_CLASSIFIER   = KEYWORD_ONLY
  PHONE_OUTBOUND_V1_CANARY_IDS   = [<id>] (1 entries)
```

---

## 2. DoNotCall Tablo Dogrulamasi

### Migration uygula (henuz uygulanmadiysa):
```sql
-- Dosya: backend/prisma/migrations/add_do_not_call_table.sql
-- Idempotent: CREATE TABLE IF NOT EXISTS
\i backend/prisma/migrations/add_do_not_call_table.sql
```

### Dogrulama:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'DoNotCall';
-- 1 satir donmeli

-- Test kayit insert:
INSERT INTO "DoNotCall" (id, "businessId", "phoneE164", source)
VALUES ('test_dnc_1', <BUSINESS_ID>, '+905559999999', 'MANUAL_TEST')
ON CONFLICT ("businessId", "phoneE164") DO NOTHING;

-- Dogrula:
SELECT * FROM "DoNotCall" WHERE "phoneE164" = '+905559999999';

-- Temizle:
DELETE FROM "DoNotCall" WHERE id = 'test_dnc_1';
```

---

## 3. Webhook Hatti Dogrulamasi

Prod loglarinda asagidaki pattern'leri ara:

| Pattern | Anlam |
|---------|-------|
| `[MAIN_WEBHOOK_HIT]` | Yeni hat (`/api/elevenlabs/webhook`) kullaniliyor |
| `[LEGACY_WEBHOOK_HIT]` | Eski hat (`/api/webhooks/elevenlabs/*`) hala hit aliyor |

```
grep "WEBHOOK_HIT" <log>
```

**Beklenen**: Sadece `MAIN_WEBHOOK_HIT` gormeli. Eger `LEGACY_WEBHOOK_HIT` gorunuyorsa, 11Labs dashboard'da webhook URL guncellenmemis demektir.

---

## 4. Test Call Ornekleri

### 4a. Tek arama (assistant endpoint):
```bash
curl -X POST https://<domain>/api/assistants/test-call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+905551234567",
    "callType": "BILLING_REMINDER"
  }'
```

### 4b. Tek arama (phoneNumber endpoint):
```bash
curl -X POST https://<domain>/api/phone-numbers/<phone_number_id>/test-call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "testPhoneNumber": "+905551234567",
    "callType": "BILLING_REMINDER"
  }'
```

### 4c. callType olmadan (400 beklenmeli):
```bash
curl -X POST https://<domain>/api/assistants/test-call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+905551234567"
  }'
# Beklenen: 400 {"error":"callType is required","validTypes":["BILLING_REMINDER","APPOINTMENT_REMINDER","SHIPPING_UPDATE"]}
```

### 4d. Gecerli callType degerleri:
- `BILLING_REMINDER` - Odeme hatirlatma
- `APPOINTMENT_REMINDER` - Randevu hatirlatma
- `SHIPPING_UPDATE` - Kargo bilgilendirme

---

## 5. Arama Sonrasi Log Kontrolu

### Webhook loglari:
```
grep "MAIN_WEBHOOK_HIT" <log>
grep "conversation.started" <log>
grep "phone_outbound_v1" <log>
```

### CallLog kontrolu (DB):
```sql
SELECT
  "callId",
  "businessId",
  status,
  direction,
  "endReason",
  "analysisData"->'label' AS label,
  "analysisData"->'callType' AS "callType",
  "analysisData"->'mode' AS mode,
  "createdAt"
FROM "CallLog"
WHERE "businessId" = <BUSINESS_ID>
ORDER BY "createdAt" DESC
LIMIT 5;
```

**Beklenen degerler**:
| Alan | Deger |
|------|-------|
| status | `answered` / `completed` |
| direction | `outbound` |
| analysisData.label | `YES` / `NO` / `LATER` / `DONT_CALL` / `ASK_AGENT` / `UNKNOWN` |
| analysisData.callType | `BILLING_REMINDER` (veya test edilen tip) |
| analysisData.mode | `KEYWORD_ONLY` |

---

## 6. DNC Testi

### 6a. DNC kaydı olustur:
```sql
INSERT INTO "DoNotCall" (id, "businessId", "phoneE164", source)
VALUES ('dnc_test', <BUSINESS_ID>, '+905551234567', 'MANUAL_TEST');
```

### 6b. DNC numaraya arama denemesi:
```bash
curl -X POST https://<domain>/api/assistants/test-call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+905551234567",
    "callType": "BILLING_REMINDER"
  }'
# Beklenen: 503 {"error":"DO_NOT_CALL_BLOCKED"}
```

### 6c. DNC test kaydini temizle:
```sql
DELETE FROM "DoNotCall" WHERE id = 'dnc_test';
```

---

## 7. Inbound Reddedilme Testi

`PHONE_INBOUND_ENABLED=false` oldugu icin inbound arama geldiginde:
- CallLog'a `inbound_disabled_v1` status yazilir
- Arama 11Labs API ile terminate edilir

```sql
SELECT "callId", status, summary
FROM "CallLog"
WHERE status = 'inbound_disabled_v1'
ORDER BY "createdAt" DESC
LIMIT 5;
```

---

## 8. Webhook Signature Dogrulamasi

### Gecerli signature ile test:
Normal arama yapildiginda 11Labs otomatik imzalar. Loglarda `signature verification failed` gormemeniz yeterli.

### Gecersiz signature ile test (curl):
```bash
curl -X POST https://<domain>/api/elevenlabs/webhook \
  -H "Content-Type: application/json" \
  -H "elevenlabs-signature: t=1234567890,v0=invalid_hash" \
  -d '{"type":"conversation.started"}'
# Prod'da beklenen: 401 {"error":"Invalid webhook signature"}
```

### Secret eksikliginde:
Logda su uyariyi arayın:
```
grep "ELEVENLABS_WEBHOOK_SECRET not set" <log>
```
Bu log gorunuyorsa → **ACIL: Secret set edilmeli**.

---

## 9. Batch Call DNC Filtreleme Testi

```bash
curl -X POST https://<domain>/api/batch-calls \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "DNC Test",
    "callType": "BILLING_REMINDER",
    "recipients": [
      {"name": "Test DNC", "phone": "+905551234567"},
      {"name": "Test OK", "phone": "+905559998877"}
    ]
  }'
```

DNC'li numara (`+905551234567`) filtrelenmeli, sadece temiz numara aramaya alinmali.
Response'da `skippedDoNotCall` sayisi kontrol edilmeli.

---

## 10. Outbound V1 Tool Allowlist Testi

V1 flow'da sadece su 4 tool gecerli:
- `log_call_outcome`
- `create_callback`
- `set_do_not_call`
- `schedule_followup`

Baska bir tool cagrisi yapilirsa (ornegin `customer_data_lookup`) loglarda:
```
grep "TOOL_NOT_ALLOWED_IN_PHONE_OUTBOUND_V1" <log>
```

---

## Hizli Kontrol Listesi

- [ ] Env vars set edildi (`PHONE_OUTBOUND_V1_ENABLED=true`, `CANARY_IDS` dolu)
- [ ] Startup log'da flag degerleri gorunuyor
- [ ] DoNotCall tablosu DB'de mevcut
- [ ] Test call yapildi, CallLog'da dogru kayit var
- [ ] DNC numara bloklanıyor (503 DO_NOT_CALL_BLOCKED)
- [ ] Sadece `MAIN_WEBHOOK_HIT` gorunuyor (legacy hit yok)
- [ ] Gecersiz signature 401 donuyor
- [ ] `ELEVENLABS_WEBHOOK_SECRET` set edilmis (uyari log yok)
- [ ] Inbound arama reddediliyor (`inbound_disabled_v1`)
- [ ] callType olmadan test-call 400 donuyor
