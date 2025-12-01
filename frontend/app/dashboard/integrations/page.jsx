/**
 * Integrations Page
 * Manage third-party integrations (Stripe, Zapier, etc.)
 * UPDATE EXISTING FILE: frontend/app/dashboard/integrations/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { Puzzle, Check, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { t, getCurrentLanguage } from '@/lib/translations';

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
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(getCurrentLanguage());
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.integrations.getAll();
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      toast.error(t('saveError', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integrationId) => {
    try {
      await toastHelpers.async(
        apiClient.integrations.connect(integrationId, {}),
        t('connectingText', locale),
        t('integrationConnected', locale)
      );
      loadIntegrations();
    } catch (error) {
      // Error handled
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!confirm(t('disconnectConfirm', locale))) return;

    try {
      await toastHelpers.async(
        apiClient.integrations.disconnect(integrationId),
        t('disconnectingText', locale),
        t('integrationDisconnected', locale)
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
        t('testingConnection', locale),
        t('integrationWorking', locale)
      );
    } catch (error) {
      // Error handled
    }
  };

  const isConnected = (integrationId) => {
    return integrations.some((i) => i.provider === integrationId && i.connected);
  };

  const getDescription = (id) => {
    const descMap = {
      stripe: 'stripeDesc2',
      zapier: 'zapierDesc2',
      slack: 'slackDesc',
      hubspot: 'hubspotDesc2',
      salesforce: 'salesforceDesc',
      calendly: 'calendlyDesc',
    };
    return t(descMap[id] || '', locale);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('integrationsTitle2', locale)}</h1>
        <p className="text-neutral-600 mt-1">
          {t('connectTelyx', locale)}
        </p>
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
          {AVAILABLE_INTEGRATIONS.map((integration) => {
            const connected = isConnected(integration.id);
            return (
              <div
                key={integration.id}
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{integration.icon}</div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">{integration.name}</h3>
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
                        {t('testBtn2', locale)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        {t('disconnectBtn', locale)}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConnect(integration.id)}
                    >
                      {t('connectBtn', locale)}
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
          {t('needCustomIntegration', locale)}
        </h3>
        <p className="text-sm text-primary-700 mb-3">
          {t('customIntegrationDesc', locale)}
        </p>
        <Button variant="outline" size="sm">
          {t('contactSalesBtn', locale)}
        </Button>
      </div>
    </div>
  );
}
