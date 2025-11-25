import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { toast } from 'sonner';

export const LiveDemoSection = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const response = await fetch('http://localhost:3001/api/demo-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      toast.success('Demo request submitted! Our AI agent will call you shortly.');
      setFormData({ name: '', email: '', phone: '' });
    } else {
      toast.error('Failed to submit request. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error);
    toast.error('Something went wrong. Please try again.');
  }
};

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-gray-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Try Our <span className="text-primary">Live Demo</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the power of AI voice agents firsthand. Get a live call from our intelligent agent.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Card className="max-w-2xl mx-auto border-2 border-primary/20 shadow-blue-lg bg-card">
            <div className="p-8 sm:p-12">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-center text-foreground mb-2">
                Receive a Live Call
              </h3>
              <p className="text-center text-muted-foreground mb-8">
                Our AI agent will demonstrate real-time conversation capabilities
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    Full Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="h-12 border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                    Email Address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="h-12 border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                    Phone Number
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="h-12 border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-blue h-12 text-base font-semibold"
                >
                  Request Live Demo Call
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  By submitting, you agree to receive a demo call from our AI agent
                </p>
              </form>
            </div>
          </Card>
        </motion.div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6 mt-16"
        >
          {[
            { title: 'Natural Conversation', description: 'Experience human-like dialogue with context awareness' },
            { title: 'Instant Response', description: '500ms latency for real-time interaction' },
            { title: 'Smart Routing', description: 'Intelligent call transfer when needed' },
          ].map((feature, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <h4 className="font-semibold text-foreground mb-2">{feature.title}</h4>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
