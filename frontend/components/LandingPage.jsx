'use client';

import { useEffect, useRef } from 'react';
import '@/styles/landing.css';

export function LandingPage() {
  const pageRef = useRef(null);
  const chatDemoStarted = useRef(false);
  const chatLoopTimeout = useRef(null);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const cleanups = [];

    // ─── 1. Hero scroll-driven text ───
    {
      const lines = root.querySelectorAll('.hero-line');
      const tagline = root.querySelector('.hero-tagline');
      const heroBottom = root.querySelector('.hero-bottom');
      let ticking = false;
      let revealed = false;

      function updateHero() {
        const scrolled = window.scrollY;
        const thresholds = [10, 80, 150, 220];
        for (let i = 0; i < lines.length; i++) {
          lines[i].classList.toggle('active', scrolled >= thresholds[i]);
        }
        if (scrolled >= 300) {
          tagline?.classList.add('active');
          if (!revealed) { revealed = true; heroBottom?.classList.add('visible'); }
        } else if (scrolled < 260) {
          tagline?.classList.remove('active');
          if (revealed) { revealed = false; heroBottom?.classList.remove('visible'); }
        }
        ticking = false;
      }

      const heroScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateHero); } };
      window.addEventListener('scroll', heroScroll, { passive: true });
      updateHero();
      cleanups.push(() => window.removeEventListener('scroll', heroScroll));
    }

    // ─── 2. Word-by-word manifesto reveal ───
    {
      const section = root.querySelector('.manifesto');
      const words = root.querySelectorAll('.mw');
      if (section && words.length) {
        let ticking = false;

        function updateManifesto() {
          const rect = section.getBoundingClientRect();
          const viewH = window.innerHeight;
          const start = viewH * 0.55;
          const end = -rect.height * 0.3;
          const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
          const total = words.length;
          for (let i = 0; i < total; i++) {
            const threshold = (i + 1) / (total + 1);
            words[i].classList.toggle('lit', progress >= threshold);
          }
          ticking = false;
        }

        const manifestoScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateManifesto); } };
        window.addEventListener('scroll', manifestoScroll, { passive: true });
        updateManifesto();
        cleanups.push(() => window.removeEventListener('scroll', manifestoScroll));
      }
    }

    // ─── 3. Scroll reveal (bidirectional) ───
    {
      const all = root.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add('visible') : e.target.classList.remove('visible');
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -90px 0px' });

      const lateObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add('visible') : e.target.classList.remove('visible');
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -170px 0px' });

      const chatSyncObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add('visible') : e.target.classList.remove('visible');
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -220px 0px' });

      all.forEach((el) => {
        if (el.classList.contains('reveal-late')) {
          lateObserver.observe(el);
        } else {
          observer.observe(el);
        }
      });

      const chatGrid = root.querySelector('#chatDemoGrid');
      if (chatGrid) chatSyncObserver.observe(chatGrid);

      cleanups.push(() => {
        observer.disconnect();
        lateObserver.disconnect();
        chatSyncObserver.disconnect();
      });
    }

    // ─── 3b. Scroll-driven staggered cards ───
    {
      const grids = [
        { id: 'channelsGrid', start: 110, gap: 80 },
        { id: 'proofGrid', start: 110, gap: 80 },
        { id: 'stepsGrid', start: 110, gap: 80 },
      ];
      let ticking = false;

      function updateCards() {
        const viewH = window.innerHeight;
        grids.forEach(({ id, start, gap }) => {
          const grid = root.querySelector(`#${id}`);
          if (!grid) return;
          const cards = grid.querySelectorAll('.scroll-card');
          const scrolled = viewH - grid.getBoundingClientRect().top;
          for (let i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('visible', scrolled >= start + i * gap);
          }
        });
        ticking = false;
      }

      const cardsScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateCards); } };
      window.addEventListener('scroll', cardsScroll, { passive: true });
      updateCards();
      cleanups.push(() => window.removeEventListener('scroll', cardsScroll));
    }

    // ─── 4. Animated counters (bidirectional) ───
    {
      const counters = root.querySelectorAll('[data-count]');
      if (counters.length) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              if (e.target.dataset.counting) return;
              e.target.dataset.counting = '1';

              const target = parseFloat(e.target.dataset.count);
              const decimals = parseInt(e.target.dataset.decimal || '0', 10);
              const suffix = e.target.dataset.suffix || '';
              const prefix = e.target.dataset.prefix || '';
              const duration = 1400;
              const startTime = performance.now();

              function tick(now) {
                const elapsed = now - startTime;
                const p = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                const current = target * eased;
                e.target.textContent = prefix + (decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString('tr-TR')) + suffix;
                if (p < 1) requestAnimationFrame(tick);
                else delete e.target.dataset.counting;
              }
              requestAnimationFrame(tick);
            } else {
              const prefix = e.target.dataset.prefix || '';
              e.target.textContent = prefix + '0';
              delete e.target.dataset.counting;
            }
          });
        }, { threshold: 0.5, rootMargin: '0px 0px -50px 0px' });

        counters.forEach((c) => observer.observe(c));
        cleanups.push(() => observer.disconnect());
      }
    }

    // ─── 5. Dashboard channel bars (bidirectional) ───
    {
      const bars = root.querySelectorAll('.channel-bar-fill');
      if (bars.length) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.style.width = e.target.dataset.width + '%';
            } else {
              e.target.style.width = '0';
            }
          });
        }, { threshold: 0.3, rootMargin: '0px 0px -50px 0px' });

        bars.forEach((b) => observer.observe(b));
        cleanups.push(() => observer.disconnect());
      }
    }

    // ─── 6. Chat demo typing with loop ───
    {
      const container = root.querySelector('#chatDemo');
      if (container) {
        const messages = [
          { type: 'customer', text: 'Merhaba, siparişim nerede?' },
          { type: 'bot', text: 'Merhaba! Kontrol edebilmem için sipariş numaranızı rica edebilir miyim?' },
          { type: 'customer', text: 'Sipariş numaram SİP-12345.' },
          { type: 'bot', text: 'Siparişiniz şu an hazırlanıyor aşamasında ve bugün kargoya verilmesi bekleniyor. \u{1F4E6}' },
        ];

        let cancelled = false;

        function addMessage(msg, delay) {
          return new Promise((resolve) => {
            const t = setTimeout(() => {
              if (cancelled) return;
              if (msg.type === 'bot') {
                const typing = document.createElement('div');
                typing.className = 'chat-msg bot';
                typing.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
                container.appendChild(typing);
                container.scrollTop = container.scrollHeight;
                const t2 = setTimeout(() => {
                  if (cancelled) return;
                  typing.remove();
                  const el = document.createElement('div');
                  el.className = 'chat-msg bot';
                  el.textContent = msg.text;
                  el.style.opacity = '0';
                  el.style.transform = 'translateY(8px)';
                  container.appendChild(el);
                  requestAnimationFrame(() => {
                    el.style.transition = 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                  });
                  container.scrollTop = container.scrollHeight;
                  resolve();
                }, 500 + Math.random() * 200);
                cleanups.push(() => clearTimeout(t2));
              } else {
                const el = document.createElement('div');
                el.className = 'chat-msg customer';
                el.textContent = msg.text;
                el.style.opacity = '0';
                el.style.transform = 'translateY(8px)';
                container.appendChild(el);
                requestAnimationFrame(() => {
                  el.style.transition = 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
                  el.style.opacity = '1';
                  el.style.transform = 'translateY(0)';
                });
                container.scrollTop = container.scrollHeight;
                resolve();
              }
            }, delay);
            cleanups.push(() => clearTimeout(t));
          });
        }

        async function runChat() {
          if (cancelled) return;
          container.innerHTML = '';
          for (let i = 0; i < messages.length; i++) {
            if (cancelled) return;
            await addMessage(messages[i], i === 0 ? 200 : 700 + Math.random() * 300);
          }
          if (cancelled) return;
          chatLoopTimeout.current = setTimeout(runChat, 2000);
        }

        const chatGrid = root.querySelector('#chatDemoGrid') || container;
        const chatObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !chatDemoStarted.current) {
            chatDemoStarted.current = true;
            setTimeout(runChat, 800);
          }
        }, { threshold: 0.15, rootMargin: '0px 0px -220px 0px' });

        chatObserver.observe(chatGrid);
        cleanups.push(() => {
          cancelled = true;
          chatObserver.disconnect();
          if (chatLoopTimeout.current) clearTimeout(chatLoopTimeout.current);
        });
      }
    }

    return () => {
      cleanups.forEach((fn) => fn());
      chatDemoStarted.current = false;
    };
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <div className="lp-page">
        <div className="glow glow-l" aria-hidden="true" />
        <div className="glow glow-r" aria-hidden="true" />

        {/* ═══ Hero ═══ */}
        <section className="hero" id="hero">
          <div className="hero-grid-bg" aria-hidden="true" />
          <div className="hero-text-stack">
            <span className="hero-line" data-index="0">Telefon.</span>
            <span className="hero-line" data-index="1">WhatsApp.</span>
            <span className="hero-line" data-index="2">Chat.</span>
            <span className="hero-line" data-index="3">Email.</span>
            <span className="hero-tagline">Tek AI, tüm kanallar.</span>
          </div>
          <div className="hero-bottom">
            <p className="hero-sub">
              Müşteri hizmetlerini 7/24 otomatize edin. Telefon, WhatsApp, chat ve email —
              her kanalda aynı AI asistan, aynı kalite.
            </p>
            <div className="hero-actions">
              <a href="#" className="lp-btn">Ücretsiz Başla</a>
              <a href="#workflow" className="lp-btn-ghost">Nasıl çalışır?</a>
            </div>
          </div>
          <div className="hero-scroll-cue" aria-hidden="true">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
            </svg>
          </div>
        </section>

        {/* ═══ Manifesto ═══ */}
        <section className="manifesto" id="manifesto">
          <div className="shell">
            <p className="manifesto-text" id="manifestoText">
              <span className="mw">Her</span>{' '}
              <span className="mw">gün</span>{' '}
              <span className="mw">binlerce</span>{' '}
              <span className="mw">müşteri</span>{' '}
              <span className="mw">mesajı</span>{' '}
              <span className="mw">geliyor.</span>{' '}
              <span className="mw">Ama</span>{' '}
              <span className="mw">zamanında</span>{' '}
              <span className="mw">yanıt</span>{' '}
              <span className="mw">vermek</span>{' '}
              <span className="mw">hâlâ</span>{' '}
              <span className="mw em">imkânsız</span>{' '}
              <span className="mw">gibi</span>{' '}
              <span className="mw">hissettiriyor.</span>{' '}
              <span className="mw">Telyx</span>{' '}
              <span className="mw">bunu</span>{' '}
              <span className="mw em">değiştiriyor.</span>
            </p>
          </div>
        </section>

        {/* ═══ Dashboard mockup ═══ */}
        <section className="dashboard-section">
          <div className="shell">
            <div className="dashboard-frame reveal-scale">
              <div className="dashboard-topbar">
                <span className="dashboard-topbar-title">Telyx Dashboard</span>
                <div className="dashboard-topbar-pills">
                  <span>Bugün</span>
                  <span className="active-pill">7 Gün</span>
                  <span>30 Gün</span>
                </div>
              </div>
              <div className="metrics-row">
                <div className="metric-card reveal reveal-delay-1">
                  <div className="metric-label">Görüşme</div>
                  <div className="metric-value" data-color="primary" data-count="1247">0</div>
                  <div className="metric-trend">&uarr; 18% artış</div>
                </div>
                <div className="metric-card reveal reveal-delay-2">
                  <div className="metric-label">Çözüm Oranı</div>
                  <div className="metric-value" data-color="accent" data-count="94.2" data-suffix="%" data-decimal="1">0</div>
                  <div className="metric-trend">&uarr; 3.1% iyileşme</div>
                </div>
                <div className="metric-card reveal reveal-delay-3">
                  <div className="metric-label">Ort. Yanıt</div>
                  <div className="metric-value" data-color="info" data-count="1.8" data-suffix="s" data-decimal="1">0</div>
                  <div className="metric-trend">&darr; 12% daha hızlı</div>
                </div>
                <div className="metric-card reveal reveal-delay-4">
                  <div className="metric-label">Memnuniyet</div>
                  <div className="metric-value" data-color="warning" data-count="4.7" data-suffix="/5" data-decimal="1">0</div>
                  <div className="metric-trend">&uarr; 5.2% artış</div>
                </div>
              </div>
              <div className="dashboard-body">
                <div className="channel-bars">
                  <div className="channel-bar-item">
                    <span className="channel-bar-name">Web Chat</span>
                    <div className="channel-bar-track"><div className="channel-bar-fill" data-color="accent" data-width="42" /></div>
                    <span className="channel-bar-pct">42%</span>
                  </div>
                  <div className="channel-bar-item">
                    <span className="channel-bar-name">WhatsApp</span>
                    <div className="channel-bar-track"><div className="channel-bar-fill" data-color="info" data-width="31" /></div>
                    <span className="channel-bar-pct">31%</span>
                  </div>
                  <div className="channel-bar-item">
                    <span className="channel-bar-name">Email</span>
                    <div className="channel-bar-track"><div className="channel-bar-fill" data-color="warning" data-width="18" /></div>
                    <span className="channel-bar-pct">18%</span>
                  </div>
                  <div className="channel-bar-item">
                    <span className="channel-bar-name">Telefon</span>
                    <div className="channel-bar-track"><div className="channel-bar-fill" data-color="primary" data-width="9" /></div>
                    <span className="channel-bar-pct">9%</span>
                  </div>
                </div>
                <div className="activity-feed">
                  <div className="activity-item">
                    <span className="activity-dot" style={{ background: 'var(--lp-accent)' }} />
                    <span className="activity-text">Yeni web chat görüşmesi başladı</span>
                    <span className="activity-time">2dk önce</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot" style={{ background: 'var(--lp-info)' }} />
                    <span className="activity-text">WhatsApp sipariş sorgusu çözüldü</span>
                    <span className="activity-time">4dk önce</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot" style={{ background: 'var(--lp-warning)' }} />
                    <span className="activity-text">Email taslağı onay bekliyor</span>
                    <span className="activity-time">7dk önce</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-dot" style={{ background: 'var(--lp-primary)' }} />
                    <span className="activity-text">Telefon görüşmesi yönlendirildi</span>
                    <span className="activity-time">12dk önce</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Channels ═══ */}
        <section className="channels" id="channels">
          <div className="shell">
            <div className="channels-header reveal">
              <span className="kicker">Omni-channel</span>
              <h2 className="section-title">Tüm kanallar, tek AI</h2>
              <p className="section-sub" style={{ margin: '0 auto' }}>Müşterileriniz nerede olursa olsun — aynı zekâ, aynı kalite, aynı hız.</p>
            </div>
            <div className="channels-grid" id="channelsGrid">
              <div className="channel-card ch-2 scroll-card">
                <div className="channel-icon">{'\u{1F4DE}'}</div>
                <h3>Telefon</h3>
                <p>Sesli AI asistan ile çağrıları karşılayın. Randevu oluşturma, bilgi verme ve yönlendirme otomatik.</p>
              </div>
              <div className="channel-card ch-1 scroll-card">
                <div className="channel-icon">{'\u{1F4AC}'}</div>
                <h3>WhatsApp</h3>
                <p>En çok kullanılan kanalda anında yanıt. Sipariş takibi, randevu, destek — hepsi WhatsApp üzerinden.</p>
              </div>
              <div className="channel-card ch-3 scroll-card">
                <div className="channel-icon">{'\u{1F310}'}</div>
                <h3>Web Chat</h3>
                <p>Sitenize tek satırlık kodla entegre edin. Ziyaretçileri müşteriye çeviren akıllı sohbet.</p>
              </div>
              <div className="channel-card ch-4 scroll-card">
                <div className="channel-icon">{'\u{1F4E7}'}</div>
                <h3>Email</h3>
                <p>Gelen kutusunu AI ile yönetin. Otomatik taslak, akıllı sınıflandırma ve hızlı yanıt.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Chat demo ═══ */}
        <section className="chat-demo">
          <div className="shell">
            <div className="chat-demo-grid reveal-sync" id="chatDemoGrid">
              <div className="chat-demo-copy sync-left">
                <span className="kicker">Canlı deneyim</span>
                <h2 className="section-title">1.8 saniyede müşteri yanıtı</h2>
                <p className="section-sub">AI asistan, müşterinizin sorusunu anlar, CRM verinize bakar ve saniyeler içinde doğru yanıtı verir. İnsan müşteri temsilcisi gibi — ama 7/24.</p>
              </div>
              <div className="chat-window sync-right">
                <div className="chat-header">
                  <div className="chat-avatar">TX</div>
                  <div className="chat-header-info">
                    <strong>Telyx AI Asistan</strong>
                    <span>&#9679; Çevrimiçi</span>
                  </div>
                </div>
                <div className="chat-messages" id="chatDemo">
                  {/* Messages injected by JS */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Proof stats ═══ */}
        <section className="proof" id="impact">
          <div className="shell">
            <div className="proof-grid" id="proofGrid">
              <div className="proof-card scroll-card">
                <p className="proof-value" data-color="primary" data-count="85" data-prefix="%">0</p>
                <h2>daha hızlı yanıt süresi</h2>
                <p>Müşteriler saniyeler içinde cevap alır. Bekleme süresi neredeyse sıfır.</p>
              </div>
              <div className="proof-card scroll-card">
                <p className="proof-value" data-color="accent">7/24</p>
                <h2>kesintisiz müşteri hizmeti</h2>
                <p>Gece, hafta sonu, bayram — AI asistan hiç tatil yapmaz.</p>
              </div>
              <div className="proof-card scroll-card">
                <p className="proof-value" data-color="info" data-count="4" data-suffix="x">0</p>
                <h2>daha fazla müşteri kapasitesi</h2>
                <p>Aynı ekiple 4 kat daha fazla müşteriye hizmet verin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Workflow ═══ */}
        <section className="workflow" id="workflow">
          <div className="shell">
            <div className="workflow-header reveal">
              <span className="kicker">Nasıl çalışır</span>
              <h2 className="section-title">4 adımda AI müşteri hizmeti</h2>
              <p className="section-sub" style={{ margin: '0 auto' }}>Kurulum dakikalar içerisinde. Teknik bilgi gerektirmez.</p>
            </div>
            <div className="steps-grid" id="stepsGrid">
              <div className="step-card scroll-card">
                <span className="step-num">01</span>
                <h3>İşletmenizi tanımlayın</h3>
                <p>SSS, bilgi tabanı ve işletme detaylarınızı yükleyin. AI asistan sizi öğrensin.</p>
              </div>
              <div className="step-card scroll-card">
                <span className="step-num">02</span>
                <h3>Kanalları bağlayın</h3>
                <p>Telefon, WhatsApp, email ve web chat — tek tıkla entegre edin. CRM bağlantısı da dahil.</p>
              </div>
              <div className="step-card scroll-card">
                <span className="step-num">03</span>
                <h3>AI devreye girsin</h3>
                <p>Müşterileriniz yazar, arar veya email atar. AI anında, doğru ve güvenli yanıt verir.</p>
              </div>
              <div className="step-card scroll-card">
                <span className="step-num">04</span>
                <h3>İzleyin ve optimize edin</h3>
                <p>Dashboard&apos;dan tüm kanalları takip edin. Performans ve memnuniyet tek yerde.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Features ═══ */}
        <section className="features" id="features">
          <div className="shell">
            <div className="feature-row">
              <div className="reveal-left reveal-late">
                <span className="kicker">Entegrasyonlar</span>
                <h2 className="section-title">Mevcut sisteminizle anında çalışın</h2>
                <p className="section-sub">Shopify, ikas, Google Calendar, Gmail ve daha fazlası. CRM verinize erişerek sipariş, kargo, randevu sorgularını otomatik yanıtlayın.</p>
              </div>
              <div className="feature-visual reveal-right reveal-late">
                <div className="feature-visual-title">Desteklenen entegrasyonlar</div>
                <div className="integration-logos">
                  <div className="integration-logo"><span>{'\u{1F6CD}\u{FE0F}'}</span> Shopify</div>
                  <div className="integration-logo"><span>{'\u{1F4E6}'}</span> ikas</div>
                  <div className="integration-logo"><span>{'\u{1F4C5}'}</span> Google Calendar</div>
                  <div className="integration-logo"><span>{'\u2709\uFE0F'}</span> Gmail</div>
                  <div className="integration-logo"><span>{'\u{1F4B3}'}</span> iyzico</div>
                  <div className="integration-logo"><span>{'\u{1F517}'}</span> Webhook API</div>
                </div>
              </div>
            </div>
            <div className="feature-row reverse">
              <div className="reveal-right reveal-late">
                <span className="kicker">Güvenlik</span>
                <h2 className="section-title">Müşteri verisi koruma altında</h2>
                <p className="section-sub">Kimlik doğrulama, veri maskeleme, guardrail sistemi ve KVKK uyumlu altyapı ile verileriniz her zaman güvende.</p>
              </div>
              <div className="feature-visual reveal-left reveal-late">
                <div className="feature-visual-title">Güvenlik katmanları</div>
                <div className="shield-grid">
                  <div className="shield-item">
                    <strong>{'\u{1F510}'} Kimlik Doğrulama</strong>
                    <span>Telefon &amp; isim bazlı iki adımlı doğrulama</span>
                  </div>
                  <div className="shield-item">
                    <strong>{'\u{1F6E1}\u{FE0F}'} Guardrail</strong>
                    <span>8+ politika katmanlı AI güvenlik bariyeri</span>
                  </div>
                  <div className="shield-item">
                    <strong>{'\u{1F512}'} Veri Maskeleme</strong>
                    <span>Telefon ve hassas veri otomatik maskelenir</span>
                  </div>
                  <div className="shield-item">
                    <strong>{'\u{1F4CB}'} KVKK Uyumu</strong>
                    <span>Türkiye mevzuatına uygun veri işleme</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="cta" id="cta">
          <div className="shell">
            <div className="cta-panel reveal-scale">
              <span className="kicker">Hemen başlayın</span>
              <h2 className="section-title">Müşteri hizmetlerinizi AI ile dönüştürün</h2>
              <p className="section-sub">15 dakika ücretsiz arama ile deneyin. Kredi kartı gerekmez, kurulum dakikalar içerisinde.</p>
              <div className="cta-actions">
                <a href="#" className="lp-btn">Ücretsiz Hesap Oluştur</a>
                <a href="#" className="lp-btn-ghost">Demo Talep Et</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LandingPage;
