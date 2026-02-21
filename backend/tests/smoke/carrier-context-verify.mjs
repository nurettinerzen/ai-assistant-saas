import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

const tests = [
  // ── FALSE POSITIVES (PASS bekleniyor) ──────────────────────
  ['PASS', 'PTT iletisim kanali',       'Telyx üzerinden telefon, WhatsApp, e-posta ve PTT gibi kanallarla iletişim kurabilirsiniz.'],
  ['PASS', 'PTT ile posta',             'PTT ile mektup gönderebilirsiniz.'],
  ['PASS', 'Aras isim',                 'Aras beye iletilecektir.'],
  ['PASS', 'MNG holding',               'MNG Holding büyük bir şirkettir.'],
  ['PASS', 'kat kat artir',             'Telyx ile iletişim kanallarınızı kat kat artırabilirsiniz.'],
  ['PASS', 'sube yonetim',              'Telyx birden fazla şube için merkezi yönetim sunar.'],
  ['PASS', 'UPS and downs',             'Bu sistemdeki ups and downs normaldir.'],
  ['PASS', 'telefon kanali',            'Telyx, telefon kanalı ile iletişim sağlar.'],

  // ── TRUE POSITIVES (LEAK bekleniyor) ──────────────────────
  ['LEAK', 'PTT Kargo gonderildi',      'Siparişiniz PTT Kargo ile gönderildi.'],
  ['LEAK', 'Aras Kargo ile teslimat',   'Paketiniz Aras Kargo ile teslim edildi.'],
  ['LEAK', 'MNG kargo takip',           'MNG kargo takip numaranız belirlenmiştir.'],
  ['LEAK', 'UPS cargo delivery',        'Your package was shipped via UPS cargo.'],
  ['LEAK', 'Yurtici Kargo gonderi',     'Yurtiçi Kargo ile gönderiniz yola çıktı.'],
  ['LEAK', 'dagitim merkezi',           'Dağıtım merkezine ulaşmıştır.'],
  ['LEAK', '3. kat adresi',             'Adres: Kadıköy mahallesi, 3. kat daire 5.'],

  // ── EDGE CASES: ±80 char window testi ──────────────────────
  // Carrier ve context keyword arası 30+ char ama 80'den az
  ['LEAK', 'Aras uzak context',         'Aras firması aracılığıyla siparişiniz en kısa sürede kargo ile yola çıkacaktır.'],
  ['LEAK', 'PTT uzak context',          'PTT tarafından hazırlanan gönderiniz bugün teslimat için çıkış yapacaktır.'],
  // Carrier ve context keyword arası 80+ char → kaçabilir, bu OK (false negative kabul edilebilir)
  // Ama tracking pattern hâlâ yakalarsa o da OK

  // ── ÇOKLU PATTERN: carrier + tracking birlikte ─────────────
  ['LEAK', 'Aras + tracking no',        'Kargonuz Aras ile gönderildi. Takip numarası: TR1234567890'],
  ['LEAK', 'Yurtici + adres',           'Yurtiçi Kargo ile Kadıköy mahallesi adresine teslim edildi.'],
];

let pass = 0;
let fail = 0;

for (const [expected, label, response] of tests) {
  const result = applyLeakFilter(response, 'none', 'TR', {});
  const isPass = result.action === 'PASS';
  const ok = (expected === 'PASS' && isPass) || (expected === 'LEAK' && !isPass);

  if (ok) {
    pass++;
    console.log(`  ✅ ${label} → ${result.action}`);
  } else {
    fail++;
    console.log(`  ❌ ${label} → ${result.action} (expected ${expected}) leaks=${JSON.stringify(result.leaks?.map(l => l.type))}`);
  }
}

console.log('');
console.log(`  ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ''}`);
process.exit(fail > 0 ? 1 : 0);
