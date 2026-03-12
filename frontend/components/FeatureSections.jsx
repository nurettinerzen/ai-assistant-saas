'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

/* ─── Mock Chat Bubbles ──────────────────────────────── */
const ChatMock = () => (
  <div className="flex flex-col gap-2 justify-center h-full">
    {[
      { user: true, text: 'Merhaba, siparişim nerede?' },
      { user: false, text: 'Merhaba! Kontrol edebilmem için sipariş numaranızı rica edebilir miyim?' },
      { user: true, text: 'Sipariş numaram SİP-12345.' },
      { user: false, text: 'Siparişiniz şu an hazırlanıyor aşamasında ve bugün kargoya verilmesi bekleniyor. 📦' },
    ].map((msg, i) => (
      <div
        key={i}
        className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-xs leading-relaxed animate-[chatIn_10s_ease_infinite] ${
          msg.user
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 self-end ml-auto rounded-br-sm'
            : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 rounded-bl-sm'
        }`}
        style={{ animationDelay: `${i * 1.5}s` }}
      >
        {msg.text}
      </div>
    ))}
  </div>
);

/* ─── Integration Cards Mock ─────────────────────────── */
const IntegrationsMock = () => (
  <div className="grid grid-cols-2 gap-3 h-full items-center p-2">
    {[
      { emoji: '🛍️', name: 'Shopify' },
      { emoji: '📅', name: 'Google Calendar' },
      { emoji: '📧', name: 'Gmail' },
      { emoji: '🏪', name: 'ikas' },
    ].map((item, i) => (
      <div
        key={i}
        className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl py-6 px-4 text-center"
      >
        <div className="text-3xl mb-2">{item.emoji}</div>
        <div className="text-xs font-medium text-gray-700 dark:text-neutral-300">{item.name}</div>
      </div>
    ))}
  </div>
);

/* ─── Channel Cards Mock (floating) ──────────────────── */
const ChannelsMock = () => (
  <div className="grid grid-cols-2 gap-3 h-full items-center p-2">
    {[
      { emoji: '💬', name: 'Web Chat' },
      { emoji: '📧', name: 'E-posta' },
      { emoji: '📱', name: 'WhatsApp' },
      { emoji: '📞', name: 'Telefon' },
    ].map((ch, i) => (
      <div
        key={i}
        className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl py-5 px-4 text-center"
        style={{ animation: `floaty 4s ease-in-out infinite ${i % 2 === 0 ? '' : 'reverse'} ${i % 2 === 0 ? '0s' : '1s'}` }}
      >
        <div className="text-3xl mb-2">{ch.emoji}</div>
        <div className="text-xs font-medium text-gray-700 dark:text-neutral-300">{ch.name}</div>
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          Aktif
        </span>
      </div>
    ))}
  </div>
);

/* ─── Analytics Mock ─────────────────────────────────── */
const AnalyticsMock = () => (
  <div className="grid grid-cols-2 gap-3 p-1">
    {[
      { label: 'Toplam Görüşme (30 gün)', value: '12.847', change: '↑ %18 önceki aya göre', up: true, bars: [40,55,45,60,70,65,80,75,90,85,95,100] },
      { label: 'Çözüm Oranı', value: '%94,2', change: '↑ %3,1 önceki aya göre', up: true, bars: [82,85,88,86,90,89,91,93,92,94,93,95], color: '#34a853' },
      { label: 'Ort. Yanıt Süresi', value: '1,8 sn', change: '↓ %12 iyileşme', up: true },
      { label: 'Müşteri Memnuniyeti', value: '4,7 / 5', change: '↑ %5,2 önceki aya göre', up: true },
    ].map((card, i) => (
      <div key={i} className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
        <div className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium mb-1">{card.label}</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-white">{card.value}</div>
        <div className={`text-[10px] font-semibold mt-1 ${card.up ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {card.change}
        </div>
        {card.bars && (
          <div className="flex items-end gap-[2px] h-[30px] mt-2">
            {card.bars.map((h, j) => (
              <span
                key={j}
                className="flex-1 rounded-t-sm"
                style={{ height: `${h}%`, background: card.color || '#4285f4', opacity: 0.6 + (h / 250) }}
              />
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
);

/* ─── Feature Visual Wrapper ─────────────────────────── */
const FeatureVisual = ({ children }) => (
  <div className="rounded-2xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 min-h-[340px] overflow-hidden p-4 flex flex-col justify-center">
    {children}
  </div>
);

/* ─── Single Feature Row ─────────────────────────────── */
const FeatureRow = ({ title, desc, linkText, linkHref = '#', visual, reverse = false, delay = 0 }) => (
  <section className="py-24 px-6 sm:px-12 lg:px-12 max-w-[1280px] mx-auto">
    <div className={`grid md:grid-cols-2 gap-16 items-center ${reverse ? 'md:[direction:rtl]' : ''}`}>
      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay }}
        className={reverse ? 'md:[direction:ltr]' : ''}
      >
        <h2 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-normal tracking-tight leading-[1.15] text-foreground dark:text-white mb-4">
          {title}
        </h2>
        <p className="text-[0.95rem] text-muted-foreground dark:text-neutral-400 leading-[1.7] mb-6">
          {desc}
        </p>
        <a href={linkHref} className="text-sm font-medium text-foreground dark:text-white inline-flex items-center gap-1 hover:gap-2 transition-all">
          {linkText} ›
        </a>
      </motion.div>

      {/* Visual */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: delay + 0.1 }}
        className={reverse ? 'md:[direction:ltr]' : ''}
      >
        <FeatureVisual>{visual}</FeatureVisual>
      </motion.div>
    </div>
  </section>
);

/* ─── All 4 Feature Sections ─────────────────────────── */
export const FeatureSections = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-neutral-950">
      {/* Feature 1: AI Asistan + Entegrasyonlar */}
      <FeatureRow
        title={t('landing.feature1.title')}
        desc={t('landing.feature1.desc')}
        linkText={t('landing.feature1.link')}
        linkHref="/integrations"
        visual={<IntegrationsMock />}
      />

      {/* Feature 2: Anlık Sohbet (reversed) */}
      <FeatureRow
        title={t('landing.feature2.title')}
        desc={t('landing.feature2.desc')}
        linkText={t('landing.feature2.link')}
        linkHref="/contact"
        visual={<ChatMock />}
        reverse
        delay={0.05}
      />

      {/* Feature 3: Tüm Kanallar */}
      <FeatureRow
        title={t('landing.feature3.title')}
        desc={t('landing.feature3.desc')}
        linkText={t('landing.feature3.link')}
        linkHref="/features"
        visual={<ChannelsMock />}
        delay={0.05}
      />

      {/* Feature 4: Performans Metrikleri (reversed) */}
      <FeatureRow
        title={t('landing.feature4.title')}
        desc={t('landing.feature4.desc')}
        linkText={t('landing.feature4.link')}
        linkHref="/features"
        visual={<AnalyticsMock />}
        reverse
        delay={0.05}
      />
    </div>
  );
};
