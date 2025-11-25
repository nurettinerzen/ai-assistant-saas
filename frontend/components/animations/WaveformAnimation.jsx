import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const WaveformAnimation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Waveform particles
    const particles = [];
    const particleCount = 80;
    
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.baseY = this.y;
        this.speed = 0.2 + Math.random() * 0.3;
        this.amplitude = 20 + Math.random() * 40;
        this.frequency = 0.002 + Math.random() * 0.003;
        this.phase = Math.random() * Math.PI * 2;
        this.size = 2 + Math.random() * 3;
        this.opacity = 0.3 + Math.random() * 0.4;
      }

      update(time) {
        // Wave motion
        this.y = this.baseY + Math.sin(time * this.frequency + this.phase + this.x * 0.002) * this.amplitude;
        
        // Horizontal drift
        this.x -= this.speed;
        
        // Reset if off screen
        if (this.x < -50) {
          this.x = canvas.width + 50;
          this.baseY = Math.random() * canvas.height;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217, 91%, 60%, ${this.opacity})`;
        ctx.fill();
      }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Waveform bars
    const bars = [];
    const barCount = 30;
    
    class Bar {
      constructor(index) {
        this.index = index;
        this.x = (canvas.width / barCount) * index + canvas.width / barCount / 2;
        this.baseHeight = 40;
        this.maxHeight = 150;
        this.width = 4;
        this.speed = 0.02 + Math.random() * 0.03;
        this.phase = Math.random() * Math.PI * 2;
      }

      update(time) {
        const wave1 = Math.sin(time * this.speed + this.phase + this.index * 0.3);
        const wave2 = Math.sin(time * this.speed * 1.5 + this.index * 0.2);
        this.height = this.baseHeight + (wave1 * 0.5 + wave2 * 0.5 + 0.5) * this.maxHeight;
      }

      draw() {
        const centerY = canvas.height / 2;
        const gradient = ctx.createLinearGradient(this.x, centerY - this.height / 2, this.x, centerY + this.height / 2);
        gradient.addColorStop(0, 'hsla(217, 91%, 70%, 0.1)');
        gradient.addColorStop(0.5, 'hsla(217, 91%, 60%, 0.3)');
        gradient.addColorStop(1, 'hsla(217, 91%, 70%, 0.1)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - this.width / 2, centerY - this.height / 2, this.width, this.height);
      }
    }

    // Initialize bars
    for (let i = 0; i < barCount; i++) {
      bars.push(new Bar(i));
    }

    // Animation loop
    let animationId;
    let startTime = Date.now();

    const animate = () => {
      const time = (Date.now() - startTime) / 1000;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connecting lines between nearby particles
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(217, 91%, 60%, ${(1 - distance / 150) * 0.1})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Update and draw bars
      bars.forEach(bar => {
        bar.update(time);
        bar.draw();
      });

      // Update and draw particles
      particles.forEach(particle => {
        particle.update(time);
        particle.draw();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.6 }}
      />
      
      {/* Additional gradient overlays */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent" />
      
      {/* Floating orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(217, 91%, 60%, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(217, 91%, 70%, 0.12) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -40, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
      />
    </>
  );
};