/**
 * Integrations Page
 * Manage third-party integrations (Stripe, Zapier, etc.)
 * BUG FIX 4: Sektöre göre entegrasyonlar göster
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/EmptyState';
import {
  Puzzle,
  Check,
  ExternalLink,
  Star,
  Copy,
  CheckCircle2,
  CreditCard,
  Zap,
  MessageSquare,
  Target,
  Cloud,
  Calendar,
  CalendarDays,
  BarChart3,
  Smartphone
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

// Sektöre göre önerilen entegrasyonlar
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
    icon: CreditCard,
    category: 'paymentsCategory',
    docsUrl: 'https://stripe.com/docs',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: Zap,
    category: 'automationCategory',
    docsUrl: 'https://zapier.com',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    category: 'communicationCategory',
    docsUrl: 'https://slack.com/api',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: Target,
    category: 'crmCategory',
    docsUrl: 'https://developers.hubspot.com',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: Cloud,
    category: 'crmCategory',
    docsUrl: 'https://developer.salesforce.com',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    icon: Calendar,
    category: 'schedulingCategory',
    docsUrl: 'https://developer.calendly.com',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: CalendarDays,
    category: 'schedulingCategory',
    docsUrl: 'https://developers.google.com/calendar',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    icon: BarChart3,
    category: 'crmCategory',
    docsUrl: 'https://developers.google.com/sheets',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: Smartphone,
    category: 'communicationCategory',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
];

export default function IntegrationsPage() {
  const { t } = useLanguage();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState('OTHER');

  // WhatsApp connection state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({
    accessToken: '',
    phoneNumberId: '',
    verifyToken: ''
  });

  useEffect(() => {
    loadBusinessInfo();
    loadIntegrations();
    loadWhatsAppStatus();
  }, []);

  // Load business type
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
      toast.error(t('saveError'));
    } finally {
      setLoading(false);
    }
  };

  // Load WhatsApp connection status
  const loadWhatsAppStatus = async () => {
    try {
      const response = await apiClient.get('/api/integrations/whatsapp/status');
      setWhatsappStatus(response.data);
    } catch (error) {
      console.error('Failed to load WhatsApp status:', error);
    }
  };

  // Handle WhatsApp connection
  const handleWhatsAppConnect = async () => {
    if (!whatsappForm.accessToken || !whatsappForm.phoneNumberId || !whatsappForm.verifyToken) {
      toast.error('Please fill in all fields');
      return;
    }

    setWhatsappLoading(true);
    try {
      const response = await apiClient.post('/api/integrations/whatsapp/connect', whatsappForm);

      if (response.data.success) {
        toast.success('WhatsApp connected successfully!');
        setWhatsappModalOpen(false);
        setWhatsappForm({
          accessToken: '',
          phoneNumberId: '',
          verifyToken: ''
        });
        await loadWhatsAppStatus();
        await loadIntegrations();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to connect WhatsApp';
      toast.error(errorMsg);
    } finally {
      setWhatsappLoading(false);
    }
  };

  // Handle WhatsApp disconnection
  const handleWhatsAppDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/integrations/whatsapp/disconnect'),
        'Disconnecting WhatsApp...',
        'WhatsApp disconnected successfully'
      );
      await loadWhatsAppStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = () => {
    if (whatsappStatus?.webhookUrl) {
      navigator.clipboard.writeText(whatsappStatus.webhookUrl);
      toast.success('Webhook URL copied to clipboard!');
    }
  };

  const handleConnect = async (integrationId) => {
    try {
      // WhatsApp - Show modal
      if (integrationId === 'whatsapp') {
        setWhatsappModalOpen(true);
        return;
      }

      // OAuth integrations
      if (integrationId === 'google-calendar') {
        const response = await apiClient.get(`/api/calendar/google/auth`);
        window.location.href = response.data.authUrl;
        return;
      }

      // Other OAuth integrations
      if (['calendly', 'hubspot', 'google-sheets'].includes(integrationId)) {
        const response = await apiClient.get(`/integrations/${integrationId}/auth`);
        window.location.href = response.data.authUrl;
        return;
      }

      // Other integrations
      await toastHelpers.async(
        apiClient.integrations.connect(integrationId, {}),
        t('connectingText'),
        t('integrationConnected')
      );
      loadIntegrations();
    } catch (error) {
      // Error handled
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!confirm(t('disconnectConfirm'))) return;

    try {
      await toastHelpers.async(
        apiClient.integrations.disconnect(integrationId),
        t('disconnectingText'),
        t('integrationDisconnected')
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
        t('testingConnection'),
        t('integrationWorking')
      );
    } catch (error) {
      // Error handled
    }
  };

  const isConnected = (integrationId) => {
    // Special handling for WhatsApp
    if (integrationId === 'whatsapp') {
      return whatsappStatus?.connected || false;
    }
    return integrations.some((i) => i.provider === integrationId && i.connected);
  };

  // Check if integration is recommended for this business
  const isRecommended = (integrationId) => {
    const recommended = INDUSTRY_INTEGRATIONS[businessType] || [];
    return recommended.includes(integrationId);
  };

  // Sort: recommended first, then alphabetically
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
    return t(descMap[id] || '') || descMap[id];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('integrationsTitle2')}</h1>
        <p className="text-neutral-600 mt-1">
          {t('connectTelyx')}
        </p>
        {/* Business type indicator */}
        {businessType && (
          <p className="text-sm text-primary-600 mt-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t('industry')}: {t(`industry${businessType.charAt(0) + businessType.slice(1).toLowerCase()}`)}
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
                    <div className={`p-3 rounded-lg ${integration.bgColor}`}>
                      <integration.icon className={`h-6 w-6 ${integration.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900">{integration.name}</h3>
                        {recommended && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {t(integration.category)}
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
                  <div className="mb-3 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-md inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-primary-700" />
                    {t('recommendedForYou') || 'Sizin için önerilen'}
                  </div>
                )}

                <p className="text-sm text-neutral-600 mb-4">{getDescription(integration.id)}</p>

                <div className="flex gap-2">
                  {connected ? (
                    <>
                      {integration.id === 'whatsapp' && whatsappStatus?.phoneNumberId && (
                        <div className="flex-1 text-xs text-neutral-600 mb-2">
                          Phone ID: {whatsappStatus.phoneNumberId.substring(0, 15)}...
                        </div>
                      )}
                      {integration.id !== 'whatsapp' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleTest(integration.id)}
                        >
                          {t('testBtn2')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => integration.id === 'whatsapp' ? handleWhatsAppDisconnect() : handleDisconnect(integration.id)}
                      >
                        {t('disconnectBtn')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConnect(integration.id)}
                    >
                      {t('connectBtn')}
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
          {t('needCustomIntegration')}
        </h3>
        <p className="text-sm text-primary-700 mb-3">
          {t('customIntegrationDesc')}
        </p>
        <Button variant="outline" size="sm">
          {t('contactSalesBtn')}
        </Button>
      </div>

      {/* WhatsApp Connection Modal */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Business API</DialogTitle>
            <DialogDescription>
              Connect your WhatsApp Business API to enable AI-powered conversations with your customers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Setup Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-3">Setup Instructions:</h4>
              <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
                <li>Go to <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">Meta Business Suite</a></li>
                <li>Navigate to WhatsApp API Settings</li>
                <li>Create a permanent access token</li>
                <li>Copy your Phone Number ID</li>
                <li>Create a verify token (any secure random string)</li>
                <li>Configure the webhook URL shown below</li>
              </ol>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Enter your WhatsApp access token"
                  value={whatsappForm.accessToken}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, accessToken: e.target.value })}
                />
                <p className="text-xs text-neutral-500">This will be encrypted and stored securely</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                <Input
                  id="phoneNumberId"
                  type="text"
                  placeholder="Enter your phone number ID"
                  value={whatsappForm.phoneNumberId}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumberId: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Found in your WhatsApp Business API settings</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifyToken">Verify Token *</Label>
                <Input
                  id="verifyToken"
                  type="text"
                  placeholder="Create a secure verify token"
                  value={whatsappForm.verifyToken}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, verifyToken: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Use this same token when configuring the webhook in Meta</p>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL (Read-only)</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={whatsappStatus?.webhookUrl || `${window.location.origin}/api/whatsapp/webhook`}
                    className="bg-neutral-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyWebhookUrl}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-neutral-500">
                  Configure this URL in your Meta Business Suite webhook settings
                </p>
              </div>
            </div>

            {/* Connection Status */}
            {whatsappStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Currently Connected</p>
                  <p className="text-xs text-green-700">
                    Phone Number ID: {whatsappStatus.phoneNumberId}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWhatsappModalOpen(false)}
              disabled={whatsappLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWhatsAppConnect}
              disabled={whatsappLoading}
            >
              {whatsappLoading ? 'Connecting...' : 'Connect WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
