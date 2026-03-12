'use client';

import { useEffect, useRef, useCallback } from 'react';

const COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#8ab4f8', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#ff8bcb'];
const NDOTS = 60; // v2-dotmorph-fix

function getShapePos(i, shapeType, centerX, centerY) {
  if (shapeType === 'star') {
    const angle = (i / NDOTS) * Math.PI * 2;
    const spike = i % 2 === 0 ? 55 : 28;
    return { x: centerX + Math.cos(angle) * spike, y: centerY + Math.sin(angle) * spike };
  } else {
    const cols = 8;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const w = 130, h = 90;
    return { x: centerX - w / 2 + col * (w / cols) + 8, y: centerY - h / 2 + row * (h / (NDOTS / cols)) + 8 };
  }
}

export const DotMorphCanvas = ({ shapeType = 'star', className = '', children }) => {
  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const hoveredRef = useRef(false);

  const onEnter = useCallback(() => { hoveredRef.current = true; }, []);
  const onLeave = useCallback(() => { hoveredRef.current = false; }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!canvas || !card) return;

    const ctx = canvas.getContext('2d');
    let cW = canvas.width = card.offsetWidth;
    let cH = canvas.height = card.offsetHeight;
    let centerX = cW / 2, centerY = cH / 2;

    const dots = [];
    for (let i = 0; i < NDOTS; i++) {
      const pos = getShapePos(i, shapeType, centerX, centerY);
      dots.push({
        x: Math.random() * cW,
        y: Math.random() * cH,
        tx: pos.x,
        ty: pos.y,
        color: COLORS[i % COLORS.length],
        size: 2 + Math.random() * 2,
      });
    }

    let morphProgress = 0;
    let raf;

    function animate() {
      ctx.clearRect(0, 0, cW, cH);

      const target = hoveredRef.current ? 1 : 0;
      morphProgress += (target - morphProgress) * 0.05;

      if (morphProgress < 0.01 && !hoveredRef.current) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const scX = d.tx + Math.sin(now / 2000 + i) * cW * 0.4;
        const scY = d.ty + Math.cos(now / 3000 + i) * cH * 0.4;

        const finalX = scX + (d.tx - scX) * morphProgress;
        const finalY = scY + (d.ty - scY) * morphProgress;

        d.x += (finalX - d.x) * 0.06;
        d.y += (finalY - d.y) * 0.06;

        const breathe = Math.sin(now / 1000 + i * 0.5) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * (1 + breathe * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = morphProgress * (0.4 + breathe * 0.2);
        ctx.fill();

        if (morphProgress > 0.15) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.03 * morphProgress;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    }

    animate();

    function onResize() {
      cW = canvas.width = card.offsetWidth;
      cH = canvas.height = card.offsetHeight;
      centerX = cW / 2;
      centerY = cH / 2;
      for (let i = 0; i < dots.length; i++) {
        const p = getShapePos(i, shapeType, centerX, centerY);
        dots[i].tx = p.x;
        dots[i].ty = p.y;
      }
    }

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [shapeType]);

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] pointer-events-none"
      />
      <div className="relative z-[2]">
        {children}
      </div>
    </div>
  );
};
