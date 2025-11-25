'use client';

import Navigation from '@/components/Navigation';
import { Hero } from '@/components/Hero';
import { LiveDemoSection } from '@/components/LiveDemoSection';
import { HowItWorks } from '@/components/HowItWorks';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Owner, Bella Restaurant',
      content: 'TELYX.AI transformed our reservation system. We now handle 3x more bookings without adding staff!',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Manager, Urban Cuts Salon',
      content: 'The AI assistant is like having a full-time receptionist. Our customers love the instant responses.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'CEO, ShopTech Online',
      content: 'Inventory management is a breeze now. Real-time updates save us hours every week.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* NEW Hero Section */}
      <Hero />

      {/* NEW Live Demo Section */}
      <LiveDemoSection />

      {/* NEW How It Works Section */}
      <HowItWorks />

      {/* Testimonials Section - KEPT */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Loved by Businesses
              <span className="gradient-text"> Worldwide</span>
            </h2>
            <p className="text-xl text-gray-600">
              See what our customers have to say
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="glass rounded-2xl p-8">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - KEPT */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-blue-500 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
            Join thousands of businesses already using TELYX.AI to automate and scale
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-gray-100 shadow-xl text-lg px-8 py-6">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="glass border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6">
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - KEPT */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold gradient-text mb-4">TELYX.AI</h3>
              <p className="text-gray-400">AI-powered phone assistant for modern businesses</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/solutions" className="hover:text-white">Solutions</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 TELYX.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}