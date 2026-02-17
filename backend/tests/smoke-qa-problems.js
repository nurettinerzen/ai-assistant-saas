/**
 * QA Smoke Test — PDF Problem 1-5 (16.02.2026)
 *
 * Run:  node backend/tests/smoke-qa-problems.js
 * Prereq: Server running on localhost:3000
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const API = process.env.API_URL || 'http://localhost:3000';
const TS = Date.now();
let passCount = 0, failCount = 0;
const failures = [];

function ok(cond, name, detail = '') {
  if (cond) { passCount++; console.log(`   ✅ PASS: ${name}`); }
  else { failCount++; failures.push({ name, detail }); console.log(`   ❌ FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP ──
async function chat(embedKey, sessionId, message) {
  const r = await fetch(`${API}/api/chat/widget`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embedKey, sessionId, message }),
  });
  const j = await r.json();
  if (!j.success) console.log(`   ⚠️  ${j.code}: ${(j.details || j.message || '').substring(0, 200)}`);
  return j;
}
async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}
async function draft(threadId, token) {
  const r = await fetch(`${API}/api/email/threads/${threadId}/generate-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ createProviderDraft: false }),
  });
  return r.json();
}

// ── SETUP ──
async function setup() {
  console.log('\n📦 SETUP...');
  const embedKey = `emb_smoke_${crypto.randomBytes(8).toString('hex')}`;
  const email = `smoke_${TS}@test.local`;
  const pw = 'SmokeTest123!';

  const biz = await prisma.business.create({ data: {
    name: 'QA Smoke Test', businessType: 'ECOMMERCE', language: 'TR', country: 'TR',
    currency: 'TRY', timezone: 'Europe/Istanbul', chatWidgetEnabled: true,
    chatEmbedKey: embedKey,
    channelConfig: { chat: 'KB_ONLY', email: 'FULL', whatsapp: 'KB_ONLY' },
    helpLinks: { order_status_url: 'https://test-shop.com/siparislerim', support_email: 'destek@test-shop.com' },
  }});
  const bid = biz.id;
  console.log(`   Business: ${bid}, Key: ${embedKey}`);

  await prisma.user.create({ data: {
    email, password: await bcrypt.hash(pw, 10), name: 'Smoke Owner',
    role: 'OWNER', businessId: bid, onboardingCompleted: true, emailVerified: true,
  }});

  await prisma.subscription.create({ data: {
    businessId: bid, plan: 'STARTER', status: 'ACTIVE', balance: 100,
  }});

  await prisma.assistant.create({ data: {
    businessId: bid, name: 'Smoke Asistan', voiceId: 'test',
    systemPrompt: 'Sen bir e-ticaret destek asistanısın. Türkçe yanıt ver. Müşterilere sipariş süreçleri, kargo, iade, garanti ve ödeme konularında yardımcı ol.',
    isActive: true, callDirection: 'inbound', tone: 'professional',
  }});

  // KB — genel politikalar (ürün bilgisi KB'de olmaz, CRM'den gelir)
  for (const [q, a] of [
    ['Kargo ve teslimat süreleri nedir?', 'Siparişleriniz 1-3 iş günü içinde kargoya verilir. Sürat Kargo, Yurtiçi Kargo ve MNG Kargo ile çalışmaktayız. Kargo ücreti 500 TL üzeri siparişlerde ücretsizdir.'],
    ['İade süresi ve koşulları nedir?', '14 gün içinde iade hakkınız bulunmaktadır. Ürün kullanılmamış ve orijinal ambalajında olmalıdır. İade kargo ücreti alıcıya aittir. İade talebi için destek@test-shop.com adresine mail atabilirsiniz.'],
    ['Garanti koşulları nelerdir?', 'Tüm elektronik ürünlerimiz 2 yıl üretici garantisi kapsamındadır. Garanti kapsamı dışında kalan durumlar: fiziksel hasar, su teması, yetkisiz serviste açılma. Garanti sorgulama için fatura ve seri numarası gereklidir.'],
    ['Ödeme yöntemleri nelerdir?', 'Kredi kartı (Visa, Mastercard, Troy), banka havalesi/EFT ve kapıda ödeme (nakit veya kredi kartı) seçenekleri mevcuttur. Kredi kartına 6 aya kadar taksit imkanı bulunmaktadır.'],
    ['Çalışma saatleri ve iletişim bilgileri nelerdir?', 'Müşteri hizmetlerimiz hafta içi 09:00-18:00 saatleri arasında hizmet vermektedir. Bize destek@test-shop.com adresinden veya 0850 123 45 67 numaralı telefondan ulaşabilirsiniz.'],
  ]) {
    await prisma.knowledgeBase.create({ data: { businessId: bid, type: 'FAQ', title: q.substring(0, 30), question: q, answer: a, status: 'ACTIVE' }});
  }

  await prisma.crmWebhook.create({ data: { businessId: bid, isActive: true }});

  // Stock
  await prisma.crmStock.create({ data: { businessId: bid, sku: 'SMOKE-IPH16P', productName: 'iPhone 16 Pro Kılıf Siyah', inStock: true, quantity: 150, price: 349.9, externalUpdatedAt: new Date() }});
  await prisma.crmStock.create({ data: { businessId: bid, sku: 'SMOKE-SAM-S25', productName: 'Samsung Galaxy S25 Ultra Kılıf', inStock: true, quantity: 5, price: 299.9, externalUpdatedAt: new Date() }});
  await prisma.crmStock.create({ data: { businessId: bid, sku: 'SMOKE-AIRPOD4', productName: 'AirPods 4 Bluetooth Kulaklık', inStock: false, quantity: 0, price: 7499, externalUpdatedAt: new Date() }});

  // Orders
  await prisma.crmOrder.create({ data: { businessId: bid, orderNumber: 'SIP-SMOKE-001', customerPhone: '905551112233', customerName: 'Ahmet Yılmaz', customerEmail: 'ahmet@musteri.com', status: 'kargoda', trackingNumber: 'TR123456789', carrier: 'Sürat Kargo', totalAmount: 349.9, externalUpdatedAt: new Date() }});
  await prisma.crmOrder.create({ data: { businessId: bid, orderNumber: 'SIP-SMOKE-002', customerPhone: '905554443322', customerName: 'Zeynep Demir', customerEmail: 'zeynep@musteri.com', status: 'teslim edildi', trackingNumber: 'TR987654321', carrier: 'Yurtiçi Kargo', totalAmount: 299.9, externalUpdatedAt: new Date() }});

  // Customers
  await prisma.customerData.create({ data: { businessId: bid, companyName: 'Ahmet Yılmaz', phone: '905551112233', email: 'ahmet@musteri.com', contactName: 'Ahmet Yılmaz' }});
  await prisma.customerData.create({ data: { businessId: bid, companyName: 'Zeynep Demir', phone: '905554443322', email: 'zeynep@musteri.com', contactName: 'Zeynep Demir' }});

  // Email integration
  await prisma.emailIntegration.create({ data: { businessId: bid, provider: 'GMAIL', email: `smoke_${TS}@test.local`, credentials: { access_token: 'fake', refresh_token: 'fake' }, connected: true }});

  // P4 thread (Turkish order query)
  const t4 = await prisma.emailThread.create({ data: { businessId: bid, threadId: `t4_${TS}`, subject: 'Sipariş durumu', customerEmail: 'ahmet@musteri.com', customerName: 'Ahmet Yılmaz', status: 'PENDING_REPLY', lastMessageAt: new Date() }});
  await prisma.emailMessage.create({ data: { threadId: t4.id, messageId: `m4_${TS}`, direction: 'INBOUND', fromEmail: 'ahmet@musteri.com', fromName: 'Ahmet Yılmaz', toEmail: `smoke_${TS}@test.local`, subject: 'Sipariş durumu', bodyText: 'Merhaba, SIP-SMOKE-001 numaralı siparişimin durumunu öğrenmek istiyorum. Kargoya verildi mi? Teşekkürler.', status: 'RECEIVED', receivedAt: new Date() }});

  // P5 thread (stock query — SKU kodu ile, Miraç'ın test ettiği gibi)
  const t5 = await prisma.emailThread.create({ data: { businessId: bid, threadId: `t5_${TS}`, subject: 'Ürün stok durumu', customerEmail: 'zeynep@musteri.com', customerName: 'Zeynep Demir', status: 'PENDING_REPLY', lastMessageAt: new Date() }});
  await prisma.emailMessage.create({ data: { threadId: t5.id, messageId: `m5_${TS}`, direction: 'INBOUND', fromEmail: 'zeynep@musteri.com', fromName: 'Zeynep Demir', toEmail: `smoke_${TS}@test.local`, subject: 'Ürün stok durumu', bodyText: 'Merhaba, SMOKE-IPH16P kodlu ürünün stok durumu hakkında bilgi alabilir miyim? Teşekkürler.', status: 'RECEIVED', receivedAt: new Date() }});

  console.log('📦 SETUP COMPLETE\n');
  return { bid, embedKey, email, pw, t4id: t4.id, t5id: t5.id };
}

// ── TESTS ──
async function testP1(td) {
  console.log('--- P1: Genel Bilgi Sorgusu (KB_ONLY Chat) ---');

  // P1a: Kargo bilgisi (KB'de var)
  const msg1 = 'Kargo süreleri ne kadar, hangi kargo firmalarıyla çalışıyorsunuz?';
  console.log(`   📤 P1a: "${msg1}"`);
  const r1 = await chat(td.embedKey, `p1a-${TS}`, msg1);
  const reply1 = r1.reply || '';
  const tools1 = r1.toolsCalled || r1.toolCalls || [];
  console.log(`   📥 "${reply1.substring(0, 150)}..."`);
  console.log(`   🔧 [${tools1.join(', ')}]`);
  ok(r1.success === true, 'P1a: success', `got ${r1.success}`);
  ok(tools1.length === 0, 'P1a: tools boş (KB_ONLY)');
  const lo1 = reply1.toLowerCase();
  ok(['kargo','teslimat','iş günü','sürat','yurtiçi','mng'].some(k => lo1.includes(k)), 'P1a: kargo bilgisi var');

  await wait(600);

  // P1b: İade politikası (KB'de var)
  const msg2 = 'İade süresi kaç gün, koşullar neler?';
  console.log(`   📤 P1b: "${msg2}"`);
  const r2 = await chat(td.embedKey, `p1b-${TS}`, msg2);
  const reply2 = r2.reply || '';
  const tools2 = r2.toolsCalled || r2.toolCalls || [];
  console.log(`   📥 "${reply2.substring(0, 150)}..."`);
  ok(r2.success === true, 'P1b: success', `got ${r2.success}`);
  ok(tools2.length === 0, 'P1b: tools boş (KB_ONLY)');
  const lo2 = reply2.toLowerCase();
  ok(['14 gün','iade','ambalaj','kullanılmamış'].some(k => lo2.includes(k)), 'P1b: iade bilgisi var');

  await wait(600);

  // P1c: Garanti bilgisi (KB'de var)
  const msg3 = 'Garanti süresi ne kadar, garanti kapsamı nedir?';
  console.log(`   📤 P1c: "${msg3}"`);
  const r3 = await chat(td.embedKey, `p1c-${TS}`, msg3);
  const reply3 = r3.reply || '';
  console.log(`   📥 "${reply3.substring(0, 150)}..."`);
  ok(r3.success === true, 'P1c: success', `got ${r3.success}`);
  const lo3 = reply3.toLowerCase();
  ok(['garanti','2 yıl','yıl','üretici'].some(k => lo3.includes(k)), 'P1c: garanti bilgisi var');

  // Genel kontroller — tüm yanıtlarda tool code olmamalı
  for (const [label, reply] of [['P1a', reply1], ['P1b', reply2], ['P1c', reply3]]) {
    ok(!reply.toLowerCase().includes('tool_code'), `${label}: tool_code yok`);
    ok(!reply.includes('print('), `${label}: print() yok`);
    ok(!reply.includes('```'), `${label}: code block yok`);
  }
}

async function testP2a(td) {
  console.log('\n--- P2a: Sipariş — KB_ONLY Redirect ---');
  const msg = 'SIP-SMOKE-001 numaralı siparişimin durumunu öğrenmek istiyorum';
  console.log(`   📤 "${msg}"`);
  const r = await chat(td.embedKey, `p2a-${TS}`, msg);
  const reply = r.reply || '';
  const lo = reply.toLowerCase();
  console.log(`   📥 "${reply.substring(0, 200)}"`);
  ok(r.success === true, 'P2a: success');
  const redirect = ['test-shop.com','erişemiyorum','erisemiyorum','görüntüleyemiyorum','ulaşamıyorum','bu kanaldan','destek'].some(k => lo.includes(k));
  ok(redirect, 'P2a: redirect mesajı');
  ok(!lo.includes('kargoda'), 'P2a: durum sızdırılmadı');
  ok(!reply.includes('TR123456789'), 'P2a: takip no sızdırılmadı');
}

async function testP2b(td) {
  console.log('\n--- P2b: Sipariş + Doğrulama (KB_ONLY) ---');
  const msg = 'SIP-SMOKE-001 siparişi hakkında bilgi almak istiyorum, telefon numaramın son 4 hanesi 2233';
  console.log(`   📤 "${msg}"`);
  const r = await chat(td.embedKey, `p2b-${TS}`, msg);
  const reply = r.reply || '';
  console.log(`   📥 "${reply.substring(0, 200)}"`);
  ok(r.success === true, 'P2b: success');
  ok(!reply.toLowerCase().includes('kargoda'), 'P2b: durum sızdırılmadı');
  ok(!reply.includes('TR123456789'), 'P2b: takip no sızdırılmadı');
  ok(!reply.includes('Sürat Kargo'), 'P2b: kargo firması sızdırılmadı');
}

async function testP3(td) {
  console.log('\n--- P3: Session İzolasyonu ---');
  const rA = await chat(td.embedKey, `p3a-${TS}`, 'SIP-SMOKE-001 siparişim nerede?');
  console.log(`   📥 A: "${(rA.reply||'').substring(0, 80)}"`);
  await wait(500);
  const rB = await chat(td.embedKey, `p3b-${TS}`, 'Merhaba, nasılsınız?');
  const rb = rB.reply || '';
  console.log(`   📥 B: "${rb.substring(0, 80)}"`);
  ok(rB.success === true, 'P3: B success');
  ok(!rb.toLowerCase().includes('sip-smoke'), 'P3: B sipariş leak yok');
  ok(!rb.toLowerCase().includes('kargoda'), 'P3: B veri leak yok');
}

async function testP4(td, token) {
  console.log('\n--- P4: Email Dil — Türkçe ---');
  const r = await draft(td.t4id, token);
  if (!r.success) { ok(false, 'P4: draft oluştu', r.error); return; }
  const d = r.draft?.generatedContent || '';
  console.log(`   📥 "${d.substring(0, 200)}"`);
  console.log(`   🔧 [${(r.toolsCalled||[]).join(', ')}]`);
  ok(d.length > 0, 'P4: draft var');
  const dl = d.toLowerCase();
  const trHits = ['merhaba','sipariş','siparis','bilgi','yardım','yardim','teşekkür','tesekkur','saygı','sayın','iyi günler'].filter(m => dl.includes(m)).length;
  ok(trHits >= 2, 'P4: Türkçe', `${trHits} marker`);
  ok(!d.startsWith('Dear') && !d.startsWith('Hello') && !d.startsWith('Hi '), 'P4: İngilizce değil');
}

async function testP5(td, token) {
  console.log('\n--- P5: Email Stok (FULL Mode) ---');
  const r = await draft(td.t5id, token);
  if (!r.success) { ok(false, 'P5: draft oluştu', r.error); return; }
  const d = r.draft?.generatedContent || '';
  const tools = r.toolsCalled || [];
  console.log(`   📥 "${d.substring(0, 200)}"`);
  console.log(`   🔧 [${tools.join(', ')}]`);
  ok(d.length > 0, 'P5: draft var');
  ok(tools.includes('check_stock_crm') || tools.includes('get_product_stock'), 'P5: stok tool çağrıldı', `[${tools}]`);
  const dl = d.toLowerCase();
  ok(['stok','fiyat','mevcut','349','kılıf','kilif','iphone','smoke-iph16p'].some(k => dl.includes(k)), 'P5: ürün/stok bilgisi var');
}

// ── TEARDOWN ──
async function teardown(bid) {
  console.log('\n🧹 TEARDOWN...');
  const del = model => model.deleteMany({ where: { businessId: bid } }).catch(() => {});
  await prisma.emailDraft.deleteMany({ where: { message: { thread: { businessId: bid } } } }).catch(() => {});
  await prisma.emailMessage.deleteMany({ where: { thread: { businessId: bid } } }).catch(() => {});
  for (const m of [prisma.emailThread, prisma.crmStock, prisma.crmOrder, prisma.customerData, prisma.crmWebhook, prisma.knowledgeBase, prisma.chatLog, prisma.emailIntegration, prisma.assistant]) await del(m);
  await prisma.usageRecord.deleteMany({ where: { subscription: { businessId: bid } } }).catch(() => {});
  for (const m of [prisma.subscription, prisma.user]) await del(m);
  await prisma.business.delete({ where: { id: bid } }).catch(() => {});
  console.log('🧹 DONE');
}

// ── MAIN ──
async function main() {
  console.log('🧪 SMOKE TEST: QA Problems 1-5');
  console.log('='.repeat(60));
  let td;
  try {
    td = await setup();
    await testP1(td); await wait(600);
    await testP2a(td); await wait(600);
    await testP2b(td); await wait(600);
    await testP3(td); await wait(600);

    const lr = await login(td.email, td.pw);
    if (!lr.token) { console.log(`   ⚠️  Login: ${JSON.stringify(lr).substring(0, 100)}`); ok(false, 'Login'); }
    else {
      console.log('   🔑 Login OK');
      await testP4(td, lr.token); await wait(600);
      await testP5(td, lr.token);
    }
  } catch (e) { console.error(`💥 ${e.message}\n${e.stack}`); }
  finally { if (td) await teardown(td.bid); await prisma.$disconnect(); }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 SONUÇ: ${passCount} passed, ${failCount} failed`);
  if (failures.length) { console.log('\n❌ FAILED:'); failures.forEach(f => console.log(`   - ${f.name}: ${f.detail}`)); }
  console.log('');
  process.exit(failCount > 0 ? 1 : 0);
}
main();
