import React from 'react';
import { motion } from 'framer-motion';
import { Wrench, Rocket, Activity, CheckCircle } from 'lucide-react';
import { Card } from './ui/card';

const steps = [
  {
    number: '01',
    icon: Wrench,
    title: 'Build',
    description: 'Create custom voice AI agents using our intuitive API and agent builder. Configure responses, knowledge bases, and conversation flows in minutes.',
    features: ['Drag-and-drop builder', 'Pre-built templates', 'Custom integrations'],
  },
  {
    number: '02',
    icon: CheckCircle,
    title: 'Test',
    description: 'Perform comprehensive testing with built-in LLM features. Simulate edge cases and ensure your agent handles every scenario flawlessly.',
    features: ['Automated testing', 'Edge case simulation', 'Performance metrics'],
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Deploy',
    description: 'Launch your AI agents across multiple channels instantly. From phone calls to web chat, deploy everywhere with a single click.',
    features: ['One-click deployment', 'Multi-channel support', 'Auto-scaling'],
  },
  {
    number: '04',
    icon: Activity,
    title: 'Monitor',
    description: 'Track performance with real-time analytics. Monitor success rates, latency, user sentiment, and identify areas for improvement.',
    features: ['Real-time dashboard', 'Call analytics', 'Sentiment tracking'],
  },
];

export const HowItWorks = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            How It <span className="text-primary">Works</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From concept to deployment in four simple steps. Build enterprise-grade voice AI agents without complex infrastructure.
          </p>
        </motion.div>

        <div className="space-y-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-blue bg-card">
                  <div className={`grid lg:grid-cols-2 gap-8 ${
                    index % 2 === 0 ? '' : 'lg:grid-flow-dense'
                  }`}>
                    {/* Content */}
                    <div className={`p-8 sm:p-12 flex flex-col justify-center ${
                      index % 2 === 0 ? '' : 'lg:col-start-2'
                    }`}>
                      <div className="flex items-center space-x-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-5xl font-bold text-primary/20">{step.number}</span>
                      </div>
                      
                      <h3 className="text-3xl font-bold text-foreground mb-4">{step.title}</h3>
                      <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                        {step.description}
                      </p>
                      
                      <div className="space-y-3">
                        {step.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center space-x-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="text-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visual */}
                    <div className={`bg-gradient-to-br from-primary/5 to-primary/10 p-8 sm:p-12 flex items-center justify-center ${
                      index % 2 === 0 ? '' : 'lg:col-start-1 lg:row-start-1'
                    }`}>
                      <div className="relative w-full max-w-md">
                        {/* Animated visualization */}
                        <motion.div
                          animate={{
                            y: [0, -10, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="relative"
                        >
                          <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 shadow-xl">
                            <div className="flex items-center justify-center mb-6">
                              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                                <Icon className="w-10 h-10 text-primary" />
                              </div>
                            </div>
                            
                            {/* Progress bars or elements */}
                            <div className="space-y-3">
                              {[1, 2, 3].map((_, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ width: 0 }}
                                  whileInView={{ width: `${80 - idx * 15}%` }}
                                  viewport={{ once: true }}
                                  transition={{ duration: 1, delay: 0.5 + idx * 0.2 }}
                                  className="h-2 bg-primary/30 rounded-full"
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                        
                        {/* Floating orbs */}
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5],
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="absolute -top-6 -right-6 w-24 h-24 bg-primary/20 rounded-full blur-2xl"
                        />
                        <motion.div
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.3, 0.6, 0.3],
                          }}
                          transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 1,
                          }}
                          className="absolute -bottom-6 -left-6 w-32 h-32 bg-accent/20 rounded-full blur-2xl"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
