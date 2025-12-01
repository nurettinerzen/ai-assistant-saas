# 🔧 MANUEL GIT KOMUTLARI

Eğer script çalışmazsa, bu komutları manuel olarak çalıştırabilirsin.

---

## 🚀 HIZLI PUSH (Önerilen)

```bash
cd /app

# Tüm değişiklikleri ekle
git add .

# Commit oluştur
git commit -m "feat: Complete TELYX.AI implementation - All 6 tasks"

# GitHub'a push et
git push origin main
```

---

## 📝 DETAYLI COMMIT MESAJI İLE PUSH

```bash
cd /app

# Tüm değişiklikleri ekle
git add .

# Detaylı commit mesajı
git commit -m "feat: Complete TELYX.AI feature implementation

✨ Features:
- Multi-language support (16 languages)
- Integration system (Calendly, Google Calendar, HubSpot, Sheets, WhatsApp, Zapier)
- Call Analytics Dashboard with sentiment analysis
- BYOC Phone Number System (Netgsm, Bulutfon)
- Knowledge Base VAPI integration

🐛 Bug Fixes:
- Landing page language selector
- Onboarding close button
- Voices page filters
- Integrations industry filter
- Phone numbers access control

📦 Changes:
- 13 new files
- 12 updated files
- All 6 tasks completed"

# Push
git push origin main
```

---

## 🔍 PUSH ÖNCESI KONTROL

```bash
cd /app

# Hangi dosyalar değişti?
git status

# Değişiklikleri göster
git diff --stat

# Hangi dosyalar commit edilecek?
git diff --cached --name-only
```

---

## 🌿 BRANCH İLE PUSH (Güvenli)

Eğer main'e direkt push etmek istemiyorsan:

```bash
cd /app

# Yeni branch oluştur
git checkout -b feature/telyx-complete-implementation

# Değişiklikleri ekle ve commit et
git add .
git commit -m "feat: Complete TELYX.AI implementation"

# Branch'i push et
git push origin feature/telyx-complete-implementation

# Sonra GitHub'da Pull Request oluşturabilirsin
```

---

## ⚠️ PROBLEM ÇÖZME

### Problem 1: "Permission denied"
```bash
# SSH key kontrol et
ssh -T git@github.com

# Veya HTTPS kullan
git remote set-url origin https://github.com/nurettinerzen/ai-assistant-saas.git
```

### Problem 2: "Updates were rejected"
```bash
# Önce pull yap, sonra push et
git pull origin main --rebase
git push origin main
```

### Problem 3: "Conflict"
```bash
# Force push (DİKKAT: Mevcut remote değişiklikleri siler!)
git push origin main --force

# Veya daha güvenli:
git pull origin main
# Conflict'leri çöz
git add .
git commit -m "fix: Resolve conflicts"
git push origin main
```

---

## 📊 PUSH SONRASI KONTROL

```bash
# Push başarılı mı?
git log --oneline -5

# Remote ile senkron mu?
git status

# GitHub'da göster
echo "Repository: https://github.com/nurettinerzen/ai-assistant-saas"
```

---

## 🎯 TEK KOMUT (EN BASIT)

```bash
cd /app && git add . && git commit -m "feat: Complete implementation" && git push origin main
```

---

## 📦 SADECE BELİRLİ DOSYALARI PUSH

Eğer tüm dosyaları değil de sadece belirli dosyaları push etmek istersen:

```bash
cd /app

# Sadece backend services
git add backend/src/services/*.js
git commit -m "feat: Add integration services"

# Sadece frontend components
git add frontend/components/*.jsx
git commit -m "feat: Update frontend components"

# Push
git push origin main
```

---

## ✅ PUSH EDİLECEK TÜM DOSYALAR

### Yeni Dosyalar (13):
- backend/src/services/calendly.js
- backend/src/services/google-calendar.js
- backend/src/services/hubspot.js
- backend/src/services/google-sheets.js
- backend/src/services/whatsapp.js
- backend/src/services/vapiKnowledge.js
- backend/src/routes/webhooks.js
- backend/src/data/voip-providers.js
- frontend/app/guides/netgsm-setup/page.jsx
- frontend/app/guides/bulutfon-setup/page.jsx
- backend/prisma/migrations/MIGRATION_NOTE.md
- backend/prisma/migrations/KNOWLEDGE_BASE_VAPI.md
- DEPLOYMENT_SUMMARY.md

### Güncellenmiş Dosyalar (12):
- backend/src/server.js
- backend/src/routes/voices.js
- backend/src/routes/business.js
- backend/src/routes/analytics.js
- backend/src/routes/integrations.js
- backend/src/routes/knowledge.js
- backend/src/routes/phoneNumber.js
- frontend/components/LanguageSwitcher.jsx
- frontend/components/Navigation.jsx
- frontend/components/VoiceDemo.jsx
- frontend/components/PhoneNumberModal.jsx
- frontend/app/dashboard/voices/page.jsx
- frontend/app/dashboard/integrations/page.jsx
- frontend/app/dashboard/phone-numbers/page.jsx
- frontend/app/dashboard/analytics/page.jsx

---

**Toplam: 25+ dosya değişti!** 🚀
