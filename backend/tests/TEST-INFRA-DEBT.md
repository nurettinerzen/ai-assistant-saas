# Test Infrastructure Debt

**Priority**: P2 (merge blocker olmayan ama repo hijyen sorunu)
**Owner**: TBD
**Created**: 2026-02-06
**Branch**: new-branch-codex (pre-existing, bu branch ile alakasız)

---

## Issue 1: `draftGuards.js` missing module

**File**: `tests/unit/phase4-guards.test.js`
**Error**: `Could not locate module ../../src/core/email/draftGuards.js`
**Impact**: Unit test suite 0/2 sonuç veriyor (test runner hata atıyor)
**Root cause**: `draftGuards.js` ya silinmiş ya da taşınmış ama test güncellenmemiş.
**Fix**: Test dosyasını sil veya doğru modüle yönlendir.

---

## Issue 2: `vitest` dependency missing

**File**: `tests/guardrails/guardrails.test.js`
**Error**: `Cannot find module 'vitest'`
**Impact**: Guardrails test suite çalışmıyor.
**Root cause**: Test vitest ile yazılmış ama proje jest kullanıyor. vitest devDependency'de yok.
**Fix**: Ya vitest'i devDependency'ye ekle ya da testi jest'e migrate et.

---

## Issue 3: `normalize-phone.test.js` process.exit crash

**File**: `tests/unit/normalize-phone.test.js:174`
**Error**: `process.exit(0)` jest worker'ı crash ettiriyor
**Impact**: Testler aslında geçiyor ama jest "failed" raporluyor (worker crash)
**Root cause**: Test dosyasında `process.exit(0)` çağrısı var. Bu standalone script olarak tasarlanmış, jest runner ile uyumsuz.
**Fix**: `process.exit()` çağrısını kaldır, jest assertion'larına çevir.
**Risk**: Bu "test geçti ama crash" pattern'i, CI'da false negative oluşturabilir.

---

## Issue 4: jest devDependency'de yok

**File**: `backend/package.json`
**Impact**: `npm ci` sonrası test runner bulunamıyor
**Root cause**: jest `scripts.test`'te kullanılıyor ama `devDependencies`'de yok.
**Fix**: `npm install --save-dev jest @jest/globals` çalıştırıp package.json'u commit et.

---

## Acceptance Criteria

- [ ] Tüm unit test dosyaları `npx jest tests/unit` ile hatasız çalışıyor
- [ ] Guardrails test dosyası jest veya vitest ile çalışıyor
- [ ] `npm test` CI'da green
- [ ] `process.exit` kullanımı test dosyalarından kaldırıldı
