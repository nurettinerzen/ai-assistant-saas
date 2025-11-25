'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';

export default function SolutionsPage() {
  const solutions = [
    {
      id: 'restaurant',
      icon: '🍽️',
      title: 'Restaurant & Cafe',
      description: 'Automate reservations and customer service',
      benefits: [
        'Automated table booking',
        'Menu inquiries handling',
        'Special requests management',
        'Customer feedback collection'
      ],
      stats: {
        time: '80%',
        calls: '1000+',
        satisfaction: '95%'
      }
    },
    {
      id: 'salon',
      icon: '💇',
      title: 'Salon & Spa',
      description: 'Streamline appointments and customer communication',
      benefits: [
        'Automated appointment booking',
        'Service availability checking',
        'Appointment reminders',
        'Rescheduling management'
      ],
      stats: {
        time: '70%',
        calls: '800+',
        satisfaction: '92%'
      }
    },
    {
      id: 'ecommerce',
      icon: '🛍️',
      title: 'E-commerce',
      description: 'Manage inventory and customer inquiries',
      benefits: [
        'Product availability queries',
        'Order status tracking',
        'Shipping updates',
        'Return processing'
      ],
      stats: {
        time: '85%',
        calls: '2000+',
        satisfaction: '93%'
      }
    },
    {
      id: 'service',
      icon: '🔧',
      title: 'Service Business',
      description: 'Schedule services and manage customer requests',
      benefits: [
        'Service booking automation',
        'Technician scheduling',
        'Emergency request handling',
        'Follow-up management'
      ],
      stats: {
        time: '75%',
        calls: '1500+',
        satisfaction: '94%'
      }
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
              Solutions for
              <span className="gradient-text"> Every Industry</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 animate-fade-in-up">
              Tailored AI solutions designed for your specific business needs
            </p>
          </div>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-32">
            {solutions.map((solution, index) => (
              <div
                key={solution.id}
                id={solution.id}
                className={`flex flex-col ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                } items-center gap-12 animate-fade-in-up`}
              >
                {/* Visual */}
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-400 blur-3xl opacity-20 animate-pulse"></div>
                    <div className="relative glass p-16 rounded-3xl text-center">
                      <span className="text-9xl">{solution.icon}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="glass rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-indigo-600">{solution.stats.time}</div>
                      <div className="text-sm text-gray-600">Time Saved</div>
                    </div>
                    <div className="glass rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">{solution.stats.calls}</div>
                      <div className="text-sm text-gray-600">Calls/Month</div>
                    </div>
                    <div className="glass rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-purple-600">{solution.stats.satisfaction}</div>
                      <div className="text-sm text-gray-600">Satisfaction</div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                  <h2 className="text-4xl font-bold text-gray-900">{solution.title}</h2>
                  <p className="text-xl text-gray-600">{solution.description}</p>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Key Benefits:</h3>
                    <ul className="space-y-3">
                      {solution.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start space-x-3">
                          <svg className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link href="/register">
                    <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                      Get Started
                    </Button>
                  </Link>
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
            <h2 className="text-4xl font-bold mb-6">Don't See Your Industry?</h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Our AI assistants are highly customizable and can be adapted to any business type
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600">
                Contact Us for Custom Solutions
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
