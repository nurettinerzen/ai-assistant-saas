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
  Wallet, Eye, EyeOff, Inbox, RefreshCw, Lock
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

const INTEGRATION_ICONS = {
  GOOGLE_CALENDAR: CalendarDays, WHATSAPP: Smartphone, CALENDLY: Calendar,
  SHOPIFY: ShoppingCart, WOOCOMMERCE: ShoppingCart, STRIPE_PAYMENTS: CreditCard,
  SQUARE: CreditCard, OPENTABLE: Utensils, TOAST_POS: Utensils,
  SIMPLEPRACTICE: Stethoscope, ZOCDOC: Stethoscope, BOOKSY: Scissors,
  FRESHA: Scissors, SHIPSTATION: Package, KLAVIYO: Mail, MAILCHIMP: Mail,
  HUBSPOT: Target, SALESFORCE: Cloud, GOOGLE_SHEETS: BarChart3, ZAPIER: Zap,
  SLACK: MessageSquare, TWILIO_SMS: MessageSquare, SENDGRID_EMAIL: Mail,
  IYZICO: Wallet, CUSTOM: Hash,
  IKAS: ShoppingCart, IDEASOFT: ShoppingCart, TICIMAX: ShoppingCart
};

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
  automation: { icon: 'text-amber-600', bg: 'bg-amber-100' },
  accounting: { icon: 'text-slate-600', bg: 'bg-slate-100' }
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

  // WooCommerce state
  const [woocommerceModalOpen, setWoocommerceModalOpen] = useState(false);
  const [woocommerceStatus, setWoocommerceStatus] = useState(null);
  const [woocommerceLoading, setWoocommerceLoading] = useState(false);
  const [woocommerceForm, setWoocommerceForm] = useState({ siteUrl: '', consumerKey: '', consumerSecret: '' });

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

  // Ideasoft state
  const [ideasoftModalOpen, setIdeasoftModalOpen] = useState(false);
  const [ideasoftStatus, setIdeasoftStatus] = useState(null);
  const [ideasoftLoading, setIdeasoftLoading] = useState(false);
  const [ideasoftForm, setIdeasoftForm] = useState({ storeDomain: '', clientId: '', clientSecret: '' });

  // Ticimax state
  const [ticimaxModalOpen, setTicimaxModalOpen] = useState(false);
  const [ticimaxStatus, setTicimaxStatus] = useState(null);
  const [ticimaxLoading, setTicimaxLoading] = useState(false);
  const [ticimaxForm, setTicimaxForm] = useState({ siteUrl: '', uyeKodu: '' });

  // Load user plan
  useEffect(() => {
    const loadUserPlan = async () => {
      try {
        const response = await apiClient.get('/api/auth/me');
        const plan = response.data?.subscription?.plan || response.data?.plan || 'STARTER';
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
    loadWooCommerceStatus();
    loadWebhookStatus();
    loadIkasStatus();
    loadIdeasoftStatus();
    loadTicimaxStatus();

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

  const loadWooCommerceStatus = async () => {
    try {
      const response = await apiClient.get('/api/woocommerce/status');
      setWoocommerceStatus(response.data);
    } catch (error) { console.error('Failed to load WooCommerce status:', error); }
  };

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

  const loadIdeasoftStatus = async () => {
    try {
      const response = await apiClient.get('/api/integrations/ideasoft/status');
      setIdeasoftStatus(response.data);
    } catch (error) { console.error('Failed to load Ideasoft status:', error); }
  };

  const loadTicimaxStatus = async () => {
    try {
      const response = await apiClient.get('/api/integrations/ticimax/status');
      setTicimaxStatus(response.data);
    } catch (error) { console.error('Failed to load Ticimax status:', error); }
  };

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

  const handleWooCommerceConnect = async () => {
    if (!woocommerceForm.siteUrl || !woocommerceForm.consumerKey || !woocommerceForm.consumerSecret) {
      toast.error('Please fill in all fields');
      return;
    }
    setWoocommerceLoading(true);
    try {
      const response = await apiClient.post('/api/woocommerce/connect', woocommerceForm);
      if (response.data.success) {
        toast.success(`Connected to ${response.data.store?.name || 'WooCommerce'}!`);
        setWoocommerceModalOpen(false);
        setWoocommerceForm({ siteUrl: '', consumerKey: '', consumerSecret: '' });
        await loadWooCommerceStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to connect WooCommerce');
    } finally {
      setWoocommerceLoading(false);
    }
  };

  const handleWooCommerceDisconnect = async () => {
    if (!confirm('Disconnect WooCommerce?')) return;
    try {
      await apiClient.post('/api/woocommerce/disconnect');
      toast.success('WooCommerce disconnected');
      await loadWooCommerceStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Failed to disconnect'); }
  };

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
    if (whatsappStatus?.webhookUrl) {
      navigator.clipboard.writeText(whatsappStatus.webhookUrl);
      toast.success('Webhook URL copied!');
    }
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

  // Ideasoft handlers
const handleIdeasoftConnect = async () => {
  if (!ideasoftForm.storeDomain || !ideasoftForm.clientId || !ideasoftForm.clientSecret) {
    toast.error('Lütfen tüm alanları doldurun');
    return;
  }
  
  try {
    setIdeasoftLoading(true);
    
    const response = await apiClient.post('/integrations/ideasoft/auth', {
      storeUrl: ideasoftForm.storeDomain,  // storeDomain'i storeUrl olarak gönder
      clientId: ideasoftForm.clientId,
      clientSecret: ideasoftForm.clientSecret
    });
    
    // Kullanıcıyı İdeasoft'a yönlendir
    window.location.href = response.data.authUrl;
    
  } catch (error) {
    toast.error('Bağlantı başlatılamadı: ' + (error.response?.data?.error || error.message));
    setIdeasoftLoading(false);
  }
};

  // Ticimax handlers
  const handleTicimaxConnect = async () => {
    if (!ticimaxForm.siteUrl || !ticimaxForm.uyeKodu) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    setTicimaxLoading(true);
    try {
      const response = await apiClient.post('/api/integrations/ticimax/connect', ticimaxForm);
      if (response.data.success) {
        toast.success('Ticimax bağlandı!');
        setTicimaxModalOpen(false);
        setTicimaxForm({ siteUrl: '', uyeKodu: '' });
        await loadTicimaxStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Bağlantı başarısız');
    } finally {
      setTicimaxLoading(false);
    }
  };

  const handleConnect = async (integration) => {
    try {
      if (integration.type === 'WHATSAPP') { setWhatsappModalOpen(true); return; }
      if (integration.type === 'IYZICO') { setIyzicoModalOpen(true); return; }
      if (integration.type === 'SHOPIFY') { setShopifyModalOpen(true); return; }
      if (integration.type === 'WOOCOMMERCE') { setWoocommerceModalOpen(true); return; }
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
      if (integration.type === 'IDEASOFT') { setIdeasoftModalOpen(true); return; }
      if (integration.type === 'TICIMAX') { setTicimaxModalOpen(true); return; }
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
    else if (integration.type === 'WOOCOMMERCE') await handleWooCommerceDisconnect();
    else if (integration.type === 'ZAPIER') await handleWebhookDisable();
    // ↓↓↓ BU İKİSİNİ EKLE ↓↓↓
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
    else if (integration.type === 'IDEASOFT') {
      await apiClient.post('/api/integrations/ideasoft/disconnect');
      toast.success('Ideasoft bağlantısı kesildi');
      await loadIdeasoftStatus();
      await loadIntegrations();
    }
    else if (integration.type === 'TICIMAX') {
      await apiClient.post('/api/integrations/ticimax/disconnect');
      toast.success('Ticimax bağlantısı kesildi');
      await loadTicimaxStatus();
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
    if (integration.type === 'IDEASOFT') {
      const response = await apiClient.post('/api/integrations/ideasoft/test');
      if (response.data.success) toast.success('Ideasoft bağlantısı aktif!');
      else toast.error('Test failed');
      return;
    }
    if (integration.type === 'TICIMAX') {
      const response = await apiClient.post('/api/integrations/ticimax/test');
      if (response.data.success) toast.success('Ticimax bağlantısı aktif!');
      else toast.error('Test failed');
      return;
    }
    toast.info('Test not available for this integration');
  } catch (error) {
    toast.error('Test failed');
  }
};

  const getIntegrationIcon = (type) => INTEGRATION_ICONS[type] || Hash;
  const getCategoryColors = (category) => CATEGORY_COLORS[category] || { icon: 'text-neutral-600', bg: 'bg-neutral-100' };
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
      WHATSAPP: t('dashboard.integrationsPage.whatsappConversations'),
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

  // E-commerce platforms list
  const ECOMMERCE_PLATFORMS = ['SHOPIFY', 'WOOCOMMERCE', 'IKAS', 'IDEASOFT', 'TICIMAX'];

  // Check which e-commerce platform is connected
  const getConnectedEcommercePlatform = () => {
    if (shopifyStatus?.connected) return 'SHOPIFY';
    if (woocommerceStatus?.connected) return 'WOOCOMMERCE';
    if (ikasStatus?.connected) return 'IKAS';
    if (ideasoftStatus?.connected) return 'IDEASOFT';
    if (ticimaxStatus?.connected) return 'TICIMAX';
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
      WOOCOMMERCE: 'WooCommerce',
      IKAS: 'ikas',
      IDEASOFT: 'Ideasoft',
      TICIMAX: 'Ticimax'
    };
    return names[type] || type;
  };

  // Integrations marked as "Coming Soon"
  const COMING_SOON_INTEGRATIONS = ['IDEASOFT', 'TICIMAX', 'WOOCOMMERCE'];

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
    const isComingSoon = COMING_SOON_INTEGRATIONS.includes(integration.type);

    // Check if this integration is locked based on user's plan
    const featureInfo = getIntegrationFeatureInfo(integration.type, userPlan);
    const isLocked = featureInfo.isLocked && !integration.connected;

    return (
      <div key={integration.type} className={`bg-white rounded-xl border p-6 transition-shadow ${disabled || isComingSoon || isLocked ? 'opacity-70 bg-neutral-50' : 'hover:shadow-md'} ${integration.priority === 'ESSENTIAL' ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isLocked ? 'bg-neutral-100' : colors.bg}`}>
              <Icon className={`h-6 w-6 ${isLocked ? 'text-neutral-400' : colors.icon}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${disabled || isComingSoon || isLocked ? 'text-neutral-500' : 'text-neutral-900'}`}>{integration.name}</h3>
                {integration.priority === 'ESSENTIAL' && !isLocked && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                {isLocked && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                )}
                {isComingSoon && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                    {t('dashboard.integrationsPage.comingSoon')}
                  </Badge>
                )}
              </div>
              <Badge variant="secondary" className="text-xs mt-1">{integration.category}</Badge>
            </div>
          </div>
          {integration.connected && (
            <div className="p-1 bg-green-100 rounded-full">
              <Check className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>

        {integration.priority === 'ESSENTIAL' && !isLocked && (
          <div className="mb-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-blue-700" />{t('dashboard.integrationsPage.essentialForBusiness')}
          </div>
        )}

        {isLocked && (
          <div className="mb-3 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-md inline-flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {language === 'tr' ? 'Bu entegrasyon Pro planında kullanılabilir' : 'This integration requires Pro plan'}
          </div>
        )}

        {disabled && !isComingSoon && !isLocked && (
          <div className="mb-3 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-md">
            {getEcommercePlatformName(connectedEcommerce)} {t('dashboard.integrationsPage.platformAlreadyConnected')}
          </div>
        )}

        {isComingSoon && (
          <div className="mb-3 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md">
            {t('dashboard.integrationsPage.comingSoonDesc')}
          </div>
        )}

        <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{getCategoryDescription(integration.type)}</p>

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
          ) : isComingSoon ? (
            <Button size="sm" className="flex-1" disabled title={t('dashboard.integrationsPage.comingSoonTooltip')}>
              {t('dashboard.integrationsPage.comingSoon')}
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
          <Button variant="ghost" size="sm" asChild>
            <a href={docsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.integrationsPage.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('dashboard.integrationsPage.description')}</p>
        {businessType && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Target className="h-4 w-4 mr-1" />{getBusinessTypeDisplay(businessType)}
            </Badge>
          </div>
        )}
      </div>

      {/* Email Channel Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-600" />{t('dashboard.integrationsPage.emailChannel')}
          </h2>
          <p className="text-sm text-neutral-600 mt-1">{t('dashboard.integrationsPage.emailChannelDesc')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gmail Card */}
          <div className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? 'border-green-300 bg-green-50/30' : 'border-neutral-200'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100">
                  <Mail className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Gmail</h3>
                  <Badge variant="secondary" className="text-xs mt-1">{t('dashboard.integrationsPage.emailChannel')}</Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'GMAIL' && (
                <div className="p-1 bg-green-100 rounded-full"><Check className="h-4 w-4 text-green-600" /></div>
              )}
            </div>
            <p className="text-sm text-neutral-600 mb-4">{t('dashboard.integrationsPage.gmailDesc')}</p>
            {emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
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
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('dashboard.integrationsPage.connectingText')}</> : t('dashboard.integrationsPage.connectGmail')}
              </Button>
              )
            )}
          </div>

          {/* Outlook Card */}
          <div className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? 'border-green-300 bg-green-50/30' : 'border-neutral-200'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Microsoft 365</h3>
                  <Badge variant="secondary" className="text-xs mt-1">{t('dashboard.integrationsPage.emailChannel')}</Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' && (
                <div className="p-1 bg-green-100 rounded-full"><Check className="h-4 w-4 text-green-600" /></div>
              )}
            </div>
            <p className="text-sm text-neutral-600 mb-4">{t('dashboard.integrationsPage.outlookDesc')}</p>
            {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
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
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('dashboard.integrationsPage.connectingText')}</> : t('dashboard.integrationsPage.connectOutlook')}
              </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Custom CRM Integration Section */}
      {(() => {
        const crmFeatureInfo = getIntegrationFeatureInfo('CUSTOM', userPlan);
        const isCRMLocked = crmFeatureInfo.isLocked;

        return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            <Hash className="h-5 w-5 text-purple-600" />
            {language === 'tr' ? 'Özel CRM Entegrasyonu' : 'Custom CRM Integration'}
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            {language === 'tr' ? 'Kendi sisteminizden sipariş, stok ve servis bilgileri gönderin.' : 'Send order, stock and service information from your own system.'}
          </p>
        </div>

        <div className={`bg-white rounded-xl border p-6 transition-shadow ${isCRMLocked ? 'opacity-70 bg-neutral-50 border-neutral-200' : 'border-neutral-200 hover:shadow-md'}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${isCRMLocked ? 'bg-neutral-100' : 'bg-purple-100'}`}>
                <Hash className={`h-6 w-6 ${isCRMLocked ? 'text-neutral-400' : 'text-purple-600'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${isCRMLocked ? 'text-neutral-500' : 'text-neutral-900'}`}>
                    {language === 'tr' ? 'Özel CRM/ERP Webhook' : 'Custom CRM/ERP Webhook'}
                  </h3>
                  {isCRMLocked ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Pro
                    </Badge>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Pro</span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  {language === 'tr' ? 'Kendi sisteminizi bağlayın' : 'Connect your own system'}
                </p>
              </div>
            </div>
          </div>

          {isCRMLocked && (
            <div className="mb-3 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-md inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {language === 'tr' ? 'Bu entegrasyon Pro planında kullanılabilir' : 'This integration requires Pro plan'}
            </div>
          )}

          <p className="text-sm text-neutral-600 mb-4">
            {language === 'tr'
              ? "Kendi CRM veya ERP sisteminizden sipariş, stok ve servis/arıza bilgilerini Telyx'e gönderin. AI asistanınız bu bilgilere erişerek müşterilerinize otomatik yanıt verebilir."
              : "Send order, stock and service information from your own CRM or ERP system to Telyx. Your AI assistant can access this information to automatically respond to your customers."}
          </p>

          {isCRMLocked ? (
            <Button
              size="sm"
              className="w-full"
              variant="outline"
              onClick={() => handleLockedIntegrationClick({ type: 'CUSTOM', name: 'Custom CRM' }, crmFeatureInfo.feature)}
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
            {language === 'tr' ? 'Entegrasyonu Yönet' : 'Manage Integration'}
          </Button>
          )}
        </div>
      </div>
        );
      })()}

      {/* Integration Lists */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse">
              <div className="h-12 w-12 bg-neutral-200 rounded-lg mb-4"></div>
              <div className="h-6 w-32 bg-neutral-200 rounded mb-2"></div>
              <div className="h-4 w-full bg-neutral-200 rounded mb-4"></div>
              <div className="h-10 w-full bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {groupedIntegrations.ESSENTIAL.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />{t('dashboard.integrationsPage.essentialIntegrations')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.ESSENTIAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {groupedIntegrations.RECOMMENDED.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />{t('dashboard.integrationsPage.recommendedIntegrations')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.RECOMMENDED.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {groupedIntegrations.OPTIONAL.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-neutral-900">{t('dashboard.integrationsPage.moreIntegrations')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.OPTIONAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {integrations.length === 0 && (
            <EmptyState icon={Puzzle} title={t('dashboard.integrationsPage.noIntegrationsAvailable')} description={t('dashboard.integrationsPage.contactSupportIntegrations')} />
          )}
        </>
      )}

      {/* WhatsApp Modal */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Business API</DialogTitle>
            <DialogDescription>Connect your WhatsApp Business API to enable AI-powered conversations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Access Token *</Label>
              <Input type="password" placeholder="Enter your WhatsApp access token" value={whatsappForm.accessToken} onChange={(e) => setWhatsappForm({ ...whatsappForm, accessToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number ID *</Label>
              <Input type="text" placeholder="Enter your phone number ID" value={whatsappForm.phoneNumberId} onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumberId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Verify Token *</Label>
              <Input type="text" placeholder="Create a secure verify token" value={whatsappForm.verifyToken} onChange={(e) => setWhatsappForm({ ...whatsappForm, verifyToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input type="text" readOnly value={whatsappStatus?.webhookUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook`} className="bg-neutral-50" />
                <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappModalOpen(false)} disabled={whatsappLoading}>Cancel</Button>
            <Button onClick={handleWhatsAppConnect} disabled={whatsappLoading}>{whatsappLoading ? 'Connecting...' : 'Connect WhatsApp'}</Button>
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
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Connected: {shopifyStatus.shopName || shopifyStatus.shopDomain}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
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

      {/* WooCommerce Modal */}
      <Dialog open={woocommerceModalOpen} onOpenChange={setWoocommerceModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect WooCommerce Store</DialogTitle>
            <DialogDescription>Connect your WooCommerce store for order tracking and inventory management.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Site URL *</Label>
              <Input type="text" placeholder="https://mystore.com" value={woocommerceForm.siteUrl} onChange={(e) => setWoocommerceForm({ ...woocommerceForm, siteUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Consumer Key *</Label>
              <Input type="text" placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx" value={woocommerceForm.consumerKey} onChange={(e) => setWoocommerceForm({ ...woocommerceForm, consumerKey: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Consumer Secret *</Label>
              <Input type="password" placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx" value={woocommerceForm.consumerSecret} onChange={(e) => setWoocommerceForm({ ...woocommerceForm, consumerSecret: e.target.value })} />
            </div>
            {woocommerceStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
                <p className="text-sm font-medium text-purple-900">Connected: {woocommerceStatus.storeName || woocommerceStatus.siteUrl}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWoocommerceModalOpen(false)} disabled={woocommerceLoading}>Cancel</Button>
            <Button onClick={handleWooCommerceConnect} disabled={woocommerceLoading}>{woocommerceLoading ? 'Connecting...' : 'Connect WooCommerce'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Bağlı: {ikasStatus.storeName}</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">API bilgilerinizi nereden bulabilirsiniz:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
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

      {/* Ideasoft Modal */}
      <Dialog open={ideasoftModalOpen} onOpenChange={setIdeasoftModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Ideasoft Mağaza Bağlantısı
            </DialogTitle>
            <DialogDescription>Ideasoft e-ticaret platformunuzu bağlayarak AI asistanınızın sipariş durumu ve stok bilgisi sorgulamasını sağlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mağaza Domain *</Label>
              <Input
                type="text"
                placeholder="www.magazam.com"
                value={ideasoftForm.storeDomain}
                onChange={(e) => setIdeasoftForm({ ...ideasoftForm, storeDomain: e.target.value })}
              />
              <p className="text-xs text-neutral-500">Mağazanızın tam domain adresini girin</p>
            </div>
            <div className="space-y-2">
              <Label>Client ID *</Label>
              <Input
                type="text"
                placeholder="Client ID'nizi girin"
                value={ideasoftForm.clientId}
                onChange={(e) => setIdeasoftForm({ ...ideasoftForm, clientId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret *</Label>
              <Input
                type="password"
                placeholder="Client Secret'ınızı girin"
                value={ideasoftForm.clientSecret}
                onChange={(e) => setIdeasoftForm({ ...ideasoftForm, clientSecret: e.target.value })}
              />
            </div>
            {ideasoftStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Bağlı: {ideasoftStatus.storeDomain}</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">API bilgilerinizi nereden bulabilirsiniz:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>İdeasoft yönetim panelinize giriş yapın</li>
              <li>Üst menüden <strong>Entegrasyonlar → API</strong> bölümüne gidin</li>
              <li>Sol taraftan <strong>Ekle</strong> butonuna tıklayın</li>
              <li>Açılan formda:
                <ul>
                  <li><strong>Adı:</strong> Telyx.ai</li>
                  <li><strong>Yönlendirme Adresi:</strong> <code>https://marin-methoxy-suzette.ngrok-free.dev/api/integrations/ideasoft/callback</code></li>
                </ul>
              </li>
              <li><strong>Kaydet</strong>'e tıklayın</li>
              <li><strong>İzin Yönetimi</strong>'ne tıklayın ve izinleri aktif edin</li>
              <li>Oluşan <strong>Client ID</strong> ve <strong>Client Secret</strong> bilgilerini aşağıya girin</li>
              <li><strong>Yetkilendir</strong> butonuna tıklayın - İdeasoft'a yönlendirileceksiniz</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIdeasoftModalOpen(false)} disabled={ideasoftLoading}>İptal</Button>
            <Button onClick={handleIdeasoftConnect} disabled={ideasoftLoading}>
              {ideasoftLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Bağlanıyor...</> : "Ideasoft'u Bağla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticimax Modal */}
      <Dialog open={ticimaxModalOpen} onOpenChange={setTicimaxModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              Ticimax Mağaza Bağlantısı
            </DialogTitle>
            <DialogDescription>Ticimax e-ticaret platformunuzu bağlayarak AI asistanınızın sipariş durumu ve stok bilgisi sorgulamasını sağlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Site URL *</Label>
              <Input
                type="text"
                placeholder="www.magazam.com"
                value={ticimaxForm.siteUrl}
                onChange={(e) => setTicimaxForm({ ...ticimaxForm, siteUrl: e.target.value })}
              />
              <p className="text-xs text-neutral-500">Mağazanızın tam site adresini girin</p>
            </div>
            <div className="space-y-2">
              <Label>Yetki Kodu (API Key) *</Label>
              <Input
                type="password"
                placeholder="Yetki kodunuzu girin"
                value={ticimaxForm.uyeKodu}
                onChange={(e) => setTicimaxForm({ ...ticimaxForm, uyeKodu: e.target.value })}
              />
              <p className="text-xs text-neutral-500">Ticimax panelinden aldığınız API yetki kodunu girin</p>
            </div>
            {ticimaxStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Bağlı: {ticimaxStatus.siteUrl}</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">API bilgilerinizi nereden bulabilirsiniz:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Ticimax yönetim panelinize giriş yapın</li>
              <li>Sağ üst menüden <strong>Ayarlar → WS Yetki Kodu Yönetimi</strong> sekmesine gidin</li>
              <li>Sol üstten <strong>Yeni Ekle</strong> butonuna tıklayın</li>
              <li>Açılan formda:
                <ul>
                  <li><strong>Yetki Kodu Tanım:</strong> Telyx.ai</li>
                  <li><strong>Yetki Kodu Oluştur</strong> butonuna tıklayın</li>
                </ul>
              </li>
              <li>Aşağıdaki tüm yetkileri <strong>aktif</strong> hale getirin (X'leri tıklayarak yeşil yapın):
                <ul>
                  <li>Ürün Listele, Ürün Düzenle</li>
                  <li>Sipariş Listele, Sipariş Düzenle</li>
                  <li>Üye Listele</li>
                </ul>
              </li>
              <li><strong>Kaydet</strong>'e tıklayın</li>
              <li>Oluşan <strong>Yetki Kodu</strong>'nu kopyalayıp ilgili alana yapıştırın</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicimaxModalOpen(false)} disabled={ticimaxLoading}>İptal</Button>
            <Button onClick={handleTicimaxConnect} disabled={ticimaxLoading}>
              {ticimaxLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Bağlanıyor...</> : "Ticimax'ı Bağla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
