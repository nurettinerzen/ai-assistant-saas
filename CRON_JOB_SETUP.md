# CRON-JOB.ORG SETUP (5 Dakika)

**URL**: https://cron-job.org
**Hesap**: Zaten üye oldun ✅

---

## Adım 1: Create Cronjob

Dashboard'da **"Create cronjob"** butonuna tıkla.

---

## Adım 2: Job Configuration

### Basic Settings

```
Title: Red Alert Health Check
```

### URL Configuration

```
URL: https://api.telyx.ai/api/cron/red-alert-health
Request method: POST
Request timeout: 30 seconds
```

---

## Adım 3: Schedule (Timezone)

```
Timezone: America/Los_Angeles
```

**Cron expression**:
```
0 0,6,12,18 * * *
```

Bu şu demek:
- 12:00 AM (gece yarısı) LA
- 6:00 AM LA
- 12:00 PM (öğlen) LA
- 6:00 PM (akşam) LA

---

## Adım 4: HTTP Headers (CRITICAL!)

**Advanced Settings** → **HTTP Headers** kısmına ekle:

```
X-Cron-Secret: YOUR_CRON_SECRET
Content-Type: application/json
```

**CRON_SECRET nasıl bulunur**:
1. Render Dashboard → ai-assistant-backend
2. Environment → `CRON_SECRET` değerini kopyala
3. Yukarıya yapıştır

**Örnek**:
```
X-Cron-Secret: abc123xyz456
Content-Type: application/json
```

---

## Adım 5: Notifications

**Email notification** kısmında:

```
✅ Send notification on failure
Email: nurettinerzen@gmail.com
```

**Failure koşulları**:
- HTTP status code != 200
- Response time > 30 seconds
- Connection timeout

---

## Adım 6: Save

**"Create"** butonuna tıkla → Job oluşturulacak.

---

## Adım 7: Test (İlk Çalıştırma)

1. Jobs listesinde **"Red Alert Health Check"** bulunacak
2. Sağ tarafta **⚙️ (settings)** simgesi var
3. Dropdown menüden **"Execute now"** seç
4. Birkaç saniye bekle
5. **Execution history** tabına git
6. Yeşil ✅ olmalı (HTTP 200)

**Response örneği**:
```json
{
  "success": true,
  "message": "Health check completed: healthy",
  "healthScore": 100,
  "status": "healthy",
  "events": {
    "critical": 0,
    "high": 0,
    "total": 0
  }
}
```

---

## Sorun Giderme

### Hata 1: 401 Unauthorized

**Neden**: `X-Cron-Secret` yanlış veya eksik

**Çözüm**:
1. Job → Edit → Advanced → HTTP Headers
2. `X-Cron-Secret` değerini kontrol et
3. Render'daki `CRON_SECRET` ile eşleşmeli (case-sensitive!)

---

### Hata 2: 503 Service Unavailable

**Neden**: Backend deploy oluyor veya down

**Çözüm**:
1. Render Dashboard → Logs kontrol et
2. Service status "Running" olmalı
3. 2-3 dakika bekle, tekrar dene

---

### Hata 3: Connection Timeout

**Neden**: Backend çok yavaş yanıt veriyor (>30s)

**Çözüm**:
1. Job → Edit → Request timeout → 60 seconds yap
2. Render logs'ta slow query kontrol et

---

## Email Bildirimleri

### Ne Zaman Email Gelir?

1. **Job fail olursa** (status != 200)
2. **Timeout olursa** (>30s)
3. **Connection error olursa**

### Email Örneği (Success):

```
Subject: Cronjob "Red Alert Health Check" failed

Job: Red Alert Health Check
URL: https://api.telyx.ai/api/cron/red-alert-health
Time: 2026-01-30 18:00:00 PST
Status: 200 OK
Response: {"success":true,"healthScore":100,"status":"healthy"}
```

### Email Örneği (Critical):

```
Subject: Cronjob "Red Alert Health Check" - CRITICAL STATUS

Job: Red Alert Health Check
URL: https://api.telyx.ai/api/cron/red-alert-health
Time: 2026-01-30 18:00:00 PST
Status: 200 OK
Response: {"success":true,"healthScore":40,"status":"critical","events":{"critical":6}}

⚠️ ACTION REQUIRED: Check Red Alert dashboard immediately
```

---

## Özet (Copy-Paste)

```
Title: Red Alert Health Check
URL: https://api.telyx.ai/api/cron/red-alert-health
Method: POST
Schedule: 0 0,6,12,18 * * *
Timezone: America/Los_Angeles
Timeout: 30 seconds

Headers:
X-Cron-Secret: [RENDER'DAN KOPYALA]
Content-Type: application/json

Notifications:
✅ Email on failure: nurettinerzen@gmail.com
```

**Done!** 🚀

---

## Sonraki Adımlar

1. ✅ Cron job oluşturuldu
2. ✅ Test edildi ("Execute now")
3. ⏳ 6 saat sonra otomatik çalışacak
4. ⏳ Email gelirse → Red Alert dashboard kontrol et

**Pilot hazır!** Başka bir şey yapmana gerek yok.
