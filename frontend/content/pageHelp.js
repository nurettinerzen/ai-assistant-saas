/**
 * Central registry for dashboard page help content.
 * Single source of truth for subtitle + tooltip copy.
 */

const PAGE_HELP = {
  tr: {
    guides: {
      title: 'Rehber',
      subtitle: 'Panelin nasıl çalıştığını, hangi sayfada ne yapmanız gerektiğini ve 5 dakikalık kurulum akışını buradan takip edin.',
      tooltipTitle: 'Bu rehberi nasıl kullanmalıyım?',
      tooltipBody: [
        'Bu sayfa, paneldeki ana modüllerin ne işe yaradığını hızlıca anlamanız için özet bir başlangıç dokümanıdır.',
        'Her bölümde önce "ne işe yarar", sonra "ilk ne yapmalıyım" yaklaşımıyla ilerleyin.',
        'Kilitli bir özellik görürseniz önce Abonelik sayfasından plan ve entitlement durumunu kontrol edin.'
      ],
      quickSteps: [
        'Kanalları ve kullanım amacınızı netleştirin.',
        'Bilgi Bankası + Özel Veriler ile içerik tabanını hazırlayın.',
        'Kampanya veya widget gibi canlı akışları devreye alın.'
      ]
    },
    assistants: {
      title: 'AI Asistanlar',
      subtitle: 'İşletmeniz için AI asistanlarını burada oluşturur, davranışını ayarlar ve canlıya hazırlarsınız. İlk kurulum için en az bir giden arama (outbound) asistanı açın.',
      tooltipTitle: 'AI Asistanlar sayfası',
      tooltipBody: [
        'Asistan adı, dil, ses, greeting ve talimatları tek yerden yönetirsiniz.',
        'Kampanyalar sayfası sadece burada tanımlı giden arama (outbound) asistanlarını kullanır.',
        'Bilgi Bankası ve Özel Veriler içeriği, konuşma sırasında asistanın referans alacağı temel kaynaktır.',
        'V1 notu: Gelen arama (inbound) akışları hesap/plan durumuna göre kapalı olabilir.',
        'Yayına almadan önce kısa bir test çağrısı ile prompt ve karşılama metnini doğrulayın.'
      ],
      quickSteps: [
        'Yeni asistan oluşturun ve amacını seçin.',
        'Ses, dil ve talimatları netleştirin.',
        'Test edip kampanyada kullanın.'
      ]
    },
    knowledgeBase: {
      title: 'Bilgi Bankası',
      subtitle: 'Asistanın doğru yanıt vermesi için doküman ve SSS içeriklerini bu sayfada toplarsınız. İçerik kalitesi arttıkça yanıt doğruluğu da artar.',
      tooltipTitle: 'Bilgi Bankası sayfası',
      tooltipBody: [
        'PDF, metin ve benzeri dokümanları yükleyerek asistanın cevap tabanını oluşturursunuz.',
        'Sık sorulan sorular (SSS) alanı hızlı ve tutarlı yanıt üretimi için etkilidir.',
        'Yüklenen içerik önce işlenir; durum "hazır" olmadan üretimde beklenen sonuç alınmayabilir.',
        'Kopya veya çelişkili içeriklerden kaçının; kısa ve güncel metinler daha iyi sonuç verir.'
      ],
      quickSteps: [
        'Temel dokümanları yükleyin.',
        'En kritik 10-20 SSS kaydını ekleyin.',
        'Yanlış yanıt gördükçe içeriği güncelleyin.'
      ]
    },
    customerData: {
      title: 'Özel Veriler',
      subtitle: 'Müşteriye özel kayıtları (sipariş, randevu, borç, servis vb.) yükleyerek görüşmeleri kişiselleştirirsiniz. Asistan, konuşma sırasında doğru kişiye doğru veriyi kullanır.',
      tooltipTitle: 'Özel Veriler sayfası',
      tooltipBody: [
        'Excel/CSV ile müşteri bazlı veri yükleyebilir ve gerektiğinde güncelleyebilirsiniz.',
        'Veri tipi seçimi (sipariş, randevu, muhasebe vb.) asistanın yanıt bağlamını iyileştirir.',
        'Kişisel veri içerdiği için sadece gerekli alanları yükleyin; gereksiz hassas verileri eklemeyin.',
        'Veri güncelliğini koruyun; eski kayıtlar yanlış yönlendirme ve memnuniyetsizlik yaratır.'
      ],
      quickSteps: [
        'Şablonu indirip dosyayı doğru formatta hazırlayın.',
        'Dosyayı yükleyip örnek kayıtları kontrol edin.',
        'Eski kayıtları periyodik olarak güncelleyin.'
      ]
    },
    campaigns: {
      title: 'Kampanyalar',
      subtitle: 'Toplu giden arama (outbound) kampanyalarını burada başlatır, izler ve sonuçlandırırsınız. Dosya yükleyip asistan ve hat seçerek aramaları otomatik dağıtırsınız.',
      tooltipTitle: 'Kampanyalar sayfası',
      tooltipBody: [
        'Kampanya çalıştırmak için en az bir outbound asistan ve kullanılabilir telefon numarası gerekir.',
        'CSV/XLSX yüklerken telefon kolonu eşlemesini doğru yapmak başarım için kritiktir.',
        'V1 notu: Gelen arama (inbound) akışları kapalı olabilir; kampanya modülü outbound odaklıdır.',
        'Neden kilitli? Plan/entitlement izinleri kampanya erişimini kapatmış olabilir; Abonelik sayfasından kontrol edin.',
        'Çalışan kampanyalarda ilerleme, durum ve hata kayıtlarını bu ekrandan izleyip yönetirsiniz.'
      ],
      quickSteps: [
        'Outbound asistanı seçin.',
        'Müşteri listesini yükleyip kolonları eşleyin.',
        'Kampanyayı başlatıp sonuçları takip edin.'
      ]
    },
    integrations: {
      title: 'Entegrasyonlar',
      subtitle: 'Shopify, ikas, CRM, WhatsApp, e-posta ve diğer servisleri bağlayarak AI yanıtlarını gerçek sistem verileriyle zenginleştirirsiniz.',
      tooltipTitle: 'Entegrasyonlar sayfası',
      tooltipBody: [
        'Bağlanan sistemler sipariş, müşteri ve operasyon verilerini asistana taşıyarak daha isabetli yanıt sağlar.',
        'Her entegrasyon için bağlantı, test ve bağlantı kesme akışlarını bu ekrandan yönetirsiniz.',
        'Bazı entegrasyonlar plana göre kilitli olabilir; kilitli kartlarda yükseltme bilgisi gösterilir.',
        'Canlıya almadan önce test adımını çalıştırarak kimlik bilgilerini doğrulayın.'
      ],
      quickSteps: [
        'Önce kritik iş sistemlerini bağlayın.',
        'Bağlantıyı test edip veri akışını doğrulayın.',
        'Hatalı entegrasyonları yenileyip tekrar test edin.'
      ]
    },
    phoneNumbers: {
      title: 'Telefon Numaraları',
      subtitle: 'Asistanın arama yapacağı veya arama alacağı numaraları bu sayfada yönetirsiniz. Numara kapasitesi ve kullanım limitleri de burada takip edilir.',
      tooltipTitle: 'Telefon Numaraları sayfası',
      tooltipBody: [
        'Numara ekleme, kaldırma ve aktif kullanım durumlarını tek ekranda yönetirsiniz.',
        'Kampanya başlatmadan önce numaranın doğru hat/profil ile bağlı olduğunu doğrulayın.',
        'Plan limitleri (numara adedi, dakika vb.) sayfa üzerinde görünür ve aşımları etkiler.',
        'Neden kilitli? Outbound entitlement kapalıysa bu sayfa sınırlı görünür; Abonelik bölümünden neden kodunu kontrol edin.'
      ],
      quickSteps: [
        'Yeni numara ekleyin veya mevcut numarayı bağlayın.',
        'Asistan/kampanya ile eşleşmesini doğrulayın.',
        'Limit ve kullanım bilgisini düzenli kontrol edin.'
      ]
    },
    subscription: {
      title: 'Abonelik',
      subtitle: 'Planınızı, haklarınızı (entitlements) ve kullanım limitlerinizi bu sayfada görür; ihtiyaç halinde yükseltme veya düşürme yaparsınız.',
      tooltipTitle: 'Abonelik sayfası',
      tooltipBody: [
        'Mevcut plan, dönemsel ücret ve kullanım metrikleri bu sayfada özetlenir.',
        'Inbound/outbound gibi kanal yetkileri entitlement durumuna göre burada net görünür.',
        'Kampanya, telefon ve bazı entegrasyon kilitleri çoğunlukla plan/entitlement kaynaklıdır.',
        'Plan değişikliği öncesi fiyat, limit ve geçiş tarihini kontrol ederek ilerleyin.'
      ],
      quickSteps: [
        'Mevcut plan ve limitleri gözden geçirin.',
        'Kilitli özelliklerin nedenini entitlement alanında kontrol edin.',
        'İhtiyaca göre plan yükseltme/düşürme yapın.'
      ]
    },
    settings: {
      title: 'Ayarlar',
      subtitle: 'Hesap, işletme, bölge, bildirim ve güvenlik tercihlerini bu sayfada yönetirsiniz. Dil ve bölge seçimleri panel davranışını doğrudan etkiler.',
      tooltipTitle: 'Ayarlar sayfası',
      tooltipBody: [
        'Profil bilgileri, bildirim tercihleri ve güvenlik ayarları merkezi olarak yönetilir.',
        'Dil, ülke ve saat dilimi gibi alanlar raporlama ve otomasyon davranışını etkiler.',
        'Yetki düzeyine göre bazı ayarlar sadece belirli kullanıcılara açık olabilir.',
        'Değişiklik sonrası kritik akışları (kampanya, bildirim, e-posta) hızlıca test edin.'
      ],
      quickSteps: [
        'Profil ve işletme bilgilerini güncelleyin.',
        'Dil/bölge/saat dilimini doğru seçin.',
        'Bildirim ve güvenlik ayarlarını doğrulayın.'
      ]
    },
    chatWidget: {
      title: 'Chat Widget',
      subtitle: 'Web sitenize ekleyeceğiniz chat widget\'ını burada yapılandırır, önizler ve embed kodunu alırsınız. Canlıya almadan önce test etmek kritik önem taşır.',
      tooltipTitle: 'Chat Widget sayfası',
      tooltipBody: [
        'Widget görünümü, konumu, karşılama metni ve asistan seçimi bu ekrandan yönetilir.',
        'Embed kodunu web sitenize ekleyerek ziyaretçilerin AI ile anlık yazışmasını başlatırsınız.',
        'Plan seviyesine göre branding veya gelişmiş ayarlar kısıtlı olabilir.',
        'Canlıya almadan önce önizleme ve gerçek sitede test yaparak metin/renk uyumunu doğrulayın.'
      ],
      quickSteps: [
        'Widget\'ı etkinleştirin ve asistan seçin.',
        'Metin, renk ve konumu düzenleyin.',
        'Embed kodunu kopyalayıp sitede test edin.'
      ]
    },
    adminUserDetail: {
      title: 'Admin Kullanıcı Detayı',
      subtitle: 'Seçilen kullanıcıyı operasyonel olarak buradan yönetirsiniz: plan, limit, erişim ve hesap durumu tek ekrandadır.',
      tooltipTitle: 'Admin kullanıcı detayı',
      tooltipBody: [
        'Kullanıcı planı, kullanım metrikleri ve işletme bilgileri birlikte görüntülenir.',
        'Dondurma, yeniden aktifleştirme, şifre sıfırlama gibi kritik işlemler bu sayfadadır.',
        'Bu işlemler canlı sistemi etkiler; değişiklik öncesi kullanıcı talebini doğruladığınızdan emin olun.',
        'Plan/entitlement değişiklikleri sonrasında kullanıcı akışını kısa bir kontrolle test edin.'
      ],
      quickSteps: [
        'Kullanıcı durumunu ve mevcut planı kontrol edin.',
        'Gerekiyorsa düzenleme/suspend işlemini uygulayın.',
        'İşlem sonrası etkileri hızlıca doğrulayın.'
      ]
    }
  },
  en: {
    guides: {
      title: 'Guide',
      subtitle: 'Use this page as your quick start map: what each dashboard module does and what to configure first.',
      tooltipTitle: 'How to use this guide',
      tooltipBody: [
        'This is a single onboarding page for first-time dashboard users.',
        'Each section explains purpose, first action, and common caveats.',
        'If a feature is locked, check Subscription and entitlements first.'
      ],
      quickSteps: [
        'Define your active channels.',
        'Prepare Knowledge Base and Custom Data.',
        'Launch campaigns or website widget.'
      ]
    },
    assistants: {
      title: 'AI Assistants',
      subtitle: 'Create and configure your AI assistants here. Start with at least one outbound assistant for campaign flows.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Manage assistant name, language, voice, greeting, and instructions.',
        'Campaigns use outbound assistants from this list.',
        'Knowledge Base and Custom Data improve response quality.',
        'V1 note: inbound call flows may be disabled depending on plan/entitlements.'
      ],
      quickSteps: [
        'Create assistant.',
        'Set voice and instructions.',
        'Run a quick test call.'
      ]
    },
    knowledgeBase: {
      title: 'Knowledge Base',
      subtitle: 'Upload documents and FAQs to build the assistant\'s answer foundation.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Use this page for reusable business knowledge.',
        'Keep content short, current, and non-conflicting.',
        'Wait for processing status before expecting stable outputs.'
      ],
      quickSteps: [
        'Upload core documents.',
        'Add top FAQs.',
        'Iterate based on wrong answers.'
      ]
    },
    customerData: {
      title: 'Custom Data',
      subtitle: 'Upload customer-level records to personalize responses during calls and chats.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Use CSV/XLSX records for customer-specific context.',
        'Choose the right data type for better interpretation.',
        'Apply data minimization and keep records fresh.'
      ],
      quickSteps: [
        'Prepare file template.',
        'Upload and verify sample rows.',
        'Refresh outdated data.'
      ]
    },
    campaigns: {
      title: 'Campaigns',
      subtitle: 'Launch and monitor batch outbound calling campaigns from one screen.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Requires outbound assistant + available phone number.',
        'Column mapping quality directly affects call performance.',
        'V1 is outbound-focused; inbound can be disabled.',
        'If locked, check plan and entitlements in Subscription.'
      ],
      quickSteps: [
        'Select outbound assistant.',
        'Upload and map list.',
        'Launch and monitor progress.'
      ]
    },
    integrations: {
      title: 'Integrations',
      subtitle: 'Connect your operational tools so the assistant can answer with live system data.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Manage connect, test, and disconnect actions here.',
        'Some integrations are plan-gated.',
        'Always run tests before production use.'
      ],
      quickSteps: [
        'Connect critical systems first.',
        'Run integration tests.',
        'Fix and retest failures.'
      ]
    },
    phoneNumbers: {
      title: 'Phone Numbers',
      subtitle: 'Manage call-capable numbers, assignments, and limit usage from this page.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Add/remove numbers and verify assignment.',
        'Track number and minute limits.',
        'If locked, outbound entitlements are likely disabled.'
      ],
      quickSteps: [
        'Add or connect number.',
        'Verify routing.',
        'Check usage limits.'
      ]
    },
    subscription: {
      title: 'Subscription',
      subtitle: 'Review your plan, entitlements, and usage limits; upgrade or downgrade as needed.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Plan details and usage metrics are summarized here.',
        'Feature locks are usually tied to entitlements.',
        'Check effective dates before plan changes.'
      ],
      quickSteps: [
        'Review plan and limits.',
        'Check lock reasons.',
        'Apply needed plan change.'
      ]
    },
    settings: {
      title: 'Settings',
      subtitle: 'Manage account, business, region, notifications, and security preferences.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Regional settings affect platform behavior.',
        'Some settings are role-based.',
        'Validate key flows after saving changes.'
      ],
      quickSteps: [
        'Update profile/business info.',
        'Set locale/timezone correctly.',
        'Confirm notifications/security.'
      ]
    },
    chatWidget: {
      title: 'Chat Widget',
      subtitle: 'Configure your website widget, preview it, and copy embed code for deployment.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Adjust widget style, position, and assistant mapping.',
        'Copy embed code and place it on your site.',
        'Run both preview and live-site tests.'
      ],
      quickSteps: [
        'Enable widget and pick assistant.',
        'Tune text and styling.',
        'Embed and test on site.'
      ]
    },
    adminUserDetail: {
      title: 'Admin User Detail',
      subtitle: 'Manage the selected user\'s plan, access state, and operational settings from one page.',
      tooltipTitle: 'About this page',
      tooltipBody: [
        'Review plan, usage, and business context together.',
        'Suspend/reactivate/reset actions are high-impact.',
        'Validate production impact after each change.'
      ],
      quickSteps: [
        'Review status and plan.',
        'Apply required action.',
        'Confirm results.'
      ]
    }
  }
};

const normalizeLocale = (locale) => (locale === 'tr' ? 'tr' : 'en');

export const getPageHelp = (pageKey, locale = 'tr') => {
  if (!pageKey) return null;

  const normalizedLocale = normalizeLocale(locale);
  return PAGE_HELP[normalizedLocale]?.[pageKey] || PAGE_HELP.tr?.[pageKey] || null;
};

export { PAGE_HELP };
