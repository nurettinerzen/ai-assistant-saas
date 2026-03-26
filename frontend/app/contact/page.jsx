'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Mail, Clock, Send, Check, MessageSquare, Shield, Zap, Headphones } from 'lucide-react';

export default function ContactPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    businessType: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
        toast.success(t('contact.successMessage'));
        setFormData({
          name: '',
          email: '',
          company: '',
          phone: '',
          businessType: '',
          message: ''
        });
      } else {
        toast.error(t('contact.errorMessage'));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('contact.errorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const highlights = [
    {
      icon: Zap,
      titleKey: 'contact.highlights.setup.title',
      descKey: 'contact.highlights.setup.desc',
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: MessageSquare,
      titleKey: 'contact.highlights.channels.title',
      descKey: 'contact.highlights.channels.desc',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Shield,
      titleKey: 'contact.highlights.security.title',
      descKey: 'contact.highlights.security.desc',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Headphones,
      titleKey: 'contact.highlights.support.title',
      descKey: 'contact.highlights.support.desc',
      color: 'from-violet-500 to-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight mb-6 text-gray-900 dark:text-white"
            >
              {t('contact.hero.title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base sm:text-xl text-gray-600 dark:text-neutral-400"
            >
              {t('contact.hero.subtitle')}
            </motion.p>
          </div>
        </div>
      </section>

      {/* Why Telyx - Highlight Cards */}
      <section className="pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {highlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.titleKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
                >
                  <Card className="p-5 rounded-2xl text-center h-full bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 hover:shadow-md transition-shadow">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                      {t(item.descKey)}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="p-8 rounded-2xl bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700">
                <h2 className="text-2xl font-medium mb-6 text-gray-900 dark:text-white">{t('contact.form.title')}</h2>

                {submitted && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-300 flex items-center gap-2">
                    <Check className="h-5 w-5 flex-shrink-0" />
                    <span>{t('contact.form.success')}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">{t('contact.form.name')} *</Label>
                      <Input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-2"
                        placeholder={t('contact.form.namePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">{t('contact.form.email')} *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-2"
                        placeholder={t('contact.form.emailPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company">{t('contact.form.company')}</Label>
                      <Input
                        id="company"
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="mt-2"
                        placeholder={t('contact.form.companyPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t('contact.form.phone')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-2"
                        placeholder={t('contact.form.phonePlaceholder')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="businessType">{t('contact.form.businessType')}</Label>
                    <select
                      id="businessType"
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">{t('contact.form.selectType')}</option>
                      <option value="ecommerce">{t('contact.form.types.ecommerce')}</option>
                      <option value="restaurant">{t('contact.form.types.restaurant')}</option>
                      <option value="salon">{t('contact.form.types.salon')}</option>
                      <option value="service">{t('contact.form.types.service')}</option>
                      <option value="other">{t('contact.form.types.other')}</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="message">{t('contact.form.message')} *</Label>
                    <textarea
                      id="message"
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t('contact.form.messagePlaceholder')}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-primary text-white hover:bg-primary/90"
                    size="lg"
                  >
                    {loading ? (
                      t('common.loading')
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('contact.form.submit')}
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </motion.div>

            {/* Right Column - Info + Trust */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Contact Info */}
              <Card className="p-8 rounded-2xl bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700">
                <h3 className="text-xl font-medium mb-6 text-gray-900 dark:text-white">{t('contact.info.title')}</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">{t('contact.info.email')}</h4>
                      <a href="mailto:info@telyx.ai" className="text-gray-600 dark:text-neutral-400 hover:text-primary">
                        info@telyx.ai
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">{t('contact.info.hours')}</h4>
                      <p className="text-gray-600 dark:text-neutral-400">{t('contact.info.hoursValue')}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Trust Stats */}
              <Card className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 dark:from-neutral-800 dark:to-neutral-800 border-0">
                <h3 className="text-xl font-medium mb-6 text-white">{t('contact.trust.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white/10 rounded-xl">
                    <div className="text-2xl font-bold text-white mb-1">%85</div>
                    <p className="text-xs text-blue-200">{t('contact.trust.stat1')}</p>
                  </div>
                  <div className="text-center p-4 bg-white/10 rounded-xl">
                    <div className="text-2xl font-bold text-white mb-1">7/24</div>
                    <p className="text-xs text-blue-200">{t('contact.trust.stat2')}</p>
                  </div>
                  <div className="text-center p-4 bg-white/10 rounded-xl">
                    <div className="text-2xl font-bold text-white mb-1">1.8s</div>
                    <p className="text-xs text-blue-200">{t('contact.trust.stat3')}</p>
                  </div>
                  <div className="text-center p-4 bg-white/10 rounded-xl">
                    <div className="text-2xl font-bold text-white mb-1">4x</div>
                    <p className="text-xs text-blue-200">{t('contact.trust.stat4')}</p>
                  </div>
                </div>
              </Card>

              {/* Testimonial / Social Proof */}
              <Card className="p-6 rounded-2xl bg-gray-50 dark:bg-neutral-800/50 border-gray-100 dark:border-neutral-700">
                <p className="text-sm italic text-gray-600 dark:text-neutral-400 leading-relaxed mb-4">
                  &ldquo;{t('contact.testimonial.quote')}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    T
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('contact.testimonial.name')}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-500">{t('contact.testimonial.role')}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
