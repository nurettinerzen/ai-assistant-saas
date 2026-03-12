'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const LIGHT_CONFIGS = [
  { radius: 150, color: '#4285f4', alpha: 0.08, ease: 0.01 },
  { radius: 110, color: '#ea4335', alpha: 0.10, ease: 0.02 },
  { radius: 78,  color: '#fbbc04', alpha: 0.12, ease: 0.035 },
  { radius: 54,  color: '#34a853', alpha: 0.16, ease: 0.055 },
  { radius: 38,  color: '#8ab4f8', alpha: 0.22, ease: 0.08 },
  { radius: 24,  color: '#c58af9', alpha: 0.30, ease: 0.11 },
  { radius: 13,  color: '#ff8bcb', alpha: 0.40, ease: 0.15 },
  { radius: 5,   color: '#4285f4', alpha: 0.55, ease: 0.22 },
];

const DARK_CONFIGS = [
  { radius: 150, color: '#1a73e8', alpha: 0.06, ease: 0.01 },
  { radius: 110, color: '#d93025', alpha: 0.08, ease: 0.02 },
  { radius: 78,  color: '#f9ab00', alpha: 0.10, ease: 0.035 },
  { radius: 54,  color: '#1e8e3e', alpha: 0.12, ease: 0.055 },
  { radius: 38,  color: '#669df6', alpha: 0.18, ease: 0.08 },
  { radius: 24,  color: '#a142f4', alpha: 0.24, ease: 0.11 },
  { radius: 13,  color: '#ee675c', alpha: 0.32, ease: 0.15 },
  { radius: 5,   color: '#669df6', alpha: 0.45, ease: 0.22 },
];

export const TrailingCirclesCanvas = () => {
  const canvasRef = useRef(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;

    let W = parent.offsetWidth;
    let H = parent.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const mouse = { x: W / 2, y: H / 2, active: false };

    const configs = resolvedTheme === 'dark' ? DARK_CONFIGS : LIGHT_CONFIGS;
    const circles = configs.map(cfg => ({
      x: W / 2,
      y: H / 2,
      cfg,
      vis: 0,
    }));

    function resize() {
      W = canvas.width = parent.offsetWidth;
      H = canvas.height = parent.offsetHeight;
    }

    function onMouseMove(e) {
      const r = parent.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      mouse.x = mx;
      mouse.y = my;
      mouse.active = mx >= 0 && mx <= W && my >= 0 && my <= H;
    }

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMouseMove);
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        c.x += (mouse.x - c.x) * c.cfg.ease;
        c.y += (mouse.y - c.y) * c.cfg.ease;
        c.vis += ((mouse.active ? 1 : 0) - c.vis) * 0.05;
        if (c.vis < 0.01) continue;
        ctx.globalAlpha = c.vis * c.cfg.alpha;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.cfg.radius, 0, Math.PI * 2);
        ctx.fillStyle = c.cfg.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
};
