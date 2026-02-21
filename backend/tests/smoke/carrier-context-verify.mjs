import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

const tests = [
  // FALSE POSITIVE OLMAMALI (PASS bekleniyor)
  ['PASS', 'PTT iletisim kanali',       'Telyx üzerinden telefon, WhatsApp, e-posta ve PTT gibi kanallarla iletişim kurabilirsiniz.'],
  ['PASS', 'PTT ile posta',             'PTT ile mektup gönderebilirsiniz.'],
  ['PASS', 'Aras isim',                 'Aras beye iletilecektir.'],
  ['PASS', 'MNG holding',               'MNG Holding büyük bir şirkettir.'],
  ['PASS', 'kat kat artir',             'Telyx ile iletişim kanallarınızı kat kat artırabilirsiniz.'],
  ['PASS', 'sube yonetim',              'Telyx birden fazla şube için merkezi yönetim sunar.'],
  ['PASS', 'UPS kelimesi',              'Bu sistemdeki ups and downs normaldir.'],
  ['PASS', 'telefon kanali',            'Telyx, telefon kanalı ile iletişim sağlar.'],

  // LEAK OLMALI (SANITIZE veya BLOCK bekleniyor)
  ['LEAK', 'PTT Kargo gonderildi',      'Siparişiniz PTT Kargo ile gönderildi.'],
  ['LEAK', 'Aras Kargo ile teslimat',   'Paketiniz Aras Kargo ile teslim edildi.'],
  ['LEAK', 'MNG kargo takip',           'MNG kargo takip numaranız belirlenmiştir.'],
  ['LEAK', 'UPS cargo delivery',        'Your package was shipped via UPS cargo.'],
  ['LEAK', 'Yurtici Kargo gonderi',     'Yurtiçi Kargo ile gönderiniz yola çıktı.'],
  ['LEAK', 'dagitim merkezi',           'Dağıtım merkezine ulaşmıştır.'],
  ['LEAK', '3. kat adresi',             'Adres: Kadıköy mahallesi, 3. kat daire 5.'],
];

let pass = 0;
let fail = 0;

for (const [expected, label, response] of tests) {
  const result = applyLeakFilter(response, 'none', 'TR', {});
  const isPass = result.action === 'PASS';
  const ok = (expected === 'PASS' && isPass) || (expected === 'LEAK' && !isPass);

  if (ok) {
    pass++;
    console.log('✅', label, '→', result.action);
  } else {
    fail++;
    console.log('❌', label, '→', result.action, '(expected', expected + ')', JSON.stringify(result.leaks?.map(l => l.type)));
  }
}

console.log('---');
console.log(pass + '/' + (pass + fail) + ' passed', fail > 0 ? '(' + fail + ' FAILED)' : '');
