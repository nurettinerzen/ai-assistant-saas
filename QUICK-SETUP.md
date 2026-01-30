# Otomatik Smoke Test - Hızlı Kurulum (5 Dakika)

## ✅ ŞU ANDA YAPILACAKLAR

### Adım 1: GitHub Secrets Ekle (3 dk)

1. **GitHub'a git:** https://github.com/nurettinerzen/ai-assistant-saas
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** butonuna tıkla
4. Şu secret'ları ekle (birer birer):

```
İsim: TEST_ACCOUNT_A_EMAIL
Değer: nurettinerzen@gmail.com

İsim: TEST_ACCOUNT_A_PASSWORD
Değer: [production'daki güncel password - şu anda çalışmıyor gibi]

İsim: TEST_ACCOUNT_B_EMAIL
Değer: nurettin@selenly.co

İsim: TEST_ACCOUNT_B_PASSWORD
Değer: [production'daki güncel password]

İsim: DATABASE_URL
Değer: [Render.com'dan kopyala - PostgreSQL connection string]

İsim: DIRECT_URL
Değer: [DATABASE_URL ile aynı olabilir]
```

### Adım 2: Test Account Password'lerini Güncelle (2 dk)

**ÖNEMLİ:** Test hesaplarının production'da login olabildiğinden emin ol.

Option 1: Password'leri sıfırla
- https://app.telyx.ai → Forgot password
- Her iki hesap için yeni password belirle
- Yeni password'leri GitHub secrets'a ekle

Option 2: Mevcut password'leri kontrol et
- Manuel login dene: https://app.telyx.ai
- Login olabiliyorsan, o password'ü GitHub secrets'a ekle

### Adım 3: Git Push (30 sn)

```bash
git add .github/workflows/daily-smoke-test.yml QUICK-SETUP.md
git commit -m "feat: Add GitHub Actions smoke test automation"
git push origin main
```

### Adım 4: Manuel Test Çalıştır (1 dk)

1. GitHub'a git: https://github.com/nurettinerzen/ai-assistant-saas/actions
2. Sol tarafta **"Daily Smoke Test"** workflow'u bul
3. Sağ üstte **"Run workflow"** → **"Run workflow"** (yeşil buton)
4. 2-3 dakika bekle
5. Sonuçları kontrol et

✅ **BAŞARILI:** Yeşil tik işareti
❌ **BAŞARISIZ:** Kırmızı X → Tıkla ve hata mesajını oku

---

## 🎯 ÇALIŞMA ZAMANLARI

Push yaptıktan sonra otomatik olarak:
- **Her sabah 09:00** Turkey time
- **Her akşam 18:00** Turkey time

---

## 📊 RAPORLARI NASIL GÖRÜRSÜN?

### Option 1: GitHub Actions (Ana yöntem)
1. https://github.com/nurettinerzen/ai-assistant-saas/actions
2. "Daily Smoke Test" workflow'una tıkla
3. En son çalışmaya tıkla
4. "Artifacts" → Raporu indir

### Option 2: Email Bildirim (Sadece hata durumunda)
- Test fail ederse otomatik email gelir
- (Email setup gerekiyor - şimdilik skip)

---

## 🔧 SORUN GİDERME

### "Login failed: Invalid credentials"
**ÇÖZÜM:** Test hesaplarının password'lerini güncelle
1. https://app.telyx.ai'da manual login dene
2. Çalışan password'ü GitHub secrets'a ekle

### "DATABASE_URL is not defined"
**ÇÖZÜM:** GitHub secrets'a DATABASE_URL ekle
1. Render.com → PostgreSQL → Connection String kopyala
2. GitHub → Settings → Secrets → New secret

### Workflow çalışmıyor
**ÇÖZÜM:** GitHub Actions enabled mi kontrol et
1. GitHub repo → Settings → Actions → General
2. "Allow all actions" seçili olmalı

---

## 💡 SLACK OLMADAN ÇALIŞIR MI?

**EVET!** Slack olmadan da tam çalışır:
- Test sonuçları GitHub Actions'da görünür
- Raporlar artifact olarak kaydedilir
- İstersen sonra Slack eklersin

Slack eklemek istersen:
1. slack.com'da ücretsiz workspace oluştur
2. Incoming webhook oluştur
3. GitHub secrets'a SLACK_WEBHOOK_URL ekle
4. smoke-test.js'de notification aktif et

---

## ✅ BAŞARILI KURULUM KONTROLÜ

Şunları yap:
1. ✅ GitHub secrets eklendi (6 adet)
2. ✅ Git push yapıldı
3. ✅ Manuel workflow çalıştırıldı
4. ✅ Test PASS veya fail nedeni anlaşıldı

---

## 📞 YARDIM

Sorun yaşarsan:
1. GitHub Actions loglarını oku (detaylı hata mesajı var)
2. Test account login'i kontrol et
3. DATABASE_URL doğru mu kontrol et

---

**NOT:** İlk kurulumda login hatası normaldir çünkü test account password'leri production'da farklı olabilir. Password'leri güncelledikten sonra tekrar dene.
