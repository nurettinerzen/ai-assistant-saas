# Multi-Region Architecture Documentation

> **Status**: Türkiye odaklı. Diğer bölgeler için altyapı hazır ama aktif değil.

Bu doküman, sistemin bölge/ülke/dil bazlı dinamik yapısını açıklar. Yeni bir bölge eklerken bu dosyayı referans alın.

---

## Genel Bakış

Sistem şu kavramları ayırır:
- **Bölge (Region)**: Fiyatlandırma ve özellik grubu (TR, BR, US, EU)
- **Ülke (Country)**: Kullanıcının işletme lokasyonu (TR, BR, US, GB, DE, vb.)
- **Dil (Language)**: Asistan konuşma dili (TR, EN, PR, DE, vb.)
- **Locale**: UI arayüz dili (tr, en)

---

## Dosya Haritası

### 1. Backend Konfigürasyon

| Dosya | Amaç | Bölge Eklerken |
|-------|------|----------------|
| `backend/src/config/countries.js` | Ülke tanımları, para birimi, saat dilimi | Yeni ülke ekle |
| `backend/src/config/pricing.js` | Bölge bazlı fiyatlandırma | REGIONAL_PRICING'e bölge ekle |
| `backend/src/config/plans.js` | Özellik görünürlüğü | regionVisibility güncelle |
| `backend/src/config/integrationMetadata.js` | Bölgeye özel entegrasyonlar | Yeni entegrasyon ekle |

### 2. Backend Servisler

| Dosya | Amaç | Notlar |
|-------|------|--------|
| `backend/src/services/paymentProvider.js` | Ödeme sağlayıcı seçimi | TR→iyzico, diğer→Stripe |
| `backend/src/services/iyzico.js` | Türkiye ödeme | Sadece TR |
| `backend/src/services/iyzicoSubscription.js` | Türkiye abonelik | Sadece TR |
| `backend/src/services/netgsm.js` | Türkiye VoIP | Sadece TR, 0850 numaralar |
| `backend/src/data/voip-providers.js` | Ülke bazlı VoIP sağlayıcılar | Yeni ülke için provider ekle |

### 3. Backend Routes

| Dosya | Amaç | Değişiklik Gerektiğinde |
|-------|------|------------------------|
| `backend/src/routes/phoneNumber.js` | Numara yönetimi | COUNTRY_PROVIDER_MAP güncelle |
| `backend/src/routes/subscription.js` | Abonelik | PLAN_CONFIG güncelle |
| `backend/src/routes/assistant.js` | Asistan oluşturma | ELEVENLABS_LANGUAGE_MAP güncelle |
| `backend/src/routes/voices.js` | Ses seçenekleri | VOICE_LIBRARY'e dil ekle |

### 4. Frontend

| Dosya | Amaç | Değişiklik |
|-------|------|-----------|
| `frontend/lib/features.js` | Özellik görünürlüğü | getRegion, feature visibility |
| `frontend/contexts/LanguageContext.jsx` | UI dili | supportedUILocales |
| `frontend/components/LanguageSwitcher.jsx` | Dil seçici | languages array |
| `frontend/components/OnboardingModal.jsx` | Kayıt akışı | COUNTRIES, LANGUAGES arrays |
| `frontend/components/PhoneNumberModal.jsx` | Numara alma | Ülke listesi, SIP config |
| `frontend/components/BuyCreditModal.jsx` | Kredi satın alma | TRANSLATIONS, currency |
| `frontend/app/pricing/page.jsx` | Fiyatlandırma sayfası | REGIONAL_PRICING |

### 5. Locale Dosyaları

```
frontend/locales/
├── tr.json    # Türkçe (Ana)
├── en.json    # İngilizce
├── pr.json    # Portekizce (Brezilya)
├── de.json    # Almanca
├── es.json    # İspanyolca
├── fr.json    # Fransızca
├── pt.json    # Portekizce (Portekiz)
└── ...
```

---

## Yeni Bölge Ekleme Checklist

### Aşama 1: Backend Konfigürasyon
- [ ] `config/countries.js` - Ülke tanımı ekle
- [ ] `config/pricing.js` - REGIONAL_PRICING'e bölge ekle
- [ ] `config/plans.js` - regionVisibility güncelle

### Aşama 2: Ödeme
- [ ] `services/paymentProvider.js` - Provider mapping
- [ ] Gerekirse yeni ödeme servisi (iyzico gibi)
- [ ] `routes/subscription.js` - PLAN_CONFIG güncelle

### Aşama 3: Telefon/VoIP
- [ ] `data/voip-providers.js` - Ülke için provider ekle
- [ ] `routes/phoneNumber.js` - COUNTRY_PROVIDER_MAP güncelle
- [ ] Gerekirse yeni VoIP servisi (netgsm gibi)

### Aşama 4: Asistan/Sesler
- [ ] `routes/assistant.js` - ELEVENLABS_LANGUAGE_MAP (gerekirse)
- [ ] `routes/voices.js` - VOICE_LIBRARY'e dil ekle
- [ ] Ses önizleme metinleri ekle

### Aşama 5: Frontend
- [ ] `lib/features.js` - getRegion güncellemesi
- [ ] `components/OnboardingModal.jsx` - COUNTRIES, LANGUAGES
- [ ] `components/PhoneNumberModal.jsx` - Ülke ve SIP config
- [ ] `app/pricing/page.jsx` - REGIONAL_PRICING
- [ ] Gerekirse `BuyCreditModal.jsx`, `CreditBalance.jsx` çevirileri

### Aşama 6: UI Dili (Opsiyonel)
- [ ] `locales/XX.json` - Çeviri dosyası oluştur
- [ ] `contexts/LanguageContext.jsx` - Import ekle, supportedUILocales
- [ ] `components/LanguageSwitcher.jsx` - languages array

### Aşama 7: Entegrasyonlar
- [ ] `config/integrationMetadata.js` - Bölgeye özel entegrasyonlar

---

## Bölge Özellikleri Matrisi

| Özellik | TR | US | EU | BR (Hazır Değil) |
|---------|----|----|----|----|
| **Telefon** | NetGSM 0850 | 11Labs/Twilio | 11Labs/Twilio | BYOC Only |
| **Ödeme** | iyzico | Stripe | Stripe | Stripe + Pix |
| **Para Birimi** | TRY | USD | EUR | BRL |
| **WhatsApp Calling** | Gizli | Gizli | Kilitli | Birincil |
| **SMS** | NetGSM | Twilio | Twilio | WhatsApp |
| **E-ticaret** | ikas, iDeasoft, Ticimax | Shopify | Shopify | - |

---

## Mevcut Durum

### Aktif Bölgeler
- **TR (Türkiye)**: Tam destek - iyzico, NetGSM, Türkçe UI

### Hazırlanan Ama Aktif Olmayan
- **US (Amerika)**: Altyapı hazır, test edilmedi
- **EU (Avrupa)**: Altyapı hazır, test edilmedi
- **BR (Brezilya)**: Yarım kalmış, kaldırıldı

### UI Dilleri
- **Aktif**: Türkçe (tr)
- **Hazır ama kapalı**: İngilizce (en)

---

## Önemli Notlar

1. **Ülke vs Bölge**: Ülke (TR, US, DE) → Bölge (TR, US, EU) mapping'i `getRegion()` ile yapılır
2. **Asistan Dili vs UI Dili**: Farklı konseptler - asistan çok dilde konuşabilir, UI sadece desteklenen dillerde
3. **Fiyatlandırma**: Her bölgenin kendi para birimi ve fiyat skalası var
4. **Ödeme**: Ülkeye göre provider seçilir (iyzico sadece TR)
5. **Telefon**: Ülkeye göre farklı altyapı (NetGSM sadece TR)

---

## Katkıda Bulunma

Yeni bölge eklerken:
1. Bu dokümanı oku
2. Checklist'i takip et
3. Her adımı test et
4. Bu dokümanı güncelle
