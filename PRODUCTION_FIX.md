# Production ve Localhost Hata Çözümleri

## 🔴 PRODUCTION SORUNU: Database Tabloları Yok

### Hata:
```
The table `public.Business` does not exist in the current database.
The table `public.User` does not exist in the current database.
```

### Çözüm (db push ile):

Production sunucusunda (Render.com Shell veya SSH):

```bash
# Production'da schema'yı veritabanına push et
npx prisma db push

# Client'ı yeniden generate et
npx prisma generate
```

### Alternatif: Manuel olarak Render.com'da

1. Render.com Dashboard → Backend Service
2. "Shell" sekmesine git
3. Şu komutları çalıştır:
```bash
cd src/backend  # veya backend klasörüne git
npx prisma db push
npx prisma generate
```
4. Service'i restart et

### Not:
- `db push` development ve production'da schema değişikliklerini direkt veritabanına uygular
- Migration history oluşturmaz, daha hızlıdır
- `migrate` yerine `db push` kullanmak sizin workflow'unuza daha uygun

---

## 🔴 LOCALHOST SORUNU: 403 Forbidden Hataları

### Hatalar:
```
GET http://localhost:3001/api/auth/me 403 (Forbidden)
GET http://localhost:3001/api/business/chat-widget 403 (Forbidden)
GET http://localhost:3001/api/assistants 403 (Forbidden)
GET http://localhost:3001/api/subscription 403 (Forbidden)
```

### Olası Nedenler:

#### 1. Frontend .env.local dosyası yok

Frontend klasöründe `.env.local` dosyası oluşturun:

```bash
cd frontend
cp .env.example .env.local
```

`.env.local` içeriği:
```env
# API Backend URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-development-secret-here

# Google OAuth (opsiyonel, login için)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

#### 2. Backend CORS ayarları

Backend `.env` dosyanızda şunun olduğundan emin olun:

```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

#### 3. Token sorunu

Browser console'da şunu kontrol edin:
```javascript
localStorage.getItem('token')
```

Eğer `null` ise, tekrar login olun:
1. http://localhost:3000/login
2. Email/şifre ile giriş
3. Token localStorage'a kaydedilecek

#### 4. Backend çalışıyor mu?

```bash
# Backend terminalde:
cd backend
npm run dev

# Şu çıktıyı görmelisiniz:
# ✅ Server running on port 3001
```

#### 5. JWT_SECRET ayarlandı mı?

Backend `.env` dosyasında:
```env
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters
```

### Test Adımları:

1. **Backend'i başlat:**
```bash
cd backend
npm run dev
```

2. **Frontend'i başlat:**
```bash
cd frontend
npm run dev
```

3. **Health check:**
```bash
curl http://localhost:3001/health
# Sonuç: {"status":"ok",...}
```

4. **Login test:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

5. **Token test:**
```bash
# Yukarıdan aldığınız token ile:
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Hızlı Çözüm:

```bash
# 1. Frontend .env.local oluştur
cd frontend
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-key-12345
EOF

# 2. Backend restart
cd ../backend
npm run dev

# 3. Frontend restart (yeni terminalde)
cd frontend
npm run dev

# 4. Browser'da cache temizle:
# - DevTools > Application > Storage > Clear site data
# - Tekrar login ol
```

---

## ✅ Kontrol Listesi

### Production:
- [ ] `npx prisma db push` çalıştırıldı
- [ ] Service restart edildi
- [ ] Veritabanı bağlantısı çalışıyor
- [ ] Loglar temiz

### Localhost:
- [ ] Frontend `.env.local` dosyası var
- [ ] Backend `.env` dosyası doğru
- [ ] CORS ayarları doğru
- [ ] Backend port 3001'de çalışıyor
- [ ] Frontend port 3000'de çalışıyor
- [ ] Token localStorage'da var
- [ ] Login başarılı

---

## 🔍 Debug Komutları

### Production log kontrolü:
```bash
# Render.com logs
# Dashboard > Logs sekmesi

# Database bağlantı testi
npx prisma db pull
```

### Localhost debug:
```bash
# Backend console log seviyesi
DEBUG=* npm run dev

# Network trafiği (browser DevTools)
# Network > XHR > Failed requests
```

---

## 📞 Yardım

Hala sorun devam ederse:
1. Backend logs'u kontrol et
2. Browser console errors'u kontrol et
3. Network tab'da request headers'ı kontrol et (Authorization header var mı?)
