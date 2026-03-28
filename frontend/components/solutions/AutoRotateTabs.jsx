'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function AutoRotateTabs({
  tabs = [],
  className = '',
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const outerRef = useRef(null);
  const activeRef = useRef(0);

  useEffect(() => {
    if (!tabs.length) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const el = outerRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const sectionHeight = el.offsetHeight;
        const viewportH = window.innerHeight;

        const scrolled = -rect.top;
        const scrollableRange = sectionHeight - viewportH;
        if (scrollableRange <= 0) return;

        const progress = Math.max(0, Math.min(1, scrolled / scrollableRange));
        const newIndex = Math.min(
          tabs.length - 1,
          Math.floor(progress * tabs.length)
        );

        if (newIndex !== activeRef.current) {
          activeRef.current = newIndex;
          setActiveIndex(newIndex);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [tabs.length]);

  const handleTabClick = useCallback((index) => {
    const el = outerRef.current;
    if (!el) return;

    const sectionHeight = el.offsetHeight;
    const viewportH = window.innerHeight;
    const scrollableRange = sectionHeight - viewportH;
    const sectionTop = el.getBoundingClientRect().top + window.scrollY;

    const targetScroll = sectionTop + (index / tabs.length) * scrollableRange;
    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }, [tabs.length]);

  const activeTab = tabs[activeIndex];

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ minHeight: `${tabs.length * 70}vh` }}
    >
      <div style={{ position: 'sticky', top: '96px', zIndex: 10 }}>
        {/* Tab triggers */}
        <div className="sol-tabs-list mb-2">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = i === activeIndex;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(i)}
                className={`sol-tab-trigger ${isActive ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content — simple crossfade via CSS */}
        <div className="relative" style={{ minHeight: '280px' }}>
          {tabs.map((tab, i) => (
            <div
              key={tab.key}
              className="sol-tab-content"
              style={{
                position: i === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                opacity: i === activeIndex ? 1 : 0,
                transform: i === activeIndex ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
                pointerEvents: i === activeIndex ? 'auto' : 'none',
              }}
            >
              {/* Text side */}
              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-[var(--sol-text-primary)] mb-3">
                  {tab.contentTitle}
                </h3>
                <p className="text-[var(--sol-text-secondary)] leading-relaxed">
                  {tab.contentDesc}
                </p>
                {tab.contentBullets && (
                  <ul className="mt-4 space-y-2">
                    {tab.contentBullets.map((bullet, bi) => (
                      <li key={bi} className="flex items-start gap-2 text-sm text-[var(--sol-text-secondary)]">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--sol-accent)] flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Visual side */}
              <div className="sol-tab-visual">
                {tab.visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
