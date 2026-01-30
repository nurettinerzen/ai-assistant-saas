# Login 401 Hata Debugı

## Durum
- **Production**: `POST https://api.telyx.ai/api/auth/login 401 (Unauthorized)`
- **Localhost**: `POST http://localhost:3001/api/auth/login 401 (Unauthorized)`

## 401 Nedenleri

Login endpoint'inde 401 dönmesinin 2 nedeni var:

1. **User bulunamadı** (email yanlış veya kayıtlı değil)
   ```javascript
   // Line 297-299
   if (!user) {
     return res.status(401).json({ error: 'Invalid credentials' });
   }
   ```

2. **Şifre yanlış** (bcrypt compare başarısız)
   ```javascript
   // Line 302-305
   const validPassword = await bcrypt.compare(password, user.password);
   if (!validPassword) {
     return res.status(401).json({ error: 'Invalid credentials' });
   }
   ```

---

## Production Debug

### Adım 1: Database tablolarını kontrol et

Production'da daha önce `table does not exist` hatası vardı. Önce bunu çözelim:

```bash
# Render.com Shell'de:
npx prisma db push
```

### Adım 2: User var mı kontrol et

```bash
# Render.com Shell'de:
npx prisma studio
```

Veya direkt database'e bağlan:
```bash
# PostgreSQL ile:
psql $DATABASE_URL -c "SELECT id, email, role FROM \"User\" LIMIT 5;"
```

**Kontrol edilecekler:**
- [ ] `User` tablosu var mı?
- [ ] Email'iniz kayıtlı mı?
- [ ] `password` hash'lenmiş mi? (bcrypt hash olmalı, `$2b$` ile başlamalı)
- [ ] `businessId` null değil mi?

### Adım 3: Backend logları kontrol et

Render.com Dashboard > Logs sekmesi

Şunu aramalısınız:
```
Login error: [hata mesajı]
```

---

## Localhost Debug

### Adım 1: Database'e bağlan

```bash
cd backend
npx prisma studio
```

Browser'da açılan Prisma Studio'da:
- `User` tablosuna git
- Email'iniz var mı kontrol et
- Password hash'i var mı kontrol et

### Adım 2: Test user oluştur

Eğer user yoksa yeni bir tane oluştur:

```bash
cd backend
node << 'EOJS'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  const hashedPassword = await bcrypt.hash('test123', 10);
  
  const business = await prisma.business.create({
    data: {
      name: 'Test Business',
      chatEmbedKey: 'emb_' + Math.random().toString(36).substring(7),
      users: {
        create: {
          email: 'test@test.com',
          password: hashedPassword,
          role: 'OWNER',
          emailVerified: true,
        }
      }
    }
  });
  
  console.log('Test user created:');
  console.log('Email: test@test.com');
  console.log('Password: test123');
  console.log('Business:', business.name);
}

createTestUser()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
EOJS
```

### Adım 3: Backend logları kontrol et

Terminal'de backend çalışırken:
```
Login error: [hata mesajı burda görünecek]
```

### Adım 4: Manuel API testi

```bash
# Terminal'de:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' \
  -v
```

**Beklenen cevap (success):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": { ... }
}
```

**Eğer 401:**
```json
{
  "error": "Invalid credentials"
}
```

---

## Sık Hatalar ve Çözümleri

### 1. "User tablosu yok" (Production)
```bash
npx prisma db push
```

### 2. "User bulunamadı"
- Email doğru mu? (büyük/küçük harf duyarlı)
- User kayıtlı mı? (Prisma Studio'da kontrol et)

### 3. "Şifre yanlış"
- Şifre doğru mu?
- Password hash bcrypt formatında mı? (`$2b$10$...`)

### 4. "JWT_SECRET tanımsız"
Backend `.env`:
```env
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
```

### 5. "Database bağlantı hatası"
```bash
# Test et:
npx prisma db pull
```

---

## Hızlı Çözüm (Localhost)

```bash
# 1. Backend'i durdur (Ctrl+C)

# 2. Database reset (DİKKAT: Tüm veriyi siler!)
cd backend
npx prisma db push --force-reset

# 3. Test user oluştur
npm run seed  # Eğer seed script varsa

# VEYA manuel:
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seed() {
  const hash = await bcrypt.hash('admin123', 10);
  const business = await prisma.business.create({
    data: {
      name: 'Admin Business',
      chatEmbedKey: 'emb_admin',
      users: {
        create: {
          email: 'admin@test.com',
          password: hash,
          role: 'OWNER',
          emailVerified: true
        }
      }
    }
  });
  console.log('Created:', business);
}

seed().then(() => process.exit());
"

# 4. Backend'i başlat
npm run dev

# 5. Test et
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

---

## Test Checklist

### Production:
- [ ] `npx prisma db push` çalıştırıldı
- [ ] User tablosu var
- [ ] En az 1 user kayıtlı
- [ ] Backend logları kontrol edildi
- [ ] CORS ayarları doğru

### Localhost:
- [ ] Database çalışıyor
- [ ] User tablosu var  
- [ ] Test user oluşturuldu
- [ ] Backend port 3001'de çalışıyor
- [ ] `.env.local` dosyası var
- [ ] Frontend restart edildi

---

## Şimdi Ne Yapmalısınız?

1. **Production için:**
   - Render.com Shell'de `npx prisma db push` çalıştırın
   - Backend loglarını kontrol edin
   - Hangi hata mesajı geliyor? (console.error'dan)

2. **Localhost için:**
   - `npx prisma studio` ile database'i açın
   - `User` tablosunda email'iniz var mı?
   - Yoksa yukarıdaki test user script'ini çalıştırın

3. **Bana söyleyin:**
   - Backend loglarında ne yazıyor?
   - Prisma Studio'da user var mı?
   - Hangi email/password ile deniyorsunuz?
