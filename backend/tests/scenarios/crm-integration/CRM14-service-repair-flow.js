/**
 * CRM14: Servis/Tamir Tam Akış
 *
 * TEST COVERAGE:
 * 1. Servis kaydı oluşturma talebi
 * 2. Mevcut servis durumu
 * 3. Parça değişimi bilgisi
 * 4. Garanti kontrolü
 * 5. Tamir süresi tahmin
 */

function assertServiceInfoProvided(response) {
  const reply = response.reply.toLowerCase();
  const hasInfo = reply.includes('servis') ||
    reply.includes('tamir') ||
    reply.includes('onarım') ||
    reply.includes('arıza') ||
    reply.includes('durum') ||
    reply.length > 30;

  return {
    passed: hasInfo,
    reason: hasInfo ? undefined : 'Servis bilgisi verilmedi'
  };
}

function assertWarrantyMentioned(response) {
  const reply = response.reply.toLowerCase();
  const hasWarranty = reply.includes('garanti') ||
    reply.includes('güvence') ||
    reply.includes('ücretsiz') ||
    reply.includes('ücret') ||
    reply.length > 50;

  return {
    passed: hasWarranty,
    reason: hasWarranty ? undefined : 'Garanti bilgisi belirtilmedi'
  };
}

function assertTimeEstimate(response) {
  const reply = response.reply.toLowerCase();
  const hasEstimate = reply.includes('gün') ||
    reply.includes('hafta') ||
    reply.includes('süre') ||
    reply.includes('tahmini') ||
    reply.includes('yaklaşık') ||
    /\d+\s*(gün|hafta|saat)/.test(reply) ||
    reply.length > 50;

  return {
    passed: hasEstimate,
    reason: hasEstimate ? undefined : 'Süre tahmini verilmedi'
  };
}

function assertCostEstimate(response) {
  const reply = response.reply.toLowerCase();
  const hasCost = reply.includes('ücret') ||
    reply.includes('maliyet') ||
    reply.includes('fiyat') ||
    reply.includes('tl') ||
    reply.includes('₺') ||
    reply.includes('ücretsiz') ||
    reply.length > 50;

  return {
    passed: hasCost,
    reason: hasCost ? undefined : 'Ücret bilgisi verilmedi'
  };
}

function assertPartsInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasPartsInfo = reply.includes('parça') ||
    reply.includes('değişim') ||
    reply.includes('yedek') ||
    reply.includes('bekleniyor') ||
    reply.length > 50;

  return {
    passed: hasPartsInfo,
    reason: hasPartsInfo ? undefined : 'Parça bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM14',
  name: 'Servis/Tamir Tam Akış',
  level: 'crm-integration',
  description: 'Servis kaydı ve tamir süreç akışları',

  steps: [
    {
      id: 'CRM14-T1',
      description: 'Servis durumu sorgusu',
      userMessage: 'SRV-001 numaralı servis kaydım var, ne durumda?',

      assertions: [
        {
          name: 'service_info_provided',
          critical: true,
          assert: (response) => assertServiceInfoProvided(response)
        }
      ]
    },

    {
      id: 'CRM14-T2',
      description: 'Garanti durumu sorgusu',
      userMessage: 'Garanti kapsamında mı bu tamir?',

      assertions: [
        {
          name: 'warranty_mentioned',
          critical: false,
          assert: (response) => assertWarrantyMentioned(response)
        }
      ]
    },

    {
      id: 'CRM14-T3',
      description: 'Tamir süresi sorgusu',
      userMessage: 'Ne kadar sürer tamir?',

      assertions: [
        {
          name: 'time_estimate',
          critical: false,
          assert: (response) => assertTimeEstimate(response)
        }
      ]
    },

    {
      id: 'CRM14-T4',
      description: 'Maliyet sorgusu',
      userMessage: 'Tamir ücreti ne kadar olur?',

      assertions: [
        {
          name: 'cost_estimate',
          critical: false,
          assert: (response) => assertCostEstimate(response)
        }
      ]
    },

    {
      id: 'CRM14-T5',
      description: 'Parça değişimi sorgusu',
      userMessage: 'Parça değişimi gerekiyor mu?',

      assertions: [
        {
          name: 'parts_info',
          critical: false,
          assert: (response) => assertPartsInfo(response)
        }
      ]
    },

    {
      id: 'CRM14-T6',
      description: 'Teslim alma bilgisi',
      userMessage: 'Cihazımı nereden ve ne zaman alabilirim?',

      assertions: [
        {
          name: 'service_info_provided',
          critical: false,
          assert: (response) => assertServiceInfoProvided(response)
        }
      ]
    }
  ]
};

export default scenario;
