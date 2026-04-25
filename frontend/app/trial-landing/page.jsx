'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  ArrowRight,
  Phone,
  MessageCircle,
  Mail,
  Sparkles,
  ShieldCheck,
  Zap,
  Headphones,
  Sun,
  Moon,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TelyxLogoFull } from '@/components/TelyxLogo';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PAINS = [
  {
    icon: Headphones,
    title: 'Mesai biter, mesajlar bitmez',
    body: 'Akşam beşten sonra gelen sorular sabah ekibiniz açılana kadar sahipsiz kalıyor. Ve müşterileriniz beklemeyi sevmiyor.',
  },
  {
    icon: MessageCircle,
    title: 'Dört kanal, dört ayrı ekran',
    body: 'Telefon, WhatsApp, e-posta, web chat — her biri ayrı bir araç. Ekibiniz tek bir müşteriyi dört farklı yerde takip ediyor.',
  },
  {
    icon: Phone,
    title: 'Aynı sorular, tükenen ekip',
    body: 'Destek ekibinizin enerjisi yıllardır tekrar eden sorularla harcanıyor. Onlar aslında çok daha değerli işlere ayrılmalı.',
  },
];

const CHANNELS = [
  {
    icon: Phone,
    title: 'Telefon',
    body: 'Gelen aramaları karşılar, geri arama talebi oluşturur; randevu ve hatırlatma için dışarı arama yapar.',
  },
  {
    icon: WhatsAppIcon,
    title: 'WhatsApp',
    body: 'Sipariş takibi, bilgilendirme ve canlı destek devri — saniyeler içinde, müşteri verinizle kişiselleşmiş.',
  },
  {
    icon: MessageCircle,
    title: 'Web Chat',
    body: 'Sitenize tek satır kodla entegre olur; ziyaretçilerinizi akıllı sohbetle müşteriye dönüştürür.',
  },
  {
    icon: Mail,
    title: 'E-posta',
    body: 'Otomatik taslak, akıllı sınıflandırma ve hızlı onay akışıyla gelen kutunuzdaki yükü hafifletir.',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Hesabınızı açın',
    body: 'E-posta ile saniyeler içinde kaydolun. Kredi kartı, demo görüşmesi ya da satış araması gerekmiyor.',
  },
  {
    n: '2',
    title: 'Verinizi ve kanalınızı bağlayın',
    body: 'CRM, Shopify, Trendyol ya da Hepsiburada — entegrasyonlar tek tıkla, dakikalar içinde devrede.',
  },
  {
    n: '3',
    title: 'AI çalışmaya başlasın',
    body: 'Asistanınız işletmenizi öğrenir, ilk müşteri talebini dakikalar içinde karşılar — her kanaldan.',
  },
];

const BULLETS = [
  '7/24 yanıt verir; gece, hafta sonu, tatil fark etmez.',
  'Türkçe doğal konuşma; aksana ve diyaloğa hâkim.',
  'CRM, e-ticaret ve takvim verinizle cevapları kişiselleştirir.',
  'İhtiyaç olduğunda anında insan ekibine devreder.',
  'Kurumsal düzeyde güvenlik; verileriniz sizde kalır.',
  'Dakikalar içinde kurulum, tek panelden yönetim.',
];

/* ─────────── Animation helpers (vanilla IntersectionObserver) ─────────── */

function useReveal(rootMargin = '0px 0px -90px 0px') {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Add "armed" class on mount → enables hidden state via CSS.
    // If observer fires (real browsers), we then add "is-visible" to reveal.
    // If JS / IO is unavailable, content stays visible (graceful fallback).
    node.classList.add('is-armed');
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin }
    );
    obs.observe(node);
    // Safety net: if for any reason IO doesn't fire within 1.2s, just show.
    const fallback = setTimeout(() => node.classList.add('is-visible'), 1200);
    return () => {
      clearTimeout(fallback);
      obs.disconnect();
    };
  }, [rootMargin]);
  return ref;
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-fade ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

function StaggerGroup({ children, className = '' }) {
  // The IntersectionObserver attaches to the group; CSS staggers children via :nth-child delays.
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-stagger ${className}`}>
      {children}
    </div>
  );
}

function StaggerItem({ children, className = '' }) {
  return <div className={`reveal-stagger-item h-full ${className}`}>{children}</div>;
}

/* ─────────── UI primitives ─────────── */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="h-9 w-9 rounded-full border border-border bg-card text-foreground/80 flex items-center justify-center hover:bg-muted/40 transition"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function MinimalNav() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/75 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <TelyxLogoFull width={106} height={30} darkMode={mounted && resolvedTheme === 'dark'} />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2"
          >
            Giriş yapın
          </Link>
          <Link href="/signup">
            <Button variant="pill" size="sm" className="rounded-full px-5 h-9 text-sm font-semibold">
              Ücretsiz başlayın
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function SectionCard({ children, className = '' }) {
  return (
    <div
      className={`h-full flex flex-col rounded-2xl border border-border bg-card/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(2,6,23,0.08)] dark:hover:shadow-[0_18px_44px_rgba(0,0,0,0.4)] ${className}`}
    >
      {children}
    </div>
  );
}

function CTAButton({ size = 'lg', className = '', label = '14 gün ücretsiz başlayın' }) {
  return (
    <Link href="/signup" className={className}>
      <Button
        size={size}
        variant="pill"
        className="w-full sm:w-auto group px-7 sm:px-8 text-base sm:text-lg h-auto py-4 sm:py-5"
      >
        {label}
        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Button>
    </Link>
  );
}

function TrustLine() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary-600 dark:text-primary-300" />
        Kredi kartı gerekmez
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary-600 dark:text-primary-300" />
        Tüm özellikler 14 gün açık
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary-600 dark:text-primary-300" />
        Dilediğiniz zaman iptal
      </span>
    </div>
  );
}

/* ─────────── Page ─────────── */

function useHeroAnimation() {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.classList.add('hero-armed');
    // Trigger transition on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => node.classList.add('hero-shown'));
    });
    // Safety fallback
    const t = setTimeout(() => node.classList.add('hero-shown'), 250);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

export default function DeneLandingPage() {
  const heroRef = useHeroAnimation();
  return (
    <div className="min-h-screen bg-white dark:bg-primary-950 text-foreground">
      {/* Page-scoped scroll reveal styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.reveal-fade { transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); will-change: opacity, transform; }
.reveal-fade.is-armed:not(.is-visible) { opacity: 0; transform: translateY(28px); }
.reveal-stagger .reveal-stagger-item { transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1); will-change: opacity, transform; }
.reveal-stagger.is-armed:not(.is-visible) .reveal-stagger-item { opacity: 0; transform: translateY(28px); }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(1) { transition-delay: 0.05s; }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(2) { transition-delay: 0.13s; }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(3) { transition-delay: 0.21s; }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(4) { transition-delay: 0.29s; }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(5) { transition-delay: 0.37s; }
.reveal-stagger.is-visible .reveal-stagger-item:nth-child(6) { transition-delay: 0.45s; }
.hero-item { transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
.hero-armed .hero-item { opacity: 0; transform: translateY(20px); }
.hero-armed.hero-shown .hero-item { opacity: 1; transform: translateY(0); }
.hero-armed.hero-shown .hero-item-1 { transition-delay: 0.05s; }
.hero-armed.hero-shown .hero-item-2 { transition-delay: 0.15s; }
.hero-armed.hero-shown .hero-item-3 { transition-delay: 0.25s; }
.hero-armed.hero-shown .hero-item-4 { transition-delay: 0.35s; }
.hero-armed.hero-shown .hero-item-5 { transition-delay: 0.5s; }
@media (prefers-reduced-motion: reduce) {
  .reveal-fade, .reveal-stagger .reveal-stagger-item, .hero-item {
    opacity: 1 !important; transform: none !important; transition: none !important; animation: none !important;
  }
}
          `,
        }}
      />

      <MinimalNav />

      {/* HERO */}
      <section ref={heroRef} className="relative overflow-hidden pt-32 pb-20 sm:pt-36 sm:pb-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 40% at 50% 0%, hsl(189 100% 45% / 0.10), transparent 70%), radial-gradient(50% 35% at 80% 20%, hsl(212 100% 46% / 0.12), transparent 70%)',
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span
            className="hero-item hero-item-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/60 text-primary-700 dark:text-primary-200 text-sm font-medium border border-primary-200 dark:border-primary-700/60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            14 gün ücretsiz · Kredi kartı gerekmez
          </span>

          <h1 className="hero-item hero-item-2 mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-[68px] font-normal tracking-tight leading-[1.04]">
            Tek asistan,{' '}
            <span className="text-primary-600 dark:text-primary-300">dört kanal</span>,
            <br className="hidden sm:block" />
            sıfır kayıp müşteri.
          </h1>

          <p className="hero-item hero-item-3 mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Telefon, WhatsApp, e-posta ve web chat'i tek AI asistanla karşılayın.
            Müşterileriniz hızdan, ekibiniz değerli zamandan kazansın.
          </p>

          <div className="hero-item hero-item-4 mt-10 flex flex-col items-center gap-5">
            <CTAButton />
            <TrustLine />
          </div>

          <div className="hero-item hero-item-5 mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {CHANNELS.map(({ icon: Icon, title }) => (
              <span
                key={title}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-card text-sm text-foreground/85"
              >
                <Icon className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                {title}
              </span>
            ))}
          </div>
        </div>

      </section>

      {/* PAIN POINTS */}
      <section className="py-20 sm:py-24 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14 max-w-3xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              Belki size de tanıdık gelir
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-normal tracking-tight leading-[1.15]">
              Kanallar çoğaldı, ekibiniz aynı kaldı.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Müşterileriniz size her yerden ulaşıyor; ama gün, ekip, kapasite hep aynı.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PAINS.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <SectionCard>
                  <div className="h-11 w-11 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </SectionCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* SOLUTION — channels */}
      <section className="py-20 sm:py-24 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              Tek AI, dört kanal
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-normal tracking-tight max-w-2xl mx-auto">
              Müşterileriniz nerede olursa olsun — aynı tutarlılık, aynı tonda.
            </h2>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CHANNELS.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <SectionCard>
                  <div className="h-11 w-11 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </SectionCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 sm:py-24 border-t border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              Üç adımda
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-normal tracking-tight leading-[1.15]">
              Bugün başlayın, ilk müşteri talebinizi dakikalar içinde karşılatın.
            </h2>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map(({ n, title, body }) => (
              <StaggerItem key={n}>
                <SectionCard>
                  <div className="h-9 w-9 rounded-full bg-primary-600 text-primary-foreground flex items-center justify-center text-sm font-bold mb-4">
                    {n}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </SectionCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* WHY TELYX */}
      <section className="py-20 sm:py-24 border-t border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                Neden Telyx?
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-normal tracking-tight leading-tight">
                Sadece bir asistan değil — işletmenizi öğrenen, sizinle birlikte büyüyen bir takım arkadaşı.
              </h2>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Telyx, müşterilerinizin sorularını sizin verinizle yanıtlar; tekrar eden işleri otomatikleştirir, kalan zamanı ekibinize bırakır.
              </p>
            </Reveal>

            <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BULLETS.map((b) => (
                <StaggerItem key={b}>
                  <div className="h-full flex items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 hover:border-primary-300/60 dark:hover:border-primary-700/40 transition">
                    <Check className="h-4 w-4 text-primary-600 dark:text-primary-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/90 leading-relaxed">{b}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 sm:py-24 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-primary-200/70 dark:border-primary-800/50 bg-gradient-to-br from-primary-50 via-background to-background dark:from-primary-950/40 dark:via-background dark:to-background p-8 sm:p-12 text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-card/80 border border-primary-200 dark:border-primary-800/60 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                <Zap className="h-3.5 w-3.5" />
                14 GÜN ÜCRETSİZ
              </div>
              <h2 className="mt-5 text-3xl sm:text-4xl font-normal tracking-tight leading-[1.15]">
                Sıradaki adım sizin.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Telyx'i 14 gün boyunca tüm özellikleriyle deneyin. Beğenmezseniz tek tıkla iptal edin; beğenirseniz ekibinizin yeni süper-üyesiyle tanışmış olun.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <CTAButton />
                <TrustLine />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verileriniz şifrelenmiş olarak saklanır · KVKK uyumlu altyapı
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Telyx AI · Tüm hakları saklıdır.</div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              Gizlilik
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Kullanım Koşulları
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              İletişim
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
