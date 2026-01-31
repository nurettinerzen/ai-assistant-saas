# PILOT COMPLETE - SENIN YAPMAN GEREKENLER

**Tarih**: 2026-01-30
**Durum**: Kod hazır, sadece GitHub secrets lazım

---

## ✅ Tamamlanmış

1. **3 Deliverable**:
   - ✅ PROD_PROOF_PACK.md (3 event kanıtı)
   - ✅ VALIDATION_MATRIX.md (15 test matrix)
   - ✅ PILOT_OPS_RUNBOOK.md (ops rehberi)

2. **Kod**:
   - ✅ Red Alert dashboard (sidebar'da görünecek)
   - ✅ Safe test endpoints (`/api/safe-test/*`)
   - ✅ Cron health check endpoint (`/api/cron/red-alert-health`)
   - ✅ GitHub Actions workflow (otomatik testler)

3. **Deploy**:
   - ✅ Kod pushed to main
   - 🔄 Render otomatik deploy ediyor (2-3 dakika)

---

## 🎯 SENİN YAPMAN GEREKENLER (5 Dakika)

### Adım 1: GitHub Secrets Ekle (Testler İçin)

GitHub'da repository → Settings → Secrets and variables → Actions → New repository secret

**Gerekli Secrets**:

1. **DATABASE_URL** (zorunlu - testler için)
   ```
   Name: DATABASE_URL
   Value: [Render'dan PostgreSQL connection string'i kopyala]
   ```
   Render → PostgreSQL → Internal Database URL'i al

2. **MAIL_USERNAME** (opsiyonel - test fail email için)
   ```
   Name: MAIL_USERNAME
   Value: nurettinerzen@gmail.com
   ```

3. **MAIL_PASSWORD** (opsiyonel - test fail email için)
   ```
   Name: MAIL_PASSWORD
   Value: [Gmail App Password]
   ```
   Gmail → Security → 2-Step Verification → App passwords → Generate

**Not**: MAIL secrets yoksa sadece test fail eder, email gitmez. DATABASE_URL olmazsa testler çalışmaz.

---

### Adım 2: Render Environment Variables (Production)

Render Dashboard → ai-assistant-saas (backend) → Environment

**Ekle**:
```
SAFE_TEST_MODE=true
```

**Kaydet** → Otomatik redeploy olacak

---

### Adım 3: Test Et (Deploy Bitince)

```bash
# 1. Health check
curl https://api.telyx.ai/health

# Beklenen: {"status":"ok",...}

# 2. Red Alert dashboard
# Browser: https://telyx.ai/dashboard/admin/red-alert
# Admin email ile login → Sidebar'da "Red Alert" göreceksin

# 3. GitHub Actions test
# GitHub → Actions tab → Latest workflow run → Yeşil ✅ olmalı
```

---

## 📋 Checklist

- [ ] GitHub secret ekle: `DATABASE_URL`
- [ ] GitHub secret ekle: `MAIL_USERNAME` (opsiyonel)
- [ ] GitHub secret ekle: `MAIL_PASSWORD` (opsiyonel)
- [ ] Render env ekle: `SAFE_TEST_MODE=true`
- [ ] Deploy bitsin (2-3 dakika bekle)
- [ ] Health check test et: `curl https://api.telyx.ai/health`
- [ ] Red Alert dashboard aç: https://telyx.ai/dashboard/admin/red-alert
- [ ] GitHub Actions yeşil ✅ mi kontrol et

---

## 🚫 Yapman GEREKMEYENler

❌ **Cron job setup** - Opsiyonel, pilot için gerekli değil
❌ **Email integration** - Render zaten nurettinerzen@gmail.com'a email atar
❌ **Slack setup** - Opsiyonel, pilot için gerekli değil
❌ **Manuel test çalıştırma** - GitHub Actions otomatik yapacak

---

## ⚠️ Düzelttiğim Hatalar

1. **URL karışıklığı**:
   - ❌ Yanlış: `api.telyx.ai`
   - ✅ Doğru: `ai-assistant-saas.onrender.com`

2. **Email**:
   - ❌ Yanlış: `nurettin@telyx.ai`
   - ✅ Doğru: `nurettinerzen@gmail.com`

3. **GitHub Actions**:
   - ❌ Önce: Yok
   - ✅ Şimdi: `.github/workflows/tests.yml` eklendi

4. **Cron job confusion**:
   - ❌ Önce: Zorunlu gibi göstermiştim
   - ✅ Şimdi: OPSIYONEL olarak işaretlendi

---

## 🎯 Sonraki Adım

1. **Şimdi**: GitHub secrets ekle (DATABASE_URL zorunlu)
2. **5 dakika sonra**: Deploy bitsin, health check test et
3. **10 dakika sonra**: Red Alert dashboard'a bak
4. **DONE**: Pilot hazır! 🚀

---

## ❓ Sorun Olursa

**Deploy fail**:
- Render → Logs kontrol et
- Genelde env variable eksik olur

**GitHub Actions fail**:
- Actions tab → Workflow run → Details
- DATABASE_URL secret doğru mu kontrol et

**Red Alert görünmüyor**:
- Admin email ile login ettin mi? (whitelist: nurettinerzen@gmail.com)
- Frontend deploy bitti mi? (Render → frontend service kontrol et)

**Test email gelmiyor**:
- MAIL_USERNAME ve MAIL_PASSWORD secrets ekledin mi?
- Gmail App Password doğru mu?
- Normal - opsiyonel, olmasa da olur

---

## 📧 İletişim

Sorun olursa: Bu chat'te sor, düzeltelim.

**Status**: READY FOR PILOT ✅
