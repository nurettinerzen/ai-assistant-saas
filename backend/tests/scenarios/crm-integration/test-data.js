/**
 * CRM Test Data - Gerçek Production Verileri
 *
 * Business 1 (nurettinerzen@gmail.com) için mevcut CRM verileri
 * Bu veriler otomatik olarak production'dan çekilmiştir
 */

// Farklı durumlardaki sipariş örnekleri
// UPDATED: 2026-02-02 - Gerçek CRM verileriyle eşleşecek şekilde güncellendi
export const TEST_ORDERS = {
  // Kargoda olan sipariş (GERÇEK VERİ)
  KARGODA: {
    orderNumber: 'ORD-202625502',
    customerPhone: '5328274926',
    customerName: 'Filiz Kaplan',
    status: 'kargoda',
    trackingNumber: 'TRK143588',
    carrier: 'Sürat Kargo'
  },

  // Onaylandı durumunda (GERÇEK VERİ)
  HAZIRLANIYOR: {
    orderNumber: 'ORD-202672450',
    customerPhone: '5411858927',
    customerName: 'Ali Şahin',
    status: 'onaylandı',
    trackingNumber: 'SHP100788',
    carrier: 'Yurtiçi Kargo'
  },

  // Beklemede durumunda
  BEKLEMEDE: {
    orderNumber: 'ORD-202698484',
    customerPhone: '5357995038',
    customerName: 'Ebru Kurt',
    status: 'beklemede',
    trackingNumber: 'SHP261487',
    carrier: 'MNG Kargo'
  },

  // Dağıtımda (out for delivery)
  DAGITIMDA: {
    orderNumber: 'ORD-202656098',
    customerPhone: '5473702902',
    customerName: 'Zeynep Öztürk',
    status: 'dağıtımda',
    trackingNumber: 'SHP222191',
    carrier: 'Aras Kargo'
  },

  // Teslim edildi
  TESLIM_EDILDI: {
    orderNumber: 'ORD-202647014',
    customerPhone: '5311378769',
    customerName: 'Mustafa Arslan',
    status: 'teslim edildi',
    trackingNumber: 'SHP601256',
    carrier: 'UPS Kargo'
  },

  // Onaylandı
  ONAYLANDI: {
    orderNumber: 'ORD-202632263',
    customerPhone: '5344021268',
    customerName: 'Burak Acar',
    status: 'onaylandı',
    trackingNumber: 'TRK543140',
    carrier: 'DHL Express'
  }
};

// Birden fazla siparişi olan müşteriler
export const MULTI_ORDER_CUSTOMERS = {
  ALI_SAHIN: {
    name: 'Ali Şahin',
    phone: '5411858927',
    orders: ['ORD-202672450', 'ORD-202676315']
  },
  GIZEM_AKSOY: {
    name: 'Gizem Aksoy',
    phone: '5307432368',
    orders: ['ORD-202697621', 'ORD-202646960']
  },
  EBRU_KURT: {
    name: 'Ebru Kurt',
    phone: '5357995038',
    orders: ['ORD-202698484', 'ORD-202615745']
  }
};

// Telefon formatları test için (Filiz Kaplan'ın numarası)
export const PHONE_FORMATS = {
  // Aynı numara farklı formatlar
  BASE: '5328274926',
  WITH_ZERO: '05328274926',
  WITH_PLUS90: '+905328274926',
  WITH_SPACES: '0532 827 49 26',
  WITH_DASHES: '0532-827-49-26',
  WITH_PARENS: '(0532) 827 49 26'
};

// Var olmayan test verileri (not found senaryoları için)
export const INVALID_DATA = {
  ORDER_NUMBER: 'ORD-999999999',
  PHONE: '5001112233',
  TICKET_NUMBER: 'SRV-999999'
};

// Farklı kargo firmaları
export const CARRIERS = [
  'Yurtiçi Kargo',
  'Aras Kargo',
  'MNG Kargo',
  'PTT Kargo',
  'UPS Kargo',
  'DHL Express',
  'Fedex',
  'Sürat Kargo'
];

// Sipariş durumları (Türkçe)
export const ORDER_STATUSES = {
  BEKLEMEDE: 'beklemede',
  ONAYLANDI: 'onaylandı',
  HAZIRLANIYOR: 'hazırlanıyor',
  KARGODA: 'kargoda',
  DAGITIMDA: 'dağıtımda',
  TESLIM_EDILDI: 'teslim edildi'
};

export default {
  TEST_ORDERS,
  MULTI_ORDER_CUSTOMERS,
  PHONE_FORMATS,
  INVALID_DATA,
  CARRIERS,
  ORDER_STATUSES
};
