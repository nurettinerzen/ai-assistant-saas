/**
 * Integrations Page
 * Manage third-party integrations with business type-based filtering
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
  Puzzle, Check, ExternalLink, Star, Copy, CheckCircle2, CreditCard, Zap,
  MessageSquare, Target, Cloud, Calendar, CalendarDays, BarChart3, Smartphone,
  ShoppingCart, Utensils, Scissors, Stethoscope, Package, Mail, Hash,
  Wallet, Eye, EyeOff, Inbox, RefreshCw, Lock, Info
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import UpgradeModal from '@/components/UpgradeModal';
import {
  getIntegrationFeatureInfo,
  LOCKED_INTEGRATIONS_FOR_BASIC,
  FEATURES
} from '@/lib/features';

// App Logo Components
const GmailLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
  </svg>
);

const OutlookLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M7 14.72V9.28L12 6.5l5 2.78v5.44L12 17.5l-5-2.78z" fill="#0078D4"/>
    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm5 12.72L12 17.5l-5-2.78V9.28L12 6.5l5 2.78v5.44z" fill="#0078D4"/>
  </svg>
);

const ShopifyLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M15.337 2.127c-.141-.019-.29-.019-.413.019-.123.038-2.045.57-2.045.57s-1.319 1.282-1.804 1.767c-.123.122-.256.293-.389.484-.807-.236-1.538-.35-2.119-.35-.913 0-1.196.247-1.423.494-.759.76-1.348 2.35-1.652 3.736-.76.236-1.29.398-1.348.417-.807.227-1.538.455-1.745.683-.228.228-.228.512-.228.76l-.076 12.88c0 .228 0 .493.228.72l1.917 1.918c.228.228.494.228.722.228h13.793c.228 0 .493 0 .722-.228l1.918-1.918c.227-.227.227-.492.227-.72V4.42c0-.228 0-.493-.227-.72l-1.918-1.918c-.114-.114-.304-.228-.493-.228-.095.057-.19.095-.304.133z" fill="#95BF47"/>
  </svg>
);

const GoogleCalendarLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" fill="#4285F4"/>
  </svg>
);

const GoogleSheetsLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" fill="#0F9D58"/>
  </svg>
);

const WhatsAppLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#25D366"/>
  </svg>
);

const IkasLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.33l7 3.5v7.84l-7-3.5V9.33zm16 0v7.84l-7 3.5v-7.84l7-3.5z" fill="#FF6B35"/>
  </svg>
);

const ZapierLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.83L18.17 12 12 18.17 5.83 12 12 5.83z" fill="#FF4A00"/>
  </svg>
);

const INTEGRATION_ICONS = {
  GOOGLE_CALENDAR: GoogleCalendarLogo,
  GOOGLE_SHEETS: GoogleSheetsLogo,
  WHATSAPP: WhatsAppLogo,
  SHOPIFY: ShopifyLogo,
  IKAS: IkasLogo,
  ZAPIER: ZapierLogo,
  CUSTOM: Hash,
  // Fallbacks for other integrations
  CALENDLY: Calendar,
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
  SLACK: MessageSquare,
  TWILIO_SMS: MessageSquare,
  SENDGRID_EMAIL: Mail,
  IYZICO: Wallet,
  NETGSM_SMS: MessageSquare,
  IDEASOFT: ShoppingCart,
  TICIMAX: ShoppingCart,
  CUSTOM_ERP_WEBHOOK: Zap
};

const INTEGRATION_DOCS = {
  GOOGLE_CALENDAR: 'https://developers.google.com/calendar',
  WHATSAPP: 'https://developers.facebook.com/docs/whatsapp',
  SHOPIFY: 'https://shopify.dev',
  WOOCOMMERCE: 'https://woocommerce.com/documentation',
  IYZICO: 'https://dev.iyzipay.com',
  ZAPIER: 'https://zapier.com/developer',
  IKAS: 'https://ikas.dev',
  IDEASOFT: 'https://apidoc.ideasoft.dev',
  TICIMAX: 'https://www.ticimax.com'
};

export default function IntegrationsPage() {
  const { t, locale } = useLanguage();
  const language = locale; // alias for backward compatibility
  const { can, user } = usePermissions();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState('OTHER');

  // User plan for feature visibility
  const [userPlan, setUserPlan] = useState('STARTER');

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  // WhatsApp state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({ accessToken: '', phoneNumberId: '', verifyToken: '' });


  // iyzico state
  const [iyzicoModalOpen, setIyzicoModalOpen] = useState(false);
  const [iyzicoStatus, setIyzicoStatus] = useState(null);
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  const [iyzicoForm, setIyzicoForm] = useState({ apiKey: '', secretKey: '', environment: 'sandbox' });
  const [showIyzicoSecret, setShowIyzicoSecret] = useState(false);

  // Email state
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Shopify state
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyForm, setShopifyForm] = useState({ shopUrl: '' });

  // WooCommerce state - REMOVED (platform no longer supported)

  // Webhook state
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // ikas state
  const [ikasModalOpen, setIkasModalOpen] = useState(false);
  const [ikasStatus, setIkasStatus] = useState(null);
  const [ikasLoading, setIkasLoading] = useState(false);
  const [ikasForm, setIkasForm] = useState({ storeName: '', clientId: '', clientSecret: '' });

  // Ideasoft state - REMOVED (platform no longer supported)
  // Ticimax state - REMOVED (platform no longer supported)

  // Load user plan
  useEffect(() => {
    const loadUserPlan = async () => {
      try {
        const response = await apiClient.get('/api/auth/me');
        const plan = response.data?.business?.subscription?.plan || response.data?.subscription?.plan || response.data?.plan || 'STARTER';
        setUserPlan(plan);
      } catch (error) {
        console.error('Failed to load user plan:', error);
      }
    };
    loadUserPlan();
  }, []);

  useEffect(() => {
    loadIntegrations();
    loadWhatsAppStatus();
    loadIyzicoStatus();
    loadEmailStatus();
    loadShopifyStatus();
    loadWebhookStatus();
    loadIkasStatus();

    // Handle OAuth callback results
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shopifyResult = params.get('shopify');
      const shopName = params.get('shop');
      const errorMessage = params.get('message');
      const success = params.get('success');
      const error = params.get('error');

      if (shopifyResult === 'success') {
        toast.success(`Shopify connected successfully${shopName ? `: ${shopName}` : ''}!`);
        window.history.replaceState({}, '', window.location.pathname);
      } else if (shopifyResult === 'error') {
        toast.error(`Failed to connect Shopify${errorMessage ? `: ${decodeURIComponent(errorMessage)}` : ''}`);
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Google Sheets callback
      if (success === 'google-sheets') {
        toast.success('Google Sheets bağlantısı başarılı!');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (error === 'google-sheets' || error?.startsWith('google-sheets-')) {
        toast.error('Google Sheets bağlantısı başarısız oldu');
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Google Calendar callback
      if (success === 'google-calendar') {
        toast.success('Google Calendar bağlantısı başarılı!');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (error === 'google-calendar') {
        toast.error('Google Calendar bağlantısı başarısız oldu');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Load functions
  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/integrations/available');
      setIntegrations(response.data.integrations || []);
      setBusinessType(response.data.businessType || 'OTHER');
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppStatus = async () => {
    try {
      const response = await apiClient.get('/api/integrations/whatsapp/status');
      setWhatsappStatus(response.data);
    } catch (error) { console.error('Failed to load WhatsApp status:', error); }
  };


  const loadIyzicoStatus = async () => {
    try {
      const response = await apiClient.get('/api/iyzico/status');
      setIyzicoStatus(response.data);
    } catch (error) { console.error('Failed to load iyzico status:', error); }
  };

  const loadEmailStatus = async () => {
    try {
      const response = await apiClient.get('/api/email/status');
      setEmailStatus(response.data);
    } catch (error) { console.error('Failed to load email status:', error); }
  };

  const loadShopifyStatus = async () => {
    try {
      const response = await apiClient.get('/api/shopify/status');
      setShopifyStatus(response.data);
    } catch (error) { console.error('Failed to load Shopify status:', error); }
  };

  // WooCommerce load removed - platform no longer supported

  const loadWebhookStatus = async () => {
    try {
      const response = await apiClient.get('/api/webhook/status');
      setWebhookStatus(response.data);
    } catch (error) { console.error('Failed to load Webhook status:', error); }
  };

  const loadIkasStatus = async () => {
    try {
      const response = await apiClient.get('/api/integrations/ikas/status');
      setIkasStatus(response.data);
    } catch (error) { console.error('Failed to load ikas status:', error); }
  };

  // Ideasoft and Ticimax load removed - platforms no longer supported

  // Handler functions
  const handleGmailConnect = async () => {
    try {
      setEmailLoading(true);
      const response = await apiClient.get('/api/email/gmail/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to connect Gmail');
      setEmailLoading(false);
    }
  };

  const handleOutlookConnect = async () => {
    try {
      setEmailLoading(true);
      const response = await apiClient.get('/api/email/outlook/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to connect Outlook');
      setEmailLoading(false);
    }
  };

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
        setWhatsappForm({ accessToken: '', phoneNumberId: '', verifyToken: '' });
        await loadWhatsAppStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to connect WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleWhatsAppDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    try {
      await apiClient.post('/api/integrations/whatsapp/disconnect');
      toast.success('WhatsApp disconnected');
      await loadWhatsAppStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Failed to disconnect'); }
  };


  const handleIyzicoConnect = async () => {
    if (!iyzicoForm.apiKey || !iyzicoForm.secretKey) {
      toast.error('Please fill in API Key and Secret Key');
      return;
    }
    setIyzicoLoading(true);
    try {
      const response = await apiClient.post('/api/iyzico/connect', iyzicoForm);
      if (response.data.success) {
        toast.success('iyzico connected!');
        setIyzicoModalOpen(false);
        setIyzicoForm({ apiKey: '', secretKey: '', environment: 'sandbox' });
        await loadIyzicoStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to connect iyzico');
    } finally {
      setIyzicoLoading(false);
    }
  };

  const handleIyzicoDisconnect = async () => {
    if (!confirm('Disconnect iyzico?')) return;
    try {
      await apiClient.post('/api/iyzico/disconnect');
      toast.success('iyzico disconnected');
      await loadIyzicoStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Failed to disconnect'); }
  };

const handleShopifyConnect = async () => {
  if (!shopifyForm.shopUrl) {
    toast.error('Please enter your shop URL');
    return;
  }

  setShopifyLoading(true);

  try {
    // Normalize shop URL
    let shopUrl = shopifyForm.shopUrl.trim().toLowerCase();
    shopUrl = shopUrl.replace(/^https?:\/\//, '').split('/')[0];
   if (!shopUrl.includes('.myshopify.com')) {
  shopUrl = shopUrl + '.myshopify.com';
}

    // Get auth URL from backend (with token)
    const response = await apiClient.get(`/api/shopify/auth?shop=${encodeURIComponent(shopUrl)}`);
    
    if (response.data.authUrl) {
      window.location.href = response.data.authUrl;
    } else {
      toast.error(response.data.error || 'Failed to start OAuth');
    }
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to connect');
  } finally {
    setShopifyLoading(false);
  }
};

  const handleShopifyDisconnect = async () => {
    if (!confirm('Disconnect Shopify?')) return;
    try {
      await apiClient.post('/api/shopify/disconnect');
      toast.success('Shopify disconnected');
      await loadShopifyStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Failed to disconnect'); }
  };

  // WooCommerce handlers removed - platform no longer supported

  const handleWebhookSetup = async () => {
    setWebhookLoading(true);
    try {
      const response = await apiClient.post('/api/webhook/setup');
      if (response.data.success) {
        toast.success('Webhook activated!');
        await loadWebhookStatus();
        await loadIntegrations();
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to setup webhook');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleWebhookDisable = async () => {
    if (!confirm('Disable webhook?')) return;
    try {
      await apiClient.post('/api/webhook/disable');
      toast.success('Webhook disabled');
      await loadWebhookStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Failed to disable'); }
  };

  const handleWebhookRegenerate = async () => {
    if (!confirm('Regenerate webhook URL? Current URL will be invalidated.')) return;
    setWebhookLoading(true);
    try {
      const response = await apiClient.post('/api/webhook/regenerate');
      if (response.data.success) {
        toast.success('Webhook URL regenerated!');
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
      }
    } catch (error) {
      toast.error('Failed to regenerate');
    } finally {
      setWebhookLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyWebhookUrl = () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.telyx.ai';
    // Always use production URL, ignore old database values
    const webhookUrl = `${backendUrl}/api/whatsapp/webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success(language === 'tr' ? 'Webhook URL kopyalandı!' : 'Webhook URL copied!');
  };

  // ikas handlers
  const handleIkasConnect = async () => {
    if (!ikasForm.storeName || !ikasForm.clientId || !ikasForm.clientSecret) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    setIkasLoading(true);
    try {
      const response = await apiClient.post('/api/integrations/ikas/connect', ikasForm);
      if (response.data.success) {
        toast.success('ikas bağlandı!');
        setIkasModalOpen(false);
        setIkasForm({ storeName: '', clientId: '', clientSecret: '' });
        await loadIkasStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Bağlantı başarısız');
    } finally {
      setIkasLoading(false);
    }
  };

  // Ideasoft handlers removed - platform no longer supported

  // Ticimax handlers removed - platform no longer supported

  const handleConnect = async (integration) => {
    try {
      if (integration.type === 'WHATSAPP') { setWhatsappModalOpen(true); return; }
      if (integration.type === 'IYZICO') { setIyzicoModalOpen(true); return; }
      if (integration.type === 'SHOPIFY') { setShopifyModalOpen(true); return; }
      if (integration.type === 'ZAPIER') {
        if (!webhookStatus?.configured) await handleWebhookSetup();
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
        setWebhookModalOpen(true);
        return;
      }
      if (integration.type === 'GOOGLE_CALENDAR') {
        const response = await apiClient.get('/api/calendar/google/auth');
        window.location.href = response.data.authUrl;
        return;
      }
      if (integration.type === 'GOOGLE_SHEETS') {
        const response = await apiClient.get('/api/google-sheets/auth-url');
        window.location.href = response.data.authUrl;
        return;
      }
      if (integration.type === 'IKAS') { setIkasModalOpen(true); return; }
      toast.info(`${integration.name} coming soon!`);
    } catch (error) {
      toast.error('Failed to connect');
    }
  };

  const handleDisconnect = async (integration) => {
  if (!confirm('Disconnect this integration?')) return;
  try {
    if (integration.type === 'WHATSAPP') await handleWhatsAppDisconnect();
    else if (integration.type === 'IYZICO') await handleIyzicoDisconnect();
    else if (integration.type === 'SHOPIFY') await handleShopifyDisconnect();
    else if (integration.type === 'ZAPIER') await handleWebhookDisable();
    else if (integration.type === 'GOOGLE_CALENDAR') {
      await apiClient.post('/api/integrations/google-calendar/disconnect');
      toast.success('Google Calendar disconnected');
      await loadIntegrations();
    }
    else if (integration.type === 'GOOGLE_SHEETS') {
      await apiClient.post('/api/integrations/google-sheets/disconnect');
      toast.success('Google Sheets disconnected');
      await loadIntegrations();
    }
    else if (integration.type === 'IKAS') {
      await apiClient.post('/api/integrations/ikas/disconnect');
      toast.success('ikas bağlantısı kesildi');
      await loadIkasStatus();
      await loadIntegrations();
    }
  } catch (error) {
    toast.error('Failed to disconnect');
  }
};

  const handleTest = async (integration) => {
  try {
    if (integration.type === 'GOOGLE_CALENDAR') {
      const response = await apiClient.post('/api/integrations/google-calendar/test');
      if (response.data.success) toast.success('Google Calendar bağlantısı aktif!');
      else toast.error('Test failed');
      return;
    }
    if (integration.type === 'GOOGLE_SHEETS') {
      const response = await apiClient.post('/api/integrations/google-sheets/test');
      if (response.data.success) toast.success('Google Sheets bağlantısı aktif!');
      else toast.error('Test failed');
      return;
    }
    if (integration.type === 'IKAS') {
      const response = await apiClient.post('/api/integrations/ikas/test');
      if (response.data.success) toast.success('ikas bağlantısı aktif!');
      else toast.error('Test failed');
      return;
    }
    toast.info('Test not available for this integration');
  } catch (error) {
    toast.error('Test failed');
  }
};

  const getIntegrationIcon = (type) => INTEGRATION_ICONS[type] || Hash;
  const getCategoryColors = () => ({ icon: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800' });
  const getDocsUrl = (type) => INTEGRATION_DOCS[type] || '#';
  const getBusinessTypeDisplay = (type) => {
    const typeMap = { RESTAURANT: 'Restaurant', SALON: 'Salon/Spa', ECOMMERCE: 'E-commerce', CLINIC: 'Clinic/Healthcare', SERVICE: 'Service Business', OTHER: 'General' };
    return typeMap[type] || type;
  };

  const groupedIntegrations = {
    ESSENTIAL: integrations.filter(i => i.priority === 'ESSENTIAL'),
    RECOMMENDED: integrations.filter(i => i.priority === 'RECOMMENDED'),
    OPTIONAL: integrations.filter(i => i.priority === 'OPTIONAL')
  };

  const getCategoryDescription = (type) => {
    const descriptions = {
      GOOGLE_CALENDAR: t('dashboard.integrationsPage.syncAppointments'),
      GOOGLE_SHEETS: language === 'tr' ? 'Müşteri verilerini senkronize edin' : 'Sync customer data',
      WHATSAPP: t('dashboard.integrationsPage.whatsappConversations'),
      NETGSM_SMS: language === 'tr' ? 'SMS ile müşterilerinize ulaşın' : 'Reach your customers via SMS',
      SHOPIFY: t('dashboard.integrationsPage.shopifyConnect'),
      WOOCOMMERCE: t('dashboard.integrationsPage.woocommerceConnect'),
      IYZICO: t('dashboard.integrationsPage.iyzicoConnect'),
      ZAPIER: t('dashboard.integrationsPage.zapierConnect'),
      IKAS: t('dashboard.integrationsPage.ikasConnect'),
      IDEASOFT: t('dashboard.integrationsPage.ideasoftConnect'),
      TICIMAX: t('dashboard.integrationsPage.ticimaxConnect')
    };
    return descriptions[type] || t('dashboard.integrationsPage.title');
  };

  // E-commerce platforms list (only active ones)
  const ECOMMERCE_PLATFORMS = ['SHOPIFY', 'IKAS'];

  // Check which e-commerce platform is connected
  const getConnectedEcommercePlatform = () => {
    if (shopifyStatus?.connected) return 'SHOPIFY';
    if (ikasStatus?.connected) return 'IKAS';
    return null;
  };

  const connectedEcommerce = getConnectedEcommercePlatform();

  // Check if a platform should be disabled (another e-commerce is connected)
  const isEcommerceDisabled = (type) => {
    if (!ECOMMERCE_PLATFORMS.includes(type)) return false;
    return connectedEcommerce && connectedEcommerce !== type;
  };

  // Get platform name for display
  const getEcommercePlatformName = (type) => {
    const names = {
      SHOPIFY: 'Shopify',
      IKAS: 'ikas'
    };
    return names[type] || type;
  };

  // Integrations to hide (removed from platform)
  const HIDDEN_INTEGRATIONS = ['IDEASOFT', 'TICIMAX', 'WOOCOMMERCE', 'NETGSM_SMS'];

  // Integration Categories - new structure without sector filter
  const INTEGRATION_CATEGORIES = [
    {
      id: 'ecommerce',
      title: locale === 'tr' ? 'E-ticaret' : 'E-commerce',
      icon: ShoppingCart,
      types: ['SHOPIFY', 'IKAS']
    },
    {
      id: 'calendar',
      title: locale === 'tr' ? 'Takvim' : 'Calendar',
      icon: CalendarDays,
      types: ['GOOGLE_CALENDAR']
    },
    {
      id: 'data',
      title: locale === 'tr' ? 'Veri' : 'Data',
      icon: BarChart3,
      types: ['GOOGLE_SHEETS']
    },
    {
      id: 'messaging',
      title: locale === 'tr' ? 'Mesajlaşma' : 'Messaging',
      icon: Smartphone,
      types: ['WHATSAPP']
    },
    {
      id: 'crm',
      title: 'CRM',
      icon: Hash,
      types: ['CUSTOM']
    },
    {
      id: 'email',
      title: locale === 'tr' ? 'E-posta' : 'Email',
      icon: Mail,
      types: ['EMAIL']
    }
  ];

  // Filter out hidden integrations and group by category
  const filteredIntegrations = integrations.filter(i => !HIDDEN_INTEGRATIONS.includes(i.type));

  const getCategoryIntegrations = (categoryTypes) => {
    return filteredIntegrations.filter(i => categoryTypes.includes(i.type));
  };

  // Handle locked integration click
  const handleLockedIntegrationClick = (integration, feature) => {
    setSelectedFeature(feature);
    setUpgradeModalOpen(true);
  };

  const renderIntegrationCard = (integration) => {
    const Icon = getIntegrationIcon(integration.type);
    const colors = getCategoryColors(integration.category);
    const docsUrl = getDocsUrl(integration.type);
    const disabled = isEcommerceDisabled(integration.type);

    // Check if this integration is locked based on user's plan
    const featureInfo = getIntegrationFeatureInfo(integration.type, userPlan);
    const isLocked = featureInfo.isLocked && !integration.connected;

    return (
      <div key={integration.type} className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 transition-shadow ${disabled || isLocked ? 'opacity-70 bg-neutral-50 dark:bg-neutral-800' : 'hover:shadow-md'} border-neutral-200 dark:border-neutral-700`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${isLocked ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-400'}`} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${disabled || isLocked ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>{integration.name}</h3>
                {isLocked && (
                  <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                )}
                {disabled && !isLocked && (
                  <div className="group relative">
                    <Info className="h-4 w-4 text-neutral-400 dark:text-neutral-500 cursor-help" />
                    <div className="absolute left-0 top-6 hidden group-hover:block z-10 w-48 px-2 py-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded shadow-lg">
                      {getEcommercePlatformName(connectedEcommerce)} {t('dashboard.integrationsPage.platformAlreadyConnected')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {integration.connected && (
            <Check className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          )}
        </div>

        {isLocked && (
          <div className="mb-3 px-2 py-1 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 text-xs rounded-md inline-flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {language === 'tr' ? 'Bu entegrasyon Pro planında kullanılabilir' : 'This integration requires Pro plan'}
          </div>
        )}

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">{getCategoryDescription(integration.type)}</p>

        <div className="flex gap-2">
          {isLocked ? (
            <Button
              size="sm"
              className="flex-1"
              variant="outline"
              onClick={() => handleLockedIntegrationClick(integration, featureInfo.feature)}
            >
              <Lock className="h-4 w-4 mr-2" />
              {language === 'tr' ? 'Kilidi Aç' : 'Unlock'}
            </Button>
          ) : integration.connected ? (
            <>
              {integration.type === 'GOOGLE_SHEETS' ? (
                <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = '/dashboard/integrations/google-sheets'}>
                  Yönet
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleTest(integration)}>{t('dashboard.integrationsPage.testIntegration')}</Button>
              )}
              {can('integrations:connect') && (
              <Button variant="outline" size="sm" onClick={() => handleDisconnect(integration)}>{t('dashboard.integrationsPage.disconnect')}</Button>
              )}
            </>
          ) : (
            can('integrations:connect') && (
            <Button size="sm" className="flex-1" onClick={() => handleConnect(integration)} disabled={disabled}>
              {disabled ? t('dashboard.integrationsPage.disabledIntegration') : t('dashboard.integrationsPage.connect')}
            </Button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.integrationsPage.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('dashboard.integrationsPage.description')}</p>
      </div>

      {/* All Integrations Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 animate-pulse">
              <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-700 rounded-lg mb-4"></div>
              <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
              <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded mb-4"></div>
              <div className="h-10 w-full bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Custom CRM Integration - Only for ECOMMERCE - Moved to top */}
          {businessType === 'ECOMMERCE' && (() => {
            const crmFeatureInfo = getIntegrationFeatureInfo('CUSTOM', userPlan);
            const isCRMLocked = crmFeatureInfo.isLocked;

            return (
            <div className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 transition-shadow ${isCRMLocked ? 'opacity-70 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Hash className={`h-6 w-6 ${isCRMLocked ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${isCRMLocked ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>
                        {language === 'tr' ? 'Özel CRM/ERP Webhook' : 'Custom CRM/ERP Webhook'}
                      </h3>
                      {isCRMLocked && (
                        <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Pro
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isCRMLocked && (
                <div className="mb-4 px-2 py-1 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 text-xs rounded-md inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {language === 'tr' ? 'Bu entegrasyon Pro planında kullanılabilir' : 'This integration requires Pro plan'}
                </div>
              )}

              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {language === 'tr' ? 'Kendi sisteminizden veri gönderin' : 'Send data from your own system'}
              </p>

              {isCRMLocked ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedFeature(crmFeatureInfo.feature);
                    setUpgradeModalOpen(true);
                  }}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Kilidi Aç' : 'Unlock'}
                </Button>
              ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={() => window.location.href = '/dashboard/integrations/custom-crm'}
              >
                {language === 'tr' ? 'Bağlan' : 'Connect'}
              </Button>
              )}
            </div>
            );
          })()}

          {/* Gmail Card */}
          <div className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 hover:shadow-md transition-shadow ${emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? 'border-neutral-400 dark:border-neutral-600' : 'border-neutral-200 dark:border-neutral-700'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <GmailLogo className="h-6 w-6" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">Gmail</h3>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'GMAIL' && (
                <Check className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('dashboard.integrationsPage.gmailDesc')}</p>
            {emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" /><span>{t('dashboard.integrationsPage.connected')}: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = '/dashboard/email'}>
                    <Inbox className="h-4 w-4 mr-1" />{t('dashboard.integrationsPage.openInbox')}
                  </Button>
                  {can('integrations:connect') && (
                  <Button variant="outline" size="sm" onClick={handleEmailDisconnect} disabled={emailLoading}>{t('dashboard.integrationsPage.disconnect')}</Button>
                  )}
                </div>
              </div>
            ) : (
              can('integrations:connect') && (
              <Button size="sm" className="w-full" onClick={handleGmailConnect} disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'GMAIL')}>
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('dashboard.integrationsPage.connectingText')}</> : t('dashboard.integrationsPage.connect')}
              </Button>
              )
            )}
          </div>

          {/* Outlook Card */}
          <div className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 hover:shadow-md transition-shadow ${emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? 'border-neutral-400 dark:border-neutral-600' : 'border-neutral-200 dark:border-neutral-700'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <OutlookLogo className="h-6 w-6" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">Microsoft 365</h3>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' && (
                <Check className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('dashboard.integrationsPage.outlookDesc')}</p>
            {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" /><span>{t('dashboard.integrationsPage.connected')}: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = '/dashboard/email'}>
                    <Inbox className="h-4 w-4 mr-1" />{t('dashboard.integrationsPage.openInbox')}
                  </Button>
                  {can('integrations:connect') && (
                  <Button variant="outline" size="sm" onClick={handleEmailDisconnect} disabled={emailLoading}>{t('dashboard.integrationsPage.disconnect')}</Button>
                  )}
                </div>
              </div>
            ) : (
              can('integrations:connect') && (
              <Button size="sm" className="w-full" onClick={handleOutlookConnect} disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'OUTLOOK')}>
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('dashboard.integrationsPage.connectingText')}</> : t('dashboard.integrationsPage.connect')}
              </Button>
              )
            )}
          </div>

          {/* Other Integrations */}
          {filteredIntegrations.map(renderIntegrationCard)}
      </div>
      )}

      {/* WhatsApp Modal */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'tr' ? 'WhatsApp Business API Bağlantısı' : 'Connect WhatsApp Business API'}</DialogTitle>
            <DialogDescription>{language === 'tr' ? 'WhatsApp Business API\'nizi bağlayarak AI destekli konuşmaları etkinleştirin.' : 'Connect your WhatsApp Business API to enable AI-powered conversations.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Erişim Tokeni *' : 'Access Token *'}</Label>
              <Input type="password" placeholder={language === 'tr' ? 'WhatsApp erişim tokeninizi girin' : 'Enter your WhatsApp access token'} value={whatsappForm.accessToken} onChange={(e) => setWhatsappForm({ ...whatsappForm, accessToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Telefon Numarası ID *' : 'Phone Number ID *'}</Label>
              <Input type="text" placeholder={language === 'tr' ? 'Telefon numarası ID\'nizi girin' : 'Enter your phone number ID'} value={whatsappForm.phoneNumberId} onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumberId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'tr' ? 'Doğrulama Tokeni *' : 'Verify Token *'}</Label>
              <Input type="text" placeholder={language === 'tr' ? 'Örn: my-secret-token-123' : 'e.g. my-secret-token-123'} value={whatsappForm.verifyToken} onChange={(e) => setWhatsappForm({ ...whatsappForm, verifyToken: e.target.value })} />
              <p className="text-xs text-neutral-500">
                {language === 'tr' ? 'Kendiniz güvenli bir token oluşturun ve aynısını Meta Developer Console\'da da kullanın' : 'Create a secure token and use the same in Meta Developer Console'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input type="text" readOnly value={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.telyx.ai'}/api/whatsapp/webhook`} className="bg-neutral-50" />
                <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-neutral-500">
                {language === 'tr' ? 'Bu URL\'i Meta Developer Console\'da Webhook ayarlarına yapıştırın' : 'Paste this URL in Meta Developer Console Webhook settings'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappModalOpen(false)} disabled={whatsappLoading}>{language === 'tr' ? 'İptal' : 'Cancel'}</Button>
            <Button onClick={handleWhatsAppConnect} disabled={whatsappLoading}>{whatsappLoading ? (language === 'tr' ? 'Bağlanıyor...' : 'Connecting...') : (language === 'tr' ? 'WhatsApp\'ı Bağla' : 'Connect WhatsApp')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* iyzico Modal */}
      <Dialog open={iyzicoModalOpen} onOpenChange={setIyzicoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect iyzico Payment Gateway</DialogTitle>
            <DialogDescription>Connect your iyzico account for payment and refund tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input type="text" placeholder="Enter your iyzico API Key" value={iyzicoForm.apiKey} onChange={(e) => setIyzicoForm({ ...iyzicoForm, apiKey: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Secret Key *</Label>
              <div className="relative">
                <Input type={showIyzicoSecret ? 'text' : 'password'} placeholder="Enter your iyzico Secret Key" value={iyzicoForm.secretKey} onChange={(e) => setIyzicoForm({ ...iyzicoForm, secretKey: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowIyzicoSecret(!showIyzicoSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                  {showIyzicoSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Environment *</Label>
              <select className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm" value={iyzicoForm.environment} onChange={(e) => setIyzicoForm({ ...iyzicoForm, environment: e.target.value })}>
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIyzicoModalOpen(false)} disabled={iyzicoLoading}>Cancel</Button>
            <Button onClick={handleIyzicoConnect} disabled={iyzicoLoading}>{iyzicoLoading ? 'Connecting...' : 'Connect iyzico'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopify Modal */}
      <Dialog open={shopifyModalOpen} onOpenChange={(open) => { setShopifyModalOpen(open); if (!open) setShopifyLoading(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              Connect Shopify Store
            </DialogTitle>
            <DialogDescription>Connect your Shopify store with one click using OAuth.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shop URL *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="mystore"
                  value={shopifyForm.shopUrl}
                  onChange={(e) => setShopifyForm({ ...shopifyForm, shopUrl: e.target.value })}
                  className="flex-1"
                />
                <span className="flex items-center text-sm text-neutral-500">.myshopify.com</span>
              </div>
              <p className="text-xs text-neutral-500">Enter your Shopify store name (the part before .myshopify.com)</p>
            </div>

            {shopifyStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Connected: {shopifyStatus.shopName || shopifyStatus.shopDomain}</p>
              </div>
            )}

            <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">How it works:</h4>
              <ol className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1 list-decimal list-inside">
                <li>Enter your store name and click Connect</li>
                <li>You'll be redirected to Shopify to authorize</li>
                <li>After approving, you'll return here automatically</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopifyModalOpen(false)} disabled={shopifyLoading}>Cancel</Button>
            <Button onClick={handleShopifyConnect} disabled={shopifyLoading || !shopifyForm.shopUrl}>
              {shopifyLoading ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><ExternalLink className="h-4 w-4 mr-2" />Connect with Shopify</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WooCommerce Modal - REMOVED (platform no longer supported) */}

      {/* Webhook Modal */}
      <Dialog open={webhookModalOpen} onOpenChange={setWebhookModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zapier / Webhook Integration</DialogTitle>
            <DialogDescription>Connect any system via webhook. Use with Zapier, Make.com, or custom integrations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {webhookStatus?.configured ? (
              <>
                <div className="space-y-2">
                  <Label>Your Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input type="text" readOnly value={webhookStatus.webhookUrl || ''} className="bg-neutral-50 font-mono text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(webhookStatus.webhookUrl, 'url')}>
                      {copiedField === 'url' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleWebhookRegenerate} disabled={webhookLoading} className="flex-1">
                    {webhookLoading ? 'Regenerating...' : 'Regenerate URL'}
                  </Button>
                  <Button variant="destructive" onClick={handleWebhookDisable} disabled={webhookLoading} className="flex-1">Disable Webhook</Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">Click to get your unique webhook URL</p>
                <Button onClick={handleWebhookSetup} disabled={webhookLoading}>{webhookLoading ? 'Activating...' : 'Activate Webhook'}</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ikas Modal */}
      <Dialog open={ikasModalOpen} onOpenChange={setIkasModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
              ikas Mağaza Bağlantısı
            </DialogTitle>
            <DialogDescription>ikas e-ticaret platformunuzu bağlayarak AI asistanınızın sipariş durumu ve stok bilgisi sorgulamasını sağlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mağaza Adı *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="magazam"
                  value={ikasForm.storeName}
                  onChange={(e) => setIkasForm({ ...ikasForm, storeName: e.target.value })}
                  className="flex-1"
                />
                <span className="flex items-center text-sm text-neutral-500">.myikas.com</span>
              </div>
              <p className="text-xs text-neutral-500">Mağaza adınızı girin (magazam.myikas.com için &quot;magazam&quot;)</p>
            </div>
            <div className="space-y-2">
              <Label>Client ID *</Label>
              <Input
                type="text"
                placeholder="Client ID'nizi girin"
                value={ikasForm.clientId}
                onChange={(e) => setIkasForm({ ...ikasForm, clientId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret *</Label>
              <Input
                type="password"
                placeholder="Client Secret'ınızı girin"
                value={ikasForm.clientSecret}
                onChange={(e) => setIkasForm({ ...ikasForm, clientSecret: e.target.value })}
              />
            </div>
            {ikasStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Bağlı: {ikasStatus.storeName}</p>
              </div>
            )}
            <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">API bilgilerinizi nereden bulabilirsiniz:</h4>
              <ol className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1 list-decimal list-inside">
                <li>ikas mağaza panelinize giriş yapın</li>
                <li>Sol menüden <strong>Uygulamalar → Uygulamalarım</strong> sayfasına gidin</li>
                <li><strong>Daha Fazla</strong> butonuna tıklayın ve <strong>Özel Uygulamalarınızı Yönetin</strong> seçin</li>
                <li>Sağ üstten <strong>Özel Uygulama Oluştur</strong> butonuna tıklayın</li>
                <li>Uygulama adını girin (örn: Telyx.ai) ve gerekli izinleri seçin:
                  <ul>
                    <li>Siparişleri Görüntüleme</li>
                    <li>Müşterileri Görüntüleme</li>
                    <li>Ürünleri Görüntüleme</li>
                  </ul>
                </li>
                <li>Kaydet'e tıklayın - <strong>Client ID</strong> ve <strong>Client Secret</strong> otomatik oluşturulacak</li>
                <li>Bu bilgileri kopyalayıp ilgili alana yapıştırın</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIkasModalOpen(false)} disabled={ikasLoading}>İptal</Button>
            <Button onClick={handleIkasConnect} disabled={ikasLoading}>
              {ikasLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Bağlanıyor...</> : "ikas'ı Bağla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ideasoft Modal - REMOVED (platform no longer supported) */}
      {/* Ticimax Modal - REMOVED (platform no longer supported) */}

      {/* Upgrade Modal for locked integrations */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureId={selectedFeature?.id}
        featureName={selectedFeature?.name}
        featureDescription={language === 'tr' ? selectedFeature?.description : selectedFeature?.descriptionEN}
        requiredPlan={language === 'tr' ? 'Pro' : 'Pro'}
      />
    </div>
  );
}
