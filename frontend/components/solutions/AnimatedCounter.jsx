'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  label,
  duration = 1400,
  className = '',
  valueClassName = '',
  labelClassName = '',
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: '-40px' });
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);
  const animRef = useRef(null);

  useEffect(() => {
    if (!inView) {
      setDisplay(`${prefix}0${suffix}`);
      return;
    }

    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = eased * value;
      setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [inView, value, suffix, prefix, decimals, duration]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <div className={`sol-counter-value text-4xl md:text-5xl font-bold ${valueClassName}`}>
        {display}
      </div>
      {label && (
        <div className={`text-sm mt-1 ${labelClassName}`}>
          {label}
        </div>
      )}
    </motion.div>
  );
}
