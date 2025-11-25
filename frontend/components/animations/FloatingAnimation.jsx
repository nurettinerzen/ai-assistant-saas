import React from 'react';
import { motion } from 'framer-motion';

export const FloatingAnimation = () => {
  const shapes = [
    { size: 100, x: '10%', y: '20%', duration: 20, delay: 0 },
    { size: 80, x: '80%', y: '30%', duration: 25, delay: 2 },
    { size: 60, x: '60%', y: '70%', duration: 18, delay: 4 },
    { size: 120, x: '30%', y: '60%', duration: 22, delay: 1 },
    { size: 90, x: '70%', y: '10%', duration: 24, delay: 3 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: shape.size,
            height: shape.size,
            left: shape.x,
            top: shape.y,
            background: `radial-gradient(circle, hsla(217, 91%, 60%, 0.15) 0%, hsla(217, 91%, 60%, 0) 70%)`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: shape.delay,
          }}
        />
      ))}
      
      {/* Additional glow effects */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(217, 91%, 60%, 0.1) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(217, 91%, 70%, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
      />
    </div>
  );
};
