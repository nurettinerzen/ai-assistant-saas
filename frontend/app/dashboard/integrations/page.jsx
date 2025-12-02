/**
 * Integrations Page
 * Manage third-party integrations (Stripe, Zapier, etc.)
 * 🔧 BUG FIX 4: Sektöre göre entegrasyonlar göster
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { Puzzle, Check, ExternalLink, Star } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

// 🔧 Sektöre göre önerilen entegrasyonlar
const INDUSTRY_INTEGRATIONS = {
  RESTAURANT: ['calendly', 'google-calendar', 'whatsapp', 'google-sheets'],
  SALON: ['calendly', 'google-calendar', 'whatsapp', 'google-sheets'],
  ECOMMERCE: ['hubspot', 'zapier', 'google-sheets', 'stripe'],
  SERVICE: ['calendly', 'hubspot', 'google-calendar', 'zapier'],
  OTHER: ['zapier', 'google-sheets', 'google-calendar', 'calendly']
};

const AVAILABLE_INTEGRATIONS = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    category: 'paymentsCategory',
    docsUrl: 'https://stripe.com/docs',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: '⚡',
    category: 'automationCategory',
    docsUrl: 'https://zapier.com',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    category: 'communicationCategory',
    docsUrl: 'https://slack.com/api',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🎯',
    category: 'crmCategory',
    docsUrl: 'https://developers.hubspot.com',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    category: 'crmCategory',
    docsUrl: 'https://developer.salesforce.com',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    icon: '📅',
    category: 'schedulingCategory',
    docsUrl: 'https://developer.calendly.com',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: '🗓️',
    category: 'schedulingCategory',
    docsUrl: 'https://developers.google.com/calendar',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    icon: '📊',
    category: 'crmCategory',
    docsUrl: 'https://developers.google.com/sheets',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: '📱',
    category: 'communicationCategory',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
  },
];

export default function IntegrationsPage() {
  const { t } = useLanguage();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState('OTHER');

  useEffect(() => {
    loadBusinessInfo();
    loadIntegrations();
  }, []);

  // 🔧 Load business type
  const loadBusinessInfo = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        const response = await apiClient.business.get(user.businessId);
        const type = response.data.business?.businessType || 'OTHER';
        setBusinessType(type);
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
    }
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.integrations.getAll();
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      toast.error(t('dashboard.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integrationId) => {
    try {
      // OAuth integrations
      if (['calendly', 'google-calendar', 'hubspot', 'google-sheets'].includes(integrationId)) {
        const response = await apiClient.get(`/integrations/${integrationId}/auth`);
        window.location.href = response.data.authUrl;
        return;
      }

      // Other integrations
      await toastHelpers.async(
        apiClient.integrations.connect(integrationId, {}),
        t('dashboard.connectingText'),
        t('dashboard.integrationConnected')
      );
      loadIntegrations();
    } catch (error) {
      // Error handled
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!confirm(t('dashboard.disconnectConfirm'))) return;

    try {
      await toastHelpers.async(
        apiClient.integrations.disconnect(integrationId),
        t('dashboard.disconnectingText'),
        t('dashboard.integrationDisconnected')
      );
      loadIntegrations();
    } catch (error) {
      // Error handled
    }
  };

  const handleTest = async (integrationId) => {
    try {
      await toastHelpers.async(
        apiClient.integrations.test(integrationId),
        t('dashboard.testingConnection'),
        t('dashboard.integrationWorking')
      );
    } catch (error) {
      // Error handled
    }
  };

  const isConnected = (integrationId) => {
    return integrations.some((i) => i.provider === integrationId && i.connected);
  };

  // 🔧 Check if integration is recommended for this business
  const isRecommended = (integrationId) => {
    const recommended = INDUSTRY_INTEGRATIONS[businessType] || [];
    return recommended.includes(integrationId);
  };

  // 🔧 Sort: recommended first, then alphabetically
  const sortedIntegrations = [...AVAILABLE_INTEGRATIONS].sort((a, b) => {
    const aRecommended = isRecommended(a.id);
    const bRecommended = isRecommended(b.id);
    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;
    return a.name.localeCompare(b.name);
  });

  const getDescription = (id) => {
    const descMap = {
      stripe: 'stripeDesc2',
      zapier: 'zapierDesc2',
      slack: 'slackDesc',
      hubspot: 'hubspotDesc2',
      salesforce: 'salesforceDesc',
      calendly: 'calendlyDesc',
      'google-calendar': 'googleCalendarDesc',
      'google-sheets': 'Basit CRM olarak kullanın - aramaları otomatik kaydedin',
      whatsapp: 'whatsappDesc',
    };
    return t(descMap[id] || '', locale) || descMap[id];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.integrationsTitle2')}</h1>
        <p className="text-neutral-600 mt-1">
          {t('dashboard.connectTelyx')}
        </p>
        {/* Business type indicator */}
        {businessType && (
          <p className="text-sm text-primary-600 mt-2">
            📌 {t('dashboard.industry')}: {t(`industry${businessType.charAt(0) + businessType.slice(1).toLowerCase()}`, locale)}
          </p>
        )}
      </div>

      {/* Integrations grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse"
            >
              <div className="h-12 w-12 bg-neutral-200 rounded-lg mb-4"></div>
              <div className="h-6 w-32 bg-neutral-200 rounded mb-2"></div>
              <div className="h-4 w-full bg-neutral-200 rounded mb-1"></div>
              <div className="h-4 w-2/3 bg-neutral-200 rounded mb-4"></div>
              <div className="h-10 w-full bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedIntegrations.map((integration) => {
            const connected = isConnected(integration.id);
            const recommended = isRecommended(integration.id);
            return (
              <div
                key={integration.id}
                className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
                  recommended ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{integration.icon}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900">{integration.name}</h3>
                        {recommended && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {t(integration.category, locale)}
                      </Badge>
                    </div>
                  </div>
                  {connected && (
                    <div className="p-1 bg-green-100 rounded-full">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>

                {recommended && (
                  <div className="mb-3 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-md inline-block">
                    ⭐ {t('dashboard.recommendedForYou') || 'Sizin için önerilen'}
                  </div>
                )}

                <p className="text-sm text-neutral-600 mb-4">{getDescription(integration.id)}</p>

                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleTest(integration.id)}
                      >
                        {t('dashboard.testBtn2')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        {t('dashboard.disconnectBtn')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConnect(integration.id)}
                    >
                      {t('dashboard.connectBtn')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={integration.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          {t('dashboard.needCustomIntegration')}
        </h3>
        <p className="text-sm text-primary-700 mb-3">
          {t('dashboard.customIntegrationDesc')}
        </p>
        <Button variant="outline" size="sm">
          {t('dashboard.contactSalesBtn')}
        </Button>
      </div>
    </div>
  );
}
