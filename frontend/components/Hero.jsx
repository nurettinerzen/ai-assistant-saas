import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from './ui/button';
import { WaveformAnimation } from './animations/WaveformAnimation';

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-gray-50 to-background">
        <WaveformAnimation />
      </div>

      {/* Content - Centered */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6"
          >
            <span className="px-5 py-2.5 bg-primary/10 text-primary rounded-full text-sm font-semibold border border-primary/20 shadow-sm">
              AI Voice Agents Platform
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-foreground leading-[1.1] mb-6"
          >
            Transform Your Calls to
            <br />
            <span className="text-primary">Intelligent</span> Voice AI
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mb-10 leading-relaxed max-w-3xl mx-auto"
          >
            Deliver instant, human-like conversations and automate your call operations with an AI agent that’s built for scale.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <Button 
  size="lg"
  onClick={() => window.location.href = '/register'}
  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-blue-lg group px-8 py-6 text-lg h-auto"
>
  Try For Free
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
  size="lg" 
  variant="outline"
  onClick={() => window.location.href = '/contact'}
  className="border-2 border-border hover:border-primary hover:bg-primary/5 group px-8 py-6 text-lg h-auto"
>
  Contact Sales
</Button>
          </motion.div>

          {/* Trust Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-sm text-muted-foreground mb-8"
          >
            Trusted by 3000+ businesses worldwide
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">500ms</div>
              <div className="text-sm text-muted-foreground font-medium">Low Latency Response</div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">99.99%</div>
              <div className="text-sm text-muted-foreground font-medium">Platform Uptime</div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">18+</div>
              <div className="text-sm text-muted-foreground font-medium">Languages Supported</div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};