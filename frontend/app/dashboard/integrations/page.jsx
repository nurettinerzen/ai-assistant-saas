/**
 * Integrations Page
 * Manage third-party integrations with business type-based filtering
 * Shows relevant integrations based on business model (Restaurant, E-commerce, Clinic, Salon, etc.)
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
  Smartphone,
  ShoppingCart,
  Utensils,
  Scissors,
  Stethoscope,
  Package,
  Mail,
  Hash,
  Inbox,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

// Icon mapping for integrations
const INTEGRATION_ICONS = {
  GOOGLE_CALENDAR: CalendarDays,
  WHATSAPP: Smartphone,
  CALENDLY: Calendar,
  SHOPIFY: ShoppingCart,
  WOOCOMMERCE: ShoppingCart,
  STRIPE_PAYMENTS: CreditCard,
  SQUARE: CreditCard,
  OPENTABLE: Utensils,
  TOAST_POS: Utensils,
  SIMPLEPRACTICE: Stethoscope,
  ZOCDOC: Stethoscope,
  BOOKSY: Scissors,
  FRESHA: Scissors,
  SHIPSTATION: Package,
  KLAVIYO: Mail,
  MAILCHIMP: Mail,
  HUBSPOT: Target,
  SALESFORCE: Cloud,
  GOOGLE_SHEETS: BarChart3,
  ZAPIER: Zap,
  SLACK: MessageSquare,
  TWILIO_SMS: MessageSquare,
  SENDGRID_EMAIL: Mail,
  CUSTOM: Hash
};

// Color mapping for categories
const CATEGORY_COLORS = {
  scheduling: { icon: 'text-blue-600', bg: 'bg-blue-100' },
  communication: { icon: 'text-green-600', bg: 'bg-green-100' },
  payments: { icon: 'text-purple-600', bg: 'bg-purple-100' },
  ecommerce: { icon: 'text-orange-600', bg: 'bg-orange-100' },
  reservations: { icon: 'text-red-600', bg: 'bg-red-100' },
  pos: { icon: 'text-yellow-600', bg: 'bg-yellow-100' },
  healthcare: { icon: 'text-teal-600', bg: 'bg-teal-100' },
  booking: { icon: 'text-pink-600', bg: 'bg-pink-100' },
  shipping: { icon: 'text-indigo-600', bg: 'bg-indigo-100' },
  marketing: { icon: 'text-rose-600', bg: 'bg-rose-100' },
  crm: { icon: 'text-cyan-600', bg: 'bg-cyan-100' },
  data: { icon: 'text-emerald-600', bg: 'bg-emerald-100' },
  automation: { icon: 'text-amber-600', bg: 'bg-amber-100' }
};

// Documentation URLs
const INTEGRATION_DOCS = {
  GOOGLE_CALENDAR: 'https://developers.google.com/calendar',
  WHATSAPP: 'https://developers.facebook.com/docs/whatsapp',
  CALENDLY: 'https://developer.calendly.com',
  SHOPIFY: 'https://shopify.dev',
  WOOCOMMERCE: 'https://woocommerce.com/documentation',
  STRIPE_PAYMENTS: 'https://stripe.com/docs',
  SQUARE: 'https://developer.squareup.com',
  OPENTABLE: 'https://platform.opentable.com',
  TOAST_POS: 'https://doc.toasttab.com',
  SIMPLEPRACTICE: 'https://developers.simplepractice.com',
  ZOCDOC: 'https://www.zocdoc.com/about/developers',
  BOOKSY: 'https://developers.booksy.com',
  FRESHA: 'https://www.fresha.com/developers',
  SHIPSTATION: 'https://www.shipstation.com/docs/api',
  KLAVIYO: 'https://developers.klaviyo.com',
  MAILCHIMP: 'https://mailchimp.com/developer',
  HUBSPOT: 'https://developers.hubspot.com',
  SALESFORCE: 'https://developer.salesforce.com',
  GOOGLE_SHEETS: 'https://developers.google.com/sheets',
  ZAPIER: 'https://zapier.com/developer',
  SLACK: 'https://api.slack.com',
  TWILIO_SMS: 'https://www.twilio.com/docs/sms',
  SENDGRID_EMAIL: 'https://docs.sendgrid.com'
};

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

  // Email integration state
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    loadIntegrations();
    loadWhatsAppStatus();
    loadEmailStatus();
  }, []);

  // Load Email connection status
  const loadEmailStatus = async () => {
    try {
      const response = await apiClient.get('/api/email/status');
      setEmailStatus(response.data);
    } catch (error) {
      console.error('Failed to load email status:', error);
    }
  };

  // Handle Gmail connection
  const handleGmailConnect = async () => {
    try {
      setEmailLoading(true);
      const response = await apiClient.get('/api/email/gmail/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to connect Gmail';
      toast.error(errorMsg);
      setEmailLoading(false);
    }
  };

  // Handle Outlook connection
  const handleOutlookConnect = async () => {
    try {
      setEmailLoading(true);
      const response = await apiClient.get('/api/email/outlook/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to connect Outlook';
      toast.error(errorMsg);
      setEmailLoading(false);
    }
  };

  // Handle Email disconnection
  const handleEmailDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your email?')) return;

    try {
      setEmailLoading(true);
      await apiClient.post('/api/email/disconnect');
      toast.success('Email disconnected successfully');
      await loadEmailStatus();
    } catch (error) {
      toast.error('Failed to disconnect email');
    } finally {
      setEmailLoading(false);
    }
  };

  // Load available integrations (filtered by business type)
  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/integrations/available');
      setIntegrations(response.data.integrations || []);
      setBusinessType(response.data.businessType || 'OTHER');
    } catch (error) {
      console.error('Failed to load integrations:', error);
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

  const handleConnect = async (integration) => {
    try {
      // WhatsApp - Show modal
      if (integration.type === 'WHATSAPP') {
        setWhatsappModalOpen(true);
        return;
      }

      // OAuth integrations
      if (integration.type === 'GOOGLE_CALENDAR') {
        const response = await apiClient.get('/api/calendar/google/auth');
        window.location.href = response.data.authUrl;
        return;
      }

      // Other OAuth integrations
      const oauthIntegrations = ['CALENDLY', 'HUBSPOT', 'GOOGLE_SHEETS', 'SALESFORCE'];
      if (oauthIntegrations.includes(integration.type)) {
        const integrationId = integration.type.toLowerCase().replace('_', '-');
        const response = await apiClient.get(`/integrations/${integrationId}/auth`);
        window.location.href = response.data.authUrl;
        return;
      }

      // Other integrations - show coming soon
      toast.info(`${integration.name} integration coming soon!`);
    } catch (error) {
      toast.error('Failed to connect integration');
    }
  };

  const handleDisconnect = async (integration) => {
    if (!confirm(t('disconnectConfirm'))) return;

    try {
      if (integration.type === 'WHATSAPP') {
        await handleWhatsAppDisconnect();
      } else {
        const integrationId = integration.type.toLowerCase().replace('_', '-');
        await toastHelpers.async(
          apiClient.integrations.disconnect(integrationId),
          t('disconnectingText'),
          t('integrationDisconnected')
        );
        loadIntegrations();
      }
    } catch (error) {
      // Error handled
    }
  };

  const handleTest = async (integration) => {
    try {
      const integrationId = integration.type.toLowerCase().replace('_', '-');
      await toastHelpers.async(
        apiClient.integrations.test(integrationId),
        t('testingConnection'),
        t('integrationWorking')
      );
    } catch (error) {
      // Error handled
    }
  };

  // Get icon component for integration
  const getIntegrationIcon = (type) => {
    return INTEGRATION_ICONS[type] || Hash;
  };

  // Get color scheme for category
  const getCategoryColors = (category) => {
    return CATEGORY_COLORS[category] || { icon: 'text-neutral-600', bg: 'bg-neutral-100' };
  };

  // Get documentation URL
  const getDocsUrl = (type) => {
    return INTEGRATION_DOCS[type] || '#';
  };

  // Get business type display name
  const getBusinessTypeDisplay = (type) => {
    const typeMap = {
      RESTAURANT: 'Restaurant',
      SALON: 'Salon/Spa',
      ECOMMERCE: 'E-commerce',
      CLINIC: 'Clinic/Healthcare',
      SERVICE: 'Service Business',
      OTHER: 'General'
    };
    return typeMap[type] || type;
  };

  // Group integrations by priority
  const groupedIntegrations = {
    ESSENTIAL: integrations.filter(i => i.priority === 'ESSENTIAL'),
    RECOMMENDED: integrations.filter(i => i.priority === 'RECOMMENDED'),
    OPTIONAL: integrations.filter(i => i.priority === 'OPTIONAL')
  };

  // Render integration card
  const renderIntegrationCard = (integration) => {
    const Icon = getIntegrationIcon(integration.type);
    const colors = getCategoryColors(integration.category);
    const docsUrl = getDocsUrl(integration.type);

    return (
      <div
        key={integration.type}
        className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
          integration.priority === 'ESSENTIAL'
            ? 'border-primary-300 bg-primary-50/30'
            : 'border-neutral-200'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${colors.bg}`}>
              <Icon className={`h-6 w-6 ${colors.icon}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900">{integration.name}</h3>
                {integration.priority === 'ESSENTIAL' && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <Badge variant="secondary" className="text-xs mt-1">
                {integration.category}
              </Badge>
            </div>
          </div>
          {integration.connected && (
            <div className="p-1 bg-green-100 rounded-full">
              <Check className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>

        {/* Priority Badge */}
        {integration.priority === 'ESSENTIAL' && (
          <div className="mb-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-blue-700" />
            Essential for your business
          </div>
        )}
        {integration.priority === 'RECOMMENDED' && (
          <div className="mb-3 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Recommended for you
          </div>
        )}

        {/* Category-specific description */}
        <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
          {getCategoryDescription(integration.type, integration.category)}
        </p>

        <div className="flex gap-2">
          {integration.connected ? (
            <>
              {integration.type === 'WHATSAPP' && whatsappStatus?.phoneNumberId && (
                <div className="flex-1 text-xs text-neutral-600 mb-2">
                  Phone ID: {whatsappStatus.phoneNumberId.substring(0, 15)}...
                </div>
              )}
              {integration.type !== 'WHATSAPP' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTest(integration)}
                >
                  Test
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect(integration)}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleConnect(integration)}
            >
              Connect
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Integrations</h1>
        <p className="text-neutral-600 mt-1">
          Connect your tools and platforms to enhance your AI assistant
        </p>
        {/* Business type indicator */}
        {businessType && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Target className="h-4 w-4 mr-1" />
              {getBusinessTypeDisplay(businessType)} Business
            </Badge>
            <p className="text-xs text-neutral-500">
              Showing integrations optimized for your business type
            </p>
          </div>
        )}
      </div>

      {/* Email Channel Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-600" />
            Email Channel
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            Connect your email to let AI assist with customer emails
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gmail Card */}
          <div className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
            emailStatus?.connected && emailStatus?.provider === 'GMAIL'
              ? 'border-green-300 bg-green-50/30'
              : 'border-neutral-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Gmail</h3>
                  <Badge variant="secondary" className="text-xs mt-1">
                    Email Channel
                  </Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'GMAIL' && (
                <div className="p-1 bg-green-100 rounded-full">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
            </div>

            <p className="text-sm text-neutral-600 mb-4">
              Connect your Gmail account to let AI handle customer emails with draft responses for your review.
            </p>

            {emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.location.href = '/dashboard/email'}
                  >
                    <Inbox className="h-4 w-4 mr-1" />
                    Open Inbox
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEmailDisconnect}
                    disabled={emailLoading}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={handleGmailConnect}
                disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'GMAIL')}
              >
                {emailLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Gmail'
                )}
              </Button>
            )}
          </div>

          {/* Microsoft 365 / Outlook Card */}
          <div className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
            emailStatus?.connected && emailStatus?.provider === 'OUTLOOK'
              ? 'border-green-300 bg-green-50/30'
              : 'border-neutral-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.16.154-.353.231-.584.231h-8.462v-6.462H24v-4.823zm-10.154 4.59v6.695H1.231V7.387h12.615v4.59zm0-11.039v5.449H0V.938h13.846zm10.154 0v5.449h-9.231V.938h9.231z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Microsoft 365</h3>
                  <Badge variant="secondary" className="text-xs mt-1">
                    Email Channel
                  </Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' && (
                <div className="p-1 bg-green-100 rounded-full">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
            </div>

            <p className="text-sm text-neutral-600 mb-4">
              Connect your Outlook/Microsoft 365 account for AI-assisted email management.
            </p>

            {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connected: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.location.href = '/dashboard/email'}
                  >
                    <Inbox className="h-4 w-4 mr-1" />
                    Open Inbox
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEmailDisconnect}
                    disabled={emailLoading}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={handleOutlookConnect}
                disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'OUTLOOK')}
              >
                {emailLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Outlook'
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Note about email integration */}
        {emailStatus?.connected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> When customers email you, our AI will read the message and create a draft response. You can review, edit, and send from your Email Inbox dashboard.
            </p>
          </div>
        )}
      </div>

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
        <>
          {/* Essential Integrations */}
          {groupedIntegrations.ESSENTIAL.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Essential Integrations
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Core integrations critical for your business type
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.ESSENTIAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Recommended Integrations */}
          {groupedIntegrations.RECOMMENDED.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Recommended Integrations
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Popular integrations that complement your workflow
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.RECOMMENDED.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Optional Integrations */}
          {groupedIntegrations.OPTIONAL.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  More Integrations
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Additional integrations you can explore
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.OPTIONAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Empty state */}
          {integrations.length === 0 && (
            <EmptyState
              icon={Puzzle}
              title="No integrations available"
              description="Contact support to enable custom integrations for your business"
            />
          )}
        </>
      )}

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          Need a custom integration?
        </h3>
        <p className="text-sm text-primary-700 mb-3">
          We can build custom integrations for your specific tools and workflows.
          Contact our sales team to discuss your requirements.
        </p>
        <Button variant="outline" size="sm">
          Contact Sales
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

// Helper function to get category descriptions
function getCategoryDescription(type, category) {
  const descriptions = {
    GOOGLE_CALENDAR: 'Sync appointments and manage your schedule seamlessly',
    WHATSAPP: 'AI-powered customer conversations via WhatsApp Business API',
    CALENDLY: 'Automated appointment scheduling and booking',
    SHOPIFY: 'Connect your Shopify store for order management',
    WOOCOMMERCE: 'Integrate your WooCommerce store for seamless operations',
    STRIPE_PAYMENTS: 'Secure payment processing and transaction management',
    SQUARE: 'Accept payments and manage your point of sale',
    OPENTABLE: 'Manage restaurant reservations from OpenTable',
    TOAST_POS: 'Restaurant point of sale and order management',
    SIMPLEPRACTICE: 'Practice management for healthcare professionals',
    ZOCDOC: 'Patient booking and scheduling platform',
    BOOKSY: 'Salon and spa booking platform integration',
    FRESHA: 'Beauty and wellness booking management',
    SHIPSTATION: 'Shipping and fulfillment automation',
    KLAVIYO: 'Email marketing and customer engagement',
    MAILCHIMP: 'Email campaigns and marketing automation',
    HUBSPOT: 'CRM and marketing automation platform',
    SALESFORCE: 'Enterprise CRM and customer management',
    GOOGLE_SHEETS: 'Use as a simple CRM - auto-save call logs',
    ZAPIER: 'Connect thousands of apps with automation',
    SLACK: 'Team communication and notifications',
    TWILIO_SMS: 'SMS notifications and messaging',
    SENDGRID_EMAIL: 'Email delivery and transactional emails'
  };
  return descriptions[type] || `${category} integration`;
}
