'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Bot, MessageSquare, BarChart3, Settings, Puzzle,
} from 'lucide-react';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Genel Bakış', active: true },
  { icon: Bot, label: 'Asistanlar' },
  { icon: MessageSquare, label: 'Görüşmeler' },
  { icon: BarChart3, label: 'Analitik' },
  { icon: Settings, label: 'Ayarlar' },
  { icon: Puzzle, label: 'Entegrasyonlar' },
];

const stats = [
  { value: '1.247', label: 'Bugünkü Görüşme', color: '#4285f4' },
  { value: '%94,2', label: 'Çözüm Oranı', color: '#34a853' },
  { value: '1,8s', label: 'Ort. Yanıt Süresi', color: '#fbbc04' },
  { value: '4,7/5', label: 'Müşteri Memnuniyeti', color: '#ea4335' },
];

export const DashboardPreview = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const slides = [
    <div key={0} className="grid grid-cols-2 gap-2">
      <SlideCell value="847" label="Aktif Görüşme" color="#4285f4" barWidth="72%" />
      <SlideCell value="%96" label="Memnuniyet" color="#34a853" barWidth="96%" />
      <SlideCell value="12" label="Bekleyen İade" color="#fbbc04" barWidth="24%" />
      <SlideCell value="3" label="Eskalasyon" color="#ea4335" barWidth="8%" />
    </div>,
    <div key={1} className="grid grid-cols-2 gap-2">
      <SlideCell value="💬 %42" label="Web Chat" color="#4285f4" barWidth="42%" />
      <SlideCell value="📱 %31" label="WhatsApp" color="#34a853" barWidth="31%" />
      <SlideCell value="📧 %18" label="E-posta" color="#fbbc04" barWidth="18%" />
      <SlideCell value="📞 %9" label="Telefon" color="#ea4335" barWidth="9%" />
    </div>,
    <div key={2} className="grid grid-cols-3 gap-2">
      <div className="col-span-2 bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
        <div className="text-sm font-semibold mb-0.5" style={{ color: '#34a853' }}>↑ %18</div>
        <div className="text-[0.6rem] text-white/35">Haftalık Büyüme</div>
        <div className="flex items-end gap-[3px] h-10 mt-2">
          {[40, 55, 48, 65, 72, 60, 85].map((h, i) => (
            <span key={i} className="flex-1 rounded-t-sm" style={{
              height: `${h}%`,
              background: i >= 3 ? '#34a853' : '#4285f4',
              opacity: i < 3 ? 0.6 : i < 6 ? 0.8 : 1,
            }} />
          ))}
        </div>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
        <div className="text-sm font-semibold" style={{ color: '#8ab4f8' }}>1,8s</div>
        <div className="text-[0.6rem] text-white/35">Ort. Yanıt</div>
        <div className="mt-2.5 text-[0.55rem] text-white/25">↓ %12 iyileşme</div>
      </div>
    </div>,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.8 }}
      className="w-full max-w-[1000px] mx-auto mt-16 rounded-2xl bg-[#0c0c0f] border border-white/[0.08] overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.04] border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 text-center text-[0.7rem] text-white/30 font-mono">
          Telyx.ai — Kontrol Paneli
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] min-h-[340px] max-lg:grid-cols-1">
        {/* Sidebar */}
        <div className="p-4 border-r border-white/[0.06] flex flex-col gap-1 max-lg:hidden">
          {sidebarItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[0.7rem] transition-colors ${
                  item.active
                    ? 'bg-blue-500/10 text-[#8ab4f8]'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.05]">
                <div className="text-lg font-semibold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-[0.6rem] text-white/35 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="relative flex-1 min-h-[160px] rounded-xl overflow-hidden">
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`absolute inset-0 p-4 transition-all duration-700 ${
                  i === currentSlide
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-95 pointer-events-none'
                }`}
              >
                {slide}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function SlideCell({ value, label, color, barWidth }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
      <div className="text-sm font-semibold text-white mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[0.6rem] text-white/35">{label}</div>
      {barWidth && (
        <div className="h-1 rounded-full mt-1.5" style={{ width: barWidth, background: color }} />
      )}
    </div>
  );
}
