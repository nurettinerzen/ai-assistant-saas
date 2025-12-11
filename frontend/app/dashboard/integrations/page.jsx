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
  Truck,
  Calculator,
  Wallet,
  Eye,
  EyeOff,
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
  TRENDYOL: ShoppingCart,
  YURTICI_KARGO: Truck,
  ARAS_KARGO: Truck,
  MNG_KARGO: Truck,
  PARASUT: Calculator,
  IYZICO: Wallet,
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
  cargo: { icon: 'text-orange-600', bg: 'bg-orange-100' },
  marketing: { icon: 'text-rose-600', bg: 'bg-rose-100' },
  crm: { icon: 'text-cyan-600', bg: 'bg-cyan-100' },
  data: { icon: 'text-emerald-600', bg: 'bg-emerald-100' },
  automation: { icon: 'text-amber-600', bg: 'bg-amber-100' },
  accounting: { icon: 'text-slate-600', bg: 'bg-slate-100' }
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
  SENDGRID_EMAIL: 'https://docs.sendgrid.com',
  TRENDYOL: 'https://developers.trendyol.com',
  YURTICI_KARGO: 'https://www.yurticikargo.com/tr/kurumsal/entegrasyon',
  ARAS_KARGO: 'https://www.araskargo.com.tr/kurumsal/entegrasyon',
  MNG_KARGO: 'https://www.mngkargo.com.tr/entegrasyon',
  PARASUT: 'https://apidocs.parasut.com',
  IYZICO: 'https://dev.iyzipay.com'
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

  // Trendyol connection state
  const [trendyolModalOpen, setTrendyolModalOpen] = useState(false);
  const [trendyolStatus, setTrendyolStatus] = useState(null);
  const [trendyolLoading, setTrendyolLoading] = useState(false);
  const [trendyolTestLoading, setTrendyolTestLoading] = useState(false);
  const [trendyolForm, setTrendyolForm] = useState({
    supplierId: '',
    apiKey: '',
    apiSecret: ''
  });

  // Cargo integration state
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [activeCargoCarrier, setActiveCargoCarrier] = useState(null);
  const [cargoLoading, setCargoLoading] = useState(false);
  const [cargoStatus, setCargoStatus] = useState({});
  const [cargoForm, setCargoForm] = useState({
    // Yurtici fields
    customerCode: '',
    username: '',
    password: '',
    // MNG fields
    apiKey: ''
  });

  // iyzico connection state
  const [iyzicoModalOpen, setIyzicoModalOpen] = useState(false);
  const [iyzicoStatus, setIyzicoStatus] = useState(null);
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  const [iyzicoForm, setIyzicoForm] = useState({
    apiKey: '',
    secretKey: '',
    environment: 'sandbox'
  });
  const [showIyzicoSecret, setShowIyzicoSecret] = useState(false);

  // Parasut connection state
  const [parasutStatus, setParasutStatus] = useState(null);

  // Email integration state
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Shopify connection state
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyForm, setShopifyForm] = useState({
    shopUrl: '',
    accessToken: ''
  });

  // WooCommerce connection state
  const [woocommerceModalOpen, setWoocommerceModalOpen] = useState(false);
  const [woocommerceStatus, setWoocommerceStatus] = useState(null);
  const [woocommerceLoading, setWoocommerceLoading] = useState(false);
  const [woocommerceForm, setWoocommerceForm] = useState({
    siteUrl: '',
    consumerKey: '',
    consumerSecret: ''
  });

  // Zapier/Webhook connection state
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    loadIntegrations();
    loadWhatsAppStatus();
    loadTrendyolStatus();
    loadCargoStatus();
    loadIyzicoStatus();
    loadParasutStatus();
    loadEmailStatus();
    loadShopifyStatus();
    loadWooCommerceStatus();
    loadWebhookStatus();
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

  // Load Cargo integrations status
  const loadCargoStatus = async () => {
    try {
      const response = await apiClient.get('/api/cargo/connected');
      const statusMap = {};
      if (response.data.carriers) {
        response.data.carriers.forEach(carrier => {
          statusMap[carrier.carrier] = carrier;
        });
      }
      setCargoStatus(statusMap);
    } catch (error) {
      console.error('Failed to load cargo status:', error);
    }
  };

  // Handle cargo connection
  const handleCargoConnect = async () => {
    if (!activeCargoCarrier) return;

    // Validate fields based on carrier
    if (activeCargoCarrier === 'yurtici' || activeCargoCarrier === 'aras') {
      if (!cargoForm.customerCode || !cargoForm.username || !cargoForm.password) {
        toast.error('Please fill in all required fields');
        return;
      }
    } else if (activeCargoCarrier === 'mng') {
      if (!cargoForm.apiKey) {
        toast.error('API Key is required');
        return;
      }
    }

    setCargoLoading(true);
    try {
      const endpoint = `/api/cargo/${activeCargoCarrier}/connect`;
      const payload = activeCargoCarrier === 'mng'
        ? { apiKey: cargoForm.apiKey, customerId: cargoForm.customerCode }
        : { customerCode: cargoForm.customerCode, username: cargoForm.username, password: cargoForm.password };

      const response = await apiClient.post(endpoint, payload);

      if (response.data.success) {
        toast.success(`${getCarrierName(activeCargoCarrier)} connected successfully!`);
        setCargoModalOpen(false);
        resetCargoForm();
        await loadCargoStatus();
        await loadIntegrations();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Connection failed';
      toast.error(errorMsg);
    } finally {
      setCargoLoading(false);
    }
  };

  // Handle cargo disconnection
  const handleCargoDisconnect = async (carrier) => {
    if (!confirm(`Are you sure you want to disconnect ${getCarrierName(carrier)}?`)) return;

    try {
      await apiClient.post(`/api/cargo/${carrier}/disconnect`);
      toast.success(`${getCarrierName(carrier)} disconnected`);
      await loadCargoStatus();
      await loadIntegrations();
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  // Test cargo connection
  const handleCargoTest = async (carrier) => {
    try {
      const response = await apiClient.post(`/api/cargo/${carrier}/test`);
      if (response.data.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(response.data.error || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Connection test failed');
    }
  };

  // Reset cargo form
  const resetCargoForm = () => {
    setCargoForm({
      customerCode: '',
      username: '',
      password: '',
      apiKey: ''
    });
    setActiveCargoCarrier(null);
  };

  // Get carrier display name
  const getCarrierName = (carrier) => {
    const names = {
      yurtici: 'Yurtiçi Kargo',
      aras: 'Aras Kargo',
      mng: 'MNG Kargo'
    };
    return names[carrier] || carrier;
  };

  // Open cargo modal for specific carrier
  const openCargoModal = (carrier) => {
    setActiveCargoCarrier(carrier);
    setCargoModalOpen(true);
  };

  // Load iyzico connection status
  const loadIyzicoStatus = async () => {
    try {
      const response = await apiClient.get('/api/iyzico/status');
      setIyzicoStatus(response.data);
    } catch (error) {
      console.error('Failed to load iyzico status:', error);
    }
  };

  // Load Parasut connection status
  const loadParasutStatus = async () => {
    try {
      const response = await apiClient.get('/api/parasut/status');
      setParasutStatus(response.data);
    } catch (error) {
      console.error('Failed to load Parasut status:', error);
    }
  };

  // Load Shopify connection status
  const loadShopifyStatus = async () => {
    try {
      const response = await apiClient.get('/api/shopify/status');
      setShopifyStatus(response.data);
    } catch (error) {
      console.error('Failed to load Shopify status:', error);
    }
  };

  // Load WooCommerce connection status
  const loadWooCommerceStatus = async () => {
    try {
      const response = await apiClient.get('/api/woocommerce/status');
      setWoocommerceStatus(response.data);
    } catch (error) {
      console.error('Failed to load WooCommerce status:', error);
    }
  };

  // Load Webhook/Zapier connection status
  const loadWebhookStatus = async () => {
    try {
      const response = await apiClient.get('/api/webhook/status');
      setWebhookStatus(response.data);
    } catch (error) {
      console.error('Failed to load Webhook status:', error);
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

  // Handle iyzico connection
  const handleIyzicoConnect = async () => {
    if (!iyzicoForm.apiKey || !iyzicoForm.secretKey) {
      toast.error('Please fill in API Key and Secret Key');
      return;
    }

    setIyzicoLoading(true);
    try {
      const response = await apiClient.post('/api/iyzico/connect', iyzicoForm);

      if (response.data.success) {
        toast.success('iyzico connected successfully!');
        setIyzicoModalOpen(false);
        setIyzicoForm({
          apiKey: '',
          secretKey: '',
          environment: 'sandbox'
        });
        await loadIyzicoStatus();
        await loadIntegrations();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to connect iyzico';
      toast.error(errorMsg);
    } finally {
      setIyzicoLoading(false);
    }
  };

  // Handle iyzico disconnection
  const handleIyzicoDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect iyzico?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/iyzico/disconnect'),
        'Disconnecting iyzico...',
        'iyzico disconnected successfully'
      );
      await loadIyzicoStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };

  // Handle Parasut disconnection
  const handleParasutDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Parasut?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/parasut/disconnect'),
        'Disconnecting Parasut...',
        'Parasut disconnected successfully'
      );
      await loadParasutStatus();
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

  // Load Trendyol connection status
  const loadTrendyolStatus = async () => {
    try {
      const response = await apiClient.get('/api/trendyol/status');
      setTrendyolStatus(response.data);
    } catch (error) {
      console.error('Failed to load Trendyol status:', error);
    }
  };

  // Handle Trendyol connection
  const handleTrendyolConnect = async () => {
    if (!trendyolForm.supplierId || !trendyolForm.apiKey || !trendyolForm.apiSecret) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setTrendyolLoading(true);
    try {
      const response = await apiClient.post('/api/trendyol/connect', trendyolForm);

      if (response.data.success) {
        toast.success('Trendyol hesabı başarıyla bağlandı!');
        setTrendyolModalOpen(false);
        setTrendyolForm({
          supplierId: '',
          apiKey: '',
          apiSecret: ''
        });
        await loadTrendyolStatus();
        await loadIntegrations();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Trendyol bağlantısı başarısız';
      toast.error(errorMsg);
    } finally {
      setTrendyolLoading(false);
    }
  };

  // Handle Trendyol connection test
  const handleTrendyolTest = async () => {
    setTrendyolTestLoading(true);
    try {
      const response = await apiClient.post('/api/trendyol/test');

      if (response.data.success) {
        toast.success('Trendyol bağlantısı çalışıyor!');
      } else {
        toast.error(response.data.message || 'Bağlantı testi başarısız');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Bağlantı testi başarısız';
      toast.error(errorMsg);
    } finally {
      setTrendyolTestLoading(false);
    }
  };

  // Handle Trendyol disconnection
  const handleTrendyolDisconnect = async () => {
    if (!confirm('Trendyol bağlantısını kesmek istediğinize emin misiniz?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/trendyol/disconnect'),
        'Trendyol bağlantısı kesiliyor...',
        'Trendyol bağlantısı kesildi'
      );
      await loadTrendyolStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };

  // ============ SHOPIFY HANDLERS ============

  // Handle Shopify connection
  const handleShopifyConnect = async () => {
    if (!shopifyForm.shopUrl || !shopifyForm.accessToken) {
      toast.error('Please fill in all fields');
      return;
    }

    setShopifyLoading(true);
    try {
      const response = await apiClient.post('/api/shopify/connect', shopifyForm);

      if (response.data.success) {
        toast.success(`Connected to ${response.data.shop?.name || 'Shopify'}!`);
        setShopifyModalOpen(false);
        setShopifyForm({ shopUrl: '', accessToken: '' });
        await loadShopifyStatus();
        await loadIntegrations();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to connect Shopify';
      toast.error(errorMsg);
    } finally {
      setShopifyLoading(false);
    }
  };

  // Handle Shopify disconnection
  const handleShopifyDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Shopify?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/shopify/disconnect'),
        'Disconnecting Shopify...',
        'Shopify disconnected successfully'
      );
      await loadShopifyStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };
  // ============ WOOCOMMERCE HANDLERS ============

  // Handle WooCommerce connection
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
      const errorMsg = error.response?.data?.error || 'Failed to connect WooCommerce';
      toast.error(errorMsg);
    } finally {
      setWoocommerceLoading(false);
    }
  };

  // Handle WooCommerce disconnection
  const handleWooCommerceDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WooCommerce?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/woocommerce/disconnect'),
        'Disconnecting WooCommerce...',
        'WooCommerce disconnected successfully'
      );
      await loadWooCommerceStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };

  // ============ WEBHOOK/ZAPIER HANDLERS ============

  // Setup Webhook
  const handleWebhookSetup = async () => {
    setWebhookLoading(true);
    try {
      const response = await apiClient.post('/api/webhook/setup');

      if (response.data.success) {
        toast.success('Webhook activated successfully!');
        await loadWebhookStatus();
        await loadIntegrations();
        // Fetch full config to show URL
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to setup webhook';
      toast.error(errorMsg);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Disable Webhook
  const handleWebhookDisable = async () => {
    if (!confirm('Are you sure you want to disable the webhook?')) return;

    try {
      await toastHelpers.async(
        apiClient.post('/api/webhook/disable'),
        'Disabling webhook...',
        'Webhook disabled successfully'
      );
      await loadWebhookStatus();
      await loadIntegrations();
    } catch (error) {
      // Error handled by toastHelpers
    }
  };

  // Regenerate Webhook Secret
  const handleWebhookRegenerate = async () => {
    if (!confirm('Are you sure? This will invalidate the current webhook URL.')) return;

    setWebhookLoading(true);
    try {
      const response = await apiClient.post('/api/webhook/regenerate');

      if (response.data.success) {
        toast.success('Webhook URL regenerated!');
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to regenerate webhook';
      toast.error(errorMsg);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

>>>>>>> origin/claude/add-ecommerce-integrations-01BYcaPrXeqwnT6fdMyfGEFw
  const handleConnect = async (integration) => {
    try {
      // WhatsApp - Show modal
      if (integration.type === 'WHATSAPP') {
        setWhatsappModalOpen(true);
        return;
      }

      // Trendyol - Show modal
      if (integration.type === 'TRENDYOL') {
        setTrendyolModalOpen(true);
        return;
      }

      // Cargo integrations - Show modal
      if (integration.type === 'YURTICI_KARGO') {
        openCargoModal('yurtici');
        return;
      }
      if (integration.type === 'ARAS_KARGO') {
        openCargoModal('aras');
        return;
      }
      if (integration.type === 'MNG_KARGO') {
        openCargoModal('mng');
        return;
      }

      // iyzico - Show modal
      if (integration.type === 'IYZICO') {
        setIyzicoModalOpen(true);
        return;
      }

      // Parasut - OAuth flow
      if (integration.type === 'PARASUT') {
        const response = await apiClient.get('/api/parasut/auth');
        window.location.href = response.data.authUrl;
        return;
      }

      // Shopify - Show modal
      if (integration.type === 'SHOPIFY') {
        setShopifyModalOpen(true);
        return;
      }

      // WooCommerce - Show modal
      if (integration.type === 'WOOCOMMERCE') {
        setWoocommerceModalOpen(true);
        return;
      }

      // Zapier/Webhook - Show modal
      if (integration.type === 'ZAPIER') {
        // If not configured, set it up first
        if (!webhookStatus?.configured) {
          await handleWebhookSetup();
        }
        // Fetch full config before showing modal
        const configResponse = await apiClient.get('/api/webhook/config');
        setWebhookStatus({ ...webhookStatus, ...configResponse.data });
        setWebhookModalOpen(true);
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
      } else if (integration.type === 'TRENDYOL') {
        await handleTrendyolDisconnect();
      } else if (integration.type === 'YURTICI_KARGO') {
        await handleCargoDisconnect('yurtici');
      } else if (integration.type === 'ARAS_KARGO') {
        await handleCargoDisconnect('aras');
      } else if (integration.type === 'MNG_KARGO') {
        await handleCargoDisconnect('mng');
      } else if (integration.type === 'IYZICO') {
        await handleIyzicoDisconnect();
      } else if (integration.type === 'PARASUT') {
        await handleParasutDisconnect();
      } else if (integration.type === 'SHOPIFY') {
        await handleShopifyDisconnect();
      } else if (integration.type === 'WOOCOMMERCE') {
        await handleWooCommerceDisconnect();
      } else if (integration.type === 'ZAPIER') {
        await handleWebhookDisable();
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
      if (integration.type === 'TRENDYOL') {
        await handleTrendyolTest();
        return;
      }

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

      {/* Trendyol Connection Modal */}
      <Dialog open={trendyolModalOpen} onOpenChange={setTrendyolModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trendyol Satıcı Hesabı Bağla</DialogTitle>
            <DialogDescription>
              Trendyol mağazanızı bağlayarak AI asistanınızın sipariş durumu ve stok bilgisi sorgulamasını sağlayın.
      {/* Shopify Connection Modal */}
      <Dialog open={shopifyModalOpen} onOpenChange={setShopifyModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Shopify Store</DialogTitle>
            <DialogDescription>
              Connect your Shopify store to enable order tracking and inventory management through AI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Setup Instructions */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-orange-900 mb-3">Kurulum Adımları:</h4>
              <ol className="space-y-2 text-sm text-orange-800 list-decimal list-inside">
                <li><a href="https://partner.trendyol.com" target="_blank" rel="noopener noreferrer" className="underline">Trendyol Partner Portal</a>'a giriş yapın</li>
                <li>Entegrasyon Bilgileri sayfasına gidin</li>
                <li>API Key ve API Secret bilgilerini kopyalayın</li>
                <li>Supplier ID (Satıcı ID) bilgisini not alın</li>
                <li>Bilgileri aşağıdaki alanlara girin</li>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-green-900 mb-3">How to get your Access Token:</h4>
              <ol className="space-y-2 text-sm text-green-800 list-decimal list-inside">
                <li>Go to Shopify Admin → Settings → Apps and sales channels</li>
                <li>Click "Develop apps" → "Create an app"</li>
                <li>Configure Admin API scopes: read_orders, read_products, read_inventory</li>
                <li>Install the app and copy the Admin API access token</li>
              </ol>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier ID (Satıcı ID) *</Label>
                <Input
                  id="supplierId"
                  type="text"
                  placeholder="Örn: 123456"
                  value={trendyolForm.supplierId}
                  onChange={(e) => setTrendyolForm({ ...trendyolForm, supplierId: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Trendyol Partner Portal'da Entegrasyon Bilgileri sayfasında bulunur</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="text"
                  placeholder="API Key'inizi girin"
                  value={trendyolForm.apiKey}
                  onChange={(e) => setTrendyolForm({ ...trendyolForm, apiKey: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret *</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="API Secret'ınızı girin"
                  value={trendyolForm.apiSecret}
                  onChange={(e) => setTrendyolForm({ ...trendyolForm, apiSecret: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Bu bilgi güvenli şekilde saklanacaktır</p>
              </div>
            </div>

            {/* Features Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">Bağlandığınızda AI asistanınız:</h4>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Müşterilere sipariş durumu bilgisi verebilecek</li>
                <li>• Kargo takip bilgisi sorgulayabilecek</li>
                <li>• Ürün stok durumunu kontrol edebilecek</li>
              </ul>
            </div>

            {/* Connection Status */}
            {trendyolStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Bağlantı Aktif</p>
                  <p className="text-xs text-green-700">
                    Son senkronizasyon: {trendyolStatus.lastSync ? new Date(trendyolStatus.lastSync).toLocaleString('tr-TR') : 'Henüz yapılmadı'}
                <Label htmlFor="shopifyShopUrl">Shop URL *</Label>
                <Input
                  id="shopifyShopUrl"
                  type="text"
                  placeholder="mystore.myshopify.com"
                  value={shopifyForm.shopUrl}
                  onChange={(e) => setShopifyForm({ ...shopifyForm, shopUrl: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Your Shopify store URL (without https://)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyAccessToken">Admin API Access Token *</Label>
                <Input
                  id="shopifyAccessToken"
                  type="password"
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
                  value={shopifyForm.accessToken}
                  onChange={(e) => setShopifyForm({ ...shopifyForm, accessToken: e.target.value })}
                />
                <p className="text-xs text-neutral-500">This will be encrypted and stored securely</p>
              </div>
            </div>

            {/* Connection Status */}
            {shopifyStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Currently Connected</p>
                  <p className="text-xs text-green-700">
                    Store: {shopifyStatus.shopName || shopifyStatus.shopDomain}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTrendyolModalOpen(false)}
              disabled={trendyolLoading}
            >
              İptal
            </Button>
            <Button
              onClick={handleTrendyolConnect}
              disabled={trendyolLoading}
            >
              {trendyolLoading ? 'Bağlanıyor...' : 'Trendyol\'u Bağla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cargo Integration Modal */}
      <Dialog open={cargoModalOpen} onOpenChange={(open) => {
        setCargoModalOpen(open);
        if (!open) resetCargoForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeCargoCarrier && `Connect ${getCarrierName(activeCargoCarrier)}`}
            </DialogTitle>
            <DialogDescription>
              Connect your cargo integration to enable AI-powered shipment tracking for your customers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Different form fields based on carrier */}
            {(activeCargoCarrier === 'yurtici' || activeCargoCarrier === 'aras') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customerCode">Customer Code / Musteri Kodu *</Label>
                  <Input
                    id="customerCode"
                    type="text"
                    placeholder="Enter your customer code"
                    value={cargoForm.customerCode}
                    onChange={(e) => setCargoForm({ ...cargoForm, customerCode: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargoUsername">Username / Kullanici Adi *</Label>
                  <Input
                    id="cargoUsername"
                    type="text"
                    placeholder="Enter your username"
                    value={cargoForm.username}
                    onChange={(e) => setCargoForm({ ...cargoForm, username: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargoPassword">Password / Sifre *</Label>
                  <Input
                    id="cargoPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={cargoForm.password}
                    onChange={(e) => setCargoForm({ ...cargoForm, password: e.target.value })}
                  />
                  <p className="text-xs text-neutral-500">This will be encrypted and stored securely</p>
                </div>
              </>
            )}

            {activeCargoCarrier === 'mng' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mngApiKey">API Key *</Label>
                  <Input
                    id="mngApiKey"
                    type="password"
                    placeholder="Enter your MNG API Key"
                    value={cargoForm.apiKey}
                    onChange={(e) => setCargoForm({ ...cargoForm, apiKey: e.target.value })}
                  />
                  <p className="text-xs text-neutral-500">Your MNG Kargo API key from the developer portal</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mngCustomerId">Customer ID (Optional)</Label>
                  <Input
                    id="mngCustomerId"
                    type="text"
                    placeholder="Enter your customer ID if applicable"
                    value={cargoForm.customerCode}
                    onChange={(e) => setCargoForm({ ...cargoForm, customerCode: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                <Truck className="h-4 w-4 inline mr-1" />
                What does this integration do?
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>AI assistant can track shipments for your customers</li>
                <li>Customers can ask "Where is my cargo?" and get instant status</li>
                <li>Automatic carrier detection when tracking number is provided</li>
                <li>Works with phone calls and chat conversations</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCargoModalOpen(false);
                resetCargoForm();
              }}
              disabled={cargoLoading}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShopifyModalOpen(false)}
              disabled={shopifyLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCargoConnect}
              disabled={cargoLoading}
            >
              {cargoLoading ? 'Connecting...' : `Connect ${activeCargoCarrier ? getCarrierName(activeCargoCarrier) : ''}`}
              onClick={handleShopifyConnect}
              disabled={shopifyLoading}
            >
              {shopifyLoading ? 'Connecting...' : 'Connect Shopify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* iyzico Connection Modal */}
      <Dialog open={iyzicoModalOpen} onOpenChange={setIyzicoModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect iyzico Payment Gateway</DialogTitle>
            <DialogDescription>
              Connect your iyzico account to enable payment and refund status tracking.
      {/* WooCommerce Connection Modal */}
      <Dialog open={woocommerceModalOpen} onOpenChange={setWoocommerceModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect WooCommerce Store</DialogTitle>
            <DialogDescription>
              Connect your WooCommerce store to enable order tracking and inventory management through AI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Setup Instructions */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-purple-900 mb-3">Setup Instructions:</h4>
              <ol className="space-y-2 text-sm text-purple-800 list-decimal list-inside">
                <li>Log in to your <a href="https://merchant.iyzipay.com" target="_blank" rel="noopener noreferrer" className="underline">iyzico Merchant Panel</a></li>
                <li>Go to Settings &gt; API Settings</li>
                <li>Copy your API Key and Secret Key</li>
                <li>Select the appropriate environment (Sandbox for testing)</li>
              <h4 className="font-semibold text-sm text-purple-900 mb-3">How to get your API Keys:</h4>
              <ol className="space-y-2 text-sm text-purple-800 list-decimal list-inside">
                <li>Go to WordPress Admin → WooCommerce → Settings → Advanced → REST API</li>
                <li>Click "Add key" to create a new API key</li>
                <li>Set Description: "Telyx.ai Integration"</li>
                <li>Select User and set Permissions to "Read"</li>
                <li>Click "Generate API key" and copy both keys</li>
              </ol>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="iyzicoApiKey">API Key *</Label>
                <Input
                  id="iyzicoApiKey"
                  type="text"
                  placeholder="Enter your iyzico API Key"
                  value={iyzicoForm.apiKey}
                  onChange={(e) => setIyzicoForm({ ...iyzicoForm, apiKey: e.target.value })}
                <Label htmlFor="wooSiteUrl">Site URL *</Label>
                <Input
                  id="wooSiteUrl"
                  type="text"
                  placeholder="https://mystore.com"
                  value={woocommerceForm.siteUrl}
                  onChange={(e) => setWoocommerceForm({ ...woocommerceForm, siteUrl: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Your WordPress/WooCommerce site URL</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wooConsumerKey">Consumer Key *</Label>
                <Input
                  id="wooConsumerKey"
                  type="text"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={woocommerceForm.consumerKey}
                  onChange={(e) => setWoocommerceForm({ ...woocommerceForm, consumerKey: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iyzicoSecretKey">Secret Key *</Label>
                <div className="relative">
                  <Input
                    id="iyzicoSecretKey"
                    type={showIyzicoSecret ? 'text' : 'password'}
                    placeholder="Enter your iyzico Secret Key"
                    value={iyzicoForm.secretKey}
                    onChange={(e) => setIyzicoForm({ ...iyzicoForm, secretKey: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowIyzicoSecret(!showIyzicoSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                  >
                    {showIyzicoSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-500">This will be encrypted and stored securely</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="iyzicoEnvironment">Environment *</Label>
                <select
                  id="iyzicoEnvironment"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  value={iyzicoForm.environment}
                  onChange={(e) => setIyzicoForm({ ...iyzicoForm, environment: e.target.value })}
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Live)</option>
                </select>
                <p className="text-xs text-neutral-500">Use Sandbox for testing before going live</p>
                <Label htmlFor="wooConsumerSecret">Consumer Secret *</Label>
                <Input
                  id="wooConsumerSecret"
                  type="password"
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={woocommerceForm.consumerSecret}
                  onChange={(e) => setWoocommerceForm({ ...woocommerceForm, consumerSecret: e.target.value })}
                />
                <p className="text-xs text-neutral-500">Both keys will be encrypted and stored securely</p>
              </div>
            </div>

            {/* Connection Status */}
            {iyzicoStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Currently Connected</p>
                  <p className="text-xs text-green-700">
                    Environment: {iyzicoStatus.environment === 'production' ? 'Production' : 'Sandbox'}
            {woocommerceStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Currently Connected</p>
                  <p className="text-xs text-purple-700">
                    Store: {woocommerceStatus.storeName || woocommerceStatus.siteUrl}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIyzicoModalOpen(false)}
              disabled={iyzicoLoading}
              onClick={() => setWoocommerceModalOpen(false)}
              disabled={woocommerceLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIyzicoConnect}
              disabled={iyzicoLoading}
            >
              {iyzicoLoading ? 'Connecting...' : 'Connect iyzico'}
              onClick={handleWooCommerceConnect}
              disabled={woocommerceLoading}
            >
              {woocommerceLoading ? 'Connecting...' : 'Connect WooCommerce'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zapier/Webhook Modal */}
      <Dialog open={webhookModalOpen} onOpenChange={setWebhookModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zapier / Webhook Integration</DialogTitle>
            <DialogDescription>
              Connect any system via webhook. Use with Zapier, Make.com, or your custom integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {webhookStatus?.configured ? (
              <>
                {/* Webhook URL */}
                <div className="space-y-2">
                  <Label>Your Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      readOnly
                      value={webhookStatus.webhookUrl || ''}
                      className="bg-neutral-50 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookStatus.webhookUrl, 'url')}
                    >
                      {copiedField === 'url' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-500">Send POST requests to this URL with your order/inventory data</p>
                </div>

                {/* Usage Instructions */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-orange-900 mb-3">Supported Webhook Formats:</h4>
                  <div className="space-y-3 text-sm text-orange-800">
                    <div>
                      <p className="font-medium">Order Notification:</p>
                      <pre className="bg-orange-100 p-2 rounded text-xs mt-1 overflow-x-auto">
{`{
  "type": "order",
  "action": "created",
  "order": {
    "id": "ORD-123",
    "customer_name": "John Doe",
    "customer_phone": "+905551234567",
    "status": "processing",
    "total": 250.00
  }
}`}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium">Inventory Update:</p>
                      <pre className="bg-orange-100 p-2 rounded text-xs mt-1 overflow-x-auto">
{`{
  "type": "inventory",
  "product": {
    "sku": "PROD-001",
    "name": "Product Name",
    "stock": 50
  }
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleWebhookRegenerate}
                    disabled={webhookLoading}
                    className="flex-1"
                  >
                    {webhookLoading ? 'Regenerating...' : 'Regenerate URL'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleWebhookDisable}
                    disabled={webhookLoading}
                    className="flex-1"
                  >
                    Disable Webhook
                  </Button>
                </div>

                {/* Stats */}
                {webhookStatus.stats && (
                  <div className="flex gap-4 p-3 bg-neutral-50 rounded-lg">
                    <div>
                      <p className="text-xs text-neutral-500">Recent Webhooks (24h)</p>
                      <p className="text-lg font-semibold">{webhookStatus.stats.recentWebhooks || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Total Orders</p>
                      <p className="text-lg font-semibold">{webhookStatus.stats.totalOrders || 0}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">Click "Activate Webhook" to get your unique webhook URL</p>
                <Button onClick={handleWebhookSetup} disabled={webhookLoading}>
                  {webhookLoading ? 'Activating...' : 'Activate Webhook'}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWebhookModalOpen(false)}
            >
              Close
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
    YURTICI_KARGO: 'Yurtiçi Kargo ile kargo takip entegrasyonu - AI asistanınız müşteri kargolarını takip edebilir',
    ARAS_KARGO: 'Aras Kargo ile kargo takip entegrasyonu - Otomatik kargo durumu sorgulama',
    MNG_KARGO: 'MNG Kargo ile kargo takip entegrasyonu - Anlık kargo bilgisi',
    SLACK: 'Team communication and notifications',
    TWILIO_SMS: 'SMS notifications and messaging',
    SENDGRID_EMAIL: 'Email delivery and transactional emails',
    TRENDYOL: 'Trendyol mağazanızı bağlayın - sipariş ve stok sorgulama',
    PARASUT: 'Turkish accounting software - Invoice and contact management',
    IYZICO: 'Turkish payment gateway - Payment and refund tracking'
  };
  return descriptions[type] || `${category} integration`;
}
