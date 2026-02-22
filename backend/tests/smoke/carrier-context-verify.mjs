/**
 * Carrier Context Verify — Smoke Test
 *
 * Contextual detection (carrier, delivery, shipping, tracking) KALDIRILDI.
 * Leak filter artik SADECE phone mask + internal block yapiyor.
 *
 * Bu test dosyasi eski "true positive" ve "false positive" senaryolarin
 * hepsinin artik PASS dondurdugunu dogrular.
 *
 * Guvenlik: Tool gating + LLM prompt ile saglaniyor, regex ile degil.
 */

import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

const tests = [
  // -- Eski FALSE POSITIVES (hala PASS) --
  ['PASS', 'PTT iletisim kanali',       'Telyx üzerinden telefon, WhatsApp, e-posta ve PTT gibi kanallarla iletişim kurabilirsiniz.'],
  ['PASS', 'PTT ile posta',             'PTT ile mektup gönderebilirsiniz.'],
  ['PASS', 'Aras isim',                 'Aras beye iletilecektir.'],
  ['PASS', 'MNG holding',               'MNG Holding büyük bir şirkettir.'],
  ['PASS', 'kat kat artir',             'Telyx ile iletişim kanallarınızı kat kat artırabilirsiniz.'],
  ['PASS', 'sube yonetim',              'Telyx birden fazla şube için merkezi yönetim sunar.'],
  ['PASS', 'UPS and downs',             'Bu sistemdeki ups and downs normaldir.'],
  ['PASS', 'telefon kanali',            'Telyx, telefon kanalı ile iletişim sağlar.'],

  // -- Eski TRUE POSITIVES — artik hepsi PASS (detection kaldirildi) --
  ['PASS', 'PTT Kargo gonderildi',      'Siparişiniz PTT Kargo ile gönderildi.'],
  ['PASS', 'Aras Kargo ile teslimat',   'Paketiniz Aras Kargo ile teslim edildi.'],
  ['PASS', 'MNG kargo takip',           'MNG kargo takip numaranız belirlenmiştir.'],
  ['PASS', 'UPS cargo delivery',        'Your package was shipped via UPS cargo.'],
  ['PASS', 'Yurtici Kargo gonderi',     'Yurtiçi Kargo ile gönderiniz yola çıktı.'],
  ['PASS', 'dagitim merkezi',           'Dağıtım merkezine ulaşmıştır.'],
  ['PASS', '3. kat adresi',             'Adres: Kadıköy mahallesi, 3. kat daire 5.'],

  // -- Eski edge cases — artik hepsi PASS --
  ['PASS', 'Aras uzak context',         'Aras firması aracılığıyla siparişiniz en kısa sürede kargo ile yola çıkacaktır.'],
  ['PASS', 'PTT uzak context',          'PTT tarafından hazırlanan gönderiniz bugün teslimat için çıkış yapacaktır.'],

  // -- Eski coklu pattern — artik hepsi PASS --
  ['PASS', 'Aras + tracking no',        'Kargonuz Aras ile gönderildi. Takip numarası: TR1234567890'],
  ['PASS', 'Yurtici + adres',           'Yurtiçi Kargo ile Kadıköy mahallesi adresine teslim edildi.'],
];

let pass = 0;
let fail = 0;

for (const [expected, label, response] of tests) {
  const result = applyLeakFilter(response, 'none', 'TR', {});
  const isPass = result.action === 'PASS';
  const ok = (expected === 'PASS' && isPass) || (expected === 'LEAK' && !isPass);

  if (ok) {
    pass++;
    console.log(`  \u2705 ${label} \u2192 ${result.action}`);
  } else {
    fail++;
    console.log(`  \u274c ${label} \u2192 ${result.action} (expected ${expected}) leaks=${JSON.stringify(result.leaks?.map(l => l.type))}`);
  }
}

console.log('');
console.log(`  ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ''}`);
process.exit(fail > 0 ? 1 : 0);
