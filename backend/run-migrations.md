# 🚨 PRODUCTION MIGRATION REHBERİ

## SORUN
`npx prisma db push` komutu verileri silip yeniden oluşturuyor!
**ASLA production'da `db push` kullanma!**

## ✅ DOĞRU YÖNTEMLERİ

### Production'da Migration (VERİ GÜVENLİ)
```bash
# Render.com Shell'de:
npx prisma migrate deploy
```

### Yeni Migration Oluştur (Local)
```bash
npx prisma migrate dev --name describe_your_change
```

## 🔴 YAPMAMASI GEREKENLER

❌ Production'da: `npx prisma db push` (verileri siler!)
✅ Production'da: `npx prisma migrate deploy` (verileri korur)

## 🚀 ŞU AN YAPILACAKLAR

1. Supabase restore tamamlanınca haber ver
2. Render.com build command'ini değiştir:
   - Eski: `npm install && npx prisma db push`
   - Yeni: `npm install && npx prisma migrate deploy`
3. Render.com Shell'de: `npx prisma migrate deploy`

## KOMUT KARŞILAŞTIRMASI

| Komut | Verileri Siler? | Kullanım |
|-------|----------------|----------|
| `migrate deploy` | **Hayır** | **Production** |
| `migrate dev` | Hayır | Local dev |
| `db push` | **Evet** | **Sadece local** |
| `migrate reset` | **Evet** | **Sadece local** |
