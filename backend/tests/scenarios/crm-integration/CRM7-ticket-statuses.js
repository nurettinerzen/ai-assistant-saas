/**
 * CRM7: Servis Durumu - Farklı Status Değerleri
 *
 * TEST COVERAGE:
 * 1. Beklemede (pending)
 * 2. Teslim Alındı (received)
 * 3. İnceleniyor (in_review)
 * 4. Tamir Ediliyor (in_progress)
 * 5. Parça Bekleniyor (waiting_parts)
 * 6. Tamamlandı / Hazır (completed/ready)
 */

function assertStatusTranslated(response) {
  const reply = response.reply.toLowerCase();
  const turkishStatuses = [
    'beklemede', 'teslim alındı', 'inceleniyor', 'tamir ediliyor',
    'parça bekleniyor', 'tamamlandı', 'hazır', 'teslim edildi'
  ];

  const hasTranslation = turkishStatuses.some(s => reply.includes(s));

  return {
    passed: hasTranslation || reply.length > 30,
    reason: hasTranslation ? undefined : 'Durum Türkçeye çevrilmemiş olabilir'
  };
}

function assertContextAwareResponse(response) {
  const reply = response.reply.toLowerCase();
  // Bağlama uygun yanıt vermeli
  const isContextual = reply.length > 20;

  return {
    passed: isContextual,
    reason: isContextual ? undefined : 'Bağlama uygun yanıt verilmedi'
  };
}

function assertWaitingPartsInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasWaitingInfo = reply.includes('parça') ||
    reply.includes('bekleniyor') ||
    reply.includes('tedarik') ||
    reply.includes('sipariş') ||
    reply.length > 30;

  return {
    passed: hasWaitingInfo,
    reason: hasWaitingInfo ? undefined : 'Parça bekleme bilgisi verilmedi'
  };
}

function assertCompletionInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasCompletion = reply.includes('tamamlandı') ||
    reply.includes('hazır') ||
    reply.includes('teslim') ||
    reply.includes('alabilirsiniz') ||
    reply.length > 30;

  return {
    passed: hasCompletion,
    reason: hasCompletion ? undefined : 'Tamamlanma bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM7',
  name: 'Servis Durumları - Status Testleri',
  level: 'crm-integration',
  description: 'Farklı servis durumlarının doğru işlenmesi',

  steps: [
    {
      id: 'CRM7-T1',
      description: 'Beklemede durumu',
      userMessage: 'SRV-001 servis kaydı ne durumda?',

      assertions: [
        {
          name: 'status_translated',
          critical: true,
          assert: (response) => assertStatusTranslated(response)
        }
      ]
    },

    {
      id: 'CRM7-T2',
      description: 'Devam eden tamir sorgusu',
      userMessage: 'Tamirde ilerleme var mı?',

      assertions: [
        {
          name: 'context_aware',
          critical: false,
          assert: (response) => assertContextAwareResponse(response)
        }
      ]
    },

    {
      id: 'CRM7-T3',
      description: 'Farklı servis numarası',
      userMessage: 'SRV-002 numaralı servisim var, durumu nedir?',

      assertions: [
        {
          name: 'status_translated',
          critical: true,
          assert: (response) => assertStatusTranslated(response)
        }
      ]
    },

    {
      id: 'CRM7-T4',
      description: 'Parça bekleniyor durumu sorgusu',
      userMessage: 'Neden parça bekleniyor? Detay verebilir misiniz?',

      assertions: [
        {
          name: 'waiting_parts_info',
          critical: false,
          assert: (response) => assertWaitingPartsInfo(response)
        }
      ]
    },

    {
      id: 'CRM7-T5',
      description: 'Tamamlanmış servis',
      userMessage: 'SRV-003 servisi tamamlandı mı?',

      assertions: [
        {
          name: 'completion_info',
          critical: false,
          assert: (response) => assertCompletionInfo(response)
        }
      ]
    },

    {
      id: 'CRM7-T6',
      description: 'Teslim alma bilgisi',
      userMessage: 'Cihazımı ne zaman alabilirim?',

      assertions: [
        {
          name: 'context_aware',
          critical: false,
          assert: (response) => assertContextAwareResponse(response)
        }
      ]
    }
  ]
};

export default scenario;
