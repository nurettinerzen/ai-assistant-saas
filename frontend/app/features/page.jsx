'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';

export default function FeaturesPage() {
  const features = [
    {
      id: 'voice',
      icon: '🤖',
      title: 'AI Voice Assistant',
      description: 'Natural conversational AI that understands context and responds intelligently',
      features: [
        'Multiple voice options (male/female, professional/friendly)',
        'Support for 20+ languages',
        'Context-aware conversations',
        'Custom personality configuration',
        'Real-time voice modulation'
      ]
    },
    {
      id: 'calendar',
      icon: '📅',
      title: 'Smart Calendar Integration',
      description: 'Automated booking and scheduling powered by AI',
      features: [
        'Google Calendar sync',
        'Automatic appointment booking',
        'Conflict detection',
        'Reminder notifications',
        'Multi-timezone support'
      ]
    },
    {
      id: 'inventory',
      icon: '📦',
      title: 'Inventory Management',
      description: 'Track products, stock levels, and shipping in real-time',
      features: [
        'Real-time stock tracking',
        'Low stock alerts',
        'CSV bulk import',
        'Google Sheets integration',
        'Shipping status tracking'
      ]
    },
    {
      id: 'analytics',
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Insights and metrics to grow your business',
      features: [
        'Call volume analytics',
        'Customer sentiment analysis',
        'Booking conversion rates',
        'Revenue tracking',
        'Custom reports'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in-up">
              Powerful Features for
              <span className="gradient-text"> Every Business</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 animate-fade-in-up">
              Everything you need to automate customer interactions and grow your business
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-24">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                id={feature.id}
                className={`flex flex-col ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                } items-center gap-12 animate-fade-in-up`}
              >
                {/* Icon/Visual */}
                <div className="flex-1 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-400 blur-3xl opacity-20 animate-pulse"></div>
                    <div className="relative glass p-12 rounded-3xl">
                      <span className="text-8xl">{feature.icon}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                  <h2 className="text-4xl font-bold text-gray-900">{feature.title}</h2>
                  <p className="text-xl text-gray-600">{feature.description}</p>
                  <ul className="space-y-3">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <svg className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already using TELYX.AI to automate their customer interactions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
