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
  ShoppingCart, Utensils, Scissors, Stethoscope, Package, Mail, Hash, Truck,
  Calculator, Wallet, Eye, EyeOff, Inbox, RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast, toastHelpers } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

const INTEGRATION_ICONS = {
  GOOGLE_CALENDAR: CalendarDays, WHATSAPP: Smartphone, CALENDLY: Calendar,
  SHOPIFY: ShoppingCart, WOOCOMMERCE: ShoppingCart, STRIPE_PAYMENTS: CreditCard,
  SQUARE: CreditCard, OPENTABLE: Utensils, TOAST_POS: Utensils,
  SIMPLEPRACTICE: Stethoscope, ZOCDOC: Stethoscope, BOOKSY: Scissors,
  FRESHA: Scissors, SHIPSTATION: Package, KLAVIYO: Mail, MAILCHIMP: Mail,
  HUBSPOT: Target, SALESFORCE: Cloud, GOOGLE_SHEETS: BarChart3, ZAPIER: Zap,
  SLACK: MessageSquare, TWILIO_SMS: MessageSquare, SENDGRID_EMAIL: Mail,
  TRENDYOL: ShoppingCart, YURTICI_KARGO: Truck, ARAS_KARGO: Truck,
  MNG_KARGO: Truck, PARASUT: Calculator, IYZICO: Wallet, CUSTOM: Hash
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
  cargo: { icon: 'text-orange-600', bg: 'bg-orange-100' },
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
  TRENDYOL: 'https://developers.trendyol.com',
  PARASUT: 'https://apidocs.parasut.com',
  IYZICO: 'https://dev.iyzipay.com',
  ZAPIER: 'https://zapier.com/developer'
};

export default function IntegrationsPage() {
  const { t } = useLanguage();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState('OTHER');

  // WhatsApp state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({ accessToken: '', phoneNumberId: '', verifyToken: '' });

  // Trendyol state
  const [trendyolModalOpen, setTrendyolModalOpen] = useState(false);
  const [trendyolStatus, setTrendyolStatus] = useState(null);
  const [trendyolLoading, setTrendyolLoading] = useState(false);
  const [trendyolForm, setTrendyolForm] = useState({ supplierId: '', apiKey: '', apiSecret: '' });

  // Cargo state
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [activeCargoCarrier, setActiveCargoCarrier] = useState(null);
  const [cargoLoading, setCargoLoading] = useState(false);
  const [cargoStatus, setCargoStatus] = useState({});
  const [cargoForm, setCargoForm] = useState({ customerCode: '', username: '', password: '', apiKey: '' });

  // iyzico state
  const [iyzicoModalOpen, setIyzicoModalOpen] = useState(false);
  const [iyzicoStatus, setIyzicoStatus] = useState(null);
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  const [iyzicoForm, setIyzicoForm] = useState({ apiKey: '', secretKey: '', environment: 'sandbox' });
  const [showIyzicoSecret, setShowIyzicoSecret] = useState(false);

  // Parasut state
  const [parasutStatus, setParasutStatus] = useState(null);

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

    // Handle OAuth callback results
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shopifyResult = params.get('shopify');
      const shopName = params.get('shop');
      const errorMessage = params.get('message');

      if (shopifyResult === 'success') {
        toast.success(`Shopify connected successfully${shopName ? `: ${shopName}` : ''}!`);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (shopifyResult === 'error') {
        toast.error(`Failed to connect Shopify${errorMessage ? `: ${decodeURIComponent(errorMessage)}` : ''}`);
        // Clean up URL
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

  const loadTrendyolStatus = async () => {
    try {
      const response = await apiClient.get('/api/trendyol/status');
      setTrendyolStatus(response.data);
    } catch (error) { console.error('Failed to load Trendyol status:', error); }
  };

  const loadCargoStatus = async () => {
    try {
      const response = await apiClient.get('/api/cargo/connected');
      const statusMap = {};
      if (response.data.carriers) {
        response.data.carriers.forEach(carrier => { statusMap[carrier.carrier] = carrier; });
      }
      setCargoStatus(statusMap);
    } catch (error) { console.error('Failed to load cargo status:', error); }
  };

  const loadIyzicoStatus = async () => {
    try {
      const response = await apiClient.get('/api/iyzico/status');
      setIyzicoStatus(response.data);
    } catch (error) { console.error('Failed to load iyzico status:', error); }
  };

  const loadParasutStatus = async () => {
    try {
      const response = await apiClient.get('/api/parasut/status');
      setParasutStatus(response.data);
    } catch (error) { console.error('Failed to load Parasut status:', error); }
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

  const handleTrendyolConnect = async () => {
    if (!trendyolForm.supplierId || !trendyolForm.apiKey || !trendyolForm.apiSecret) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    setTrendyolLoading(true);
    try {
      const response = await apiClient.post('/api/trendyol/connect', trendyolForm);
      if (response.data.success) {
        toast.success('Trendyol bağlandı!');
        setTrendyolModalOpen(false);
        setTrendyolForm({ supplierId: '', apiKey: '', apiSecret: '' });
        await loadTrendyolStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Bağlantı başarısız');
    } finally {
      setTrendyolLoading(false);
    }
  };

  const handleTrendyolDisconnect = async () => {
    if (!confirm('Trendyol bağlantısını kesmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.post('/api/trendyol/disconnect');
      toast.success('Trendyol bağlantısı kesildi');
      await loadTrendyolStatus();
      await loadIntegrations();
    } catch (error) { toast.error('Bağlantı kesilemedi'); }
  };

  const getCarrierName = (carrier) => {
    const names = { yurtici: 'Yurtiçi Kargo', aras: 'Aras Kargo', mng: 'MNG Kargo' };
    return names[carrier] || carrier;
  };

  const openCargoModal = (carrier) => {
    setActiveCargoCarrier(carrier);
    setCargoModalOpen(true);
  };

  const resetCargoForm = () => {
    setCargoForm({ customerCode: '', username: '', password: '', apiKey: '' });
    setActiveCargoCarrier(null);
  };

  const handleCargoConnect = async () => {
    if (!activeCargoCarrier) return;
    if ((activeCargoCarrier === 'yurtici' || activeCargoCarrier === 'aras') &&
        (!cargoForm.customerCode || !cargoForm.username || !cargoForm.password)) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (activeCargoCarrier === 'mng' && !cargoForm.apiKey) {
      toast.error('API Key is required');
      return;
    }
    setCargoLoading(true);
    try {
      const endpoint = `/api/cargo/${activeCargoCarrier}/connect`;
      const payload = activeCargoCarrier === 'mng'
        ? { apiKey: cargoForm.apiKey, customerId: cargoForm.customerCode }
        : { customerCode: cargoForm.customerCode, username: cargoForm.username, password: cargoForm.password };
      const response = await apiClient.post(endpoint, payload);
      if (response.data.success) {
        toast.success(`${getCarrierName(activeCargoCarrier)} connected!`);
        setCargoModalOpen(false);
        resetCargoForm();
        await loadCargoStatus();
        await loadIntegrations();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Connection failed');
    } finally {
      setCargoLoading(false);
    }
  };

  const handleCargoDisconnect = async (carrier) => {
    if (!confirm(`Disconnect ${getCarrierName(carrier)}?`)) return;
    try {
      await apiClient.post(`/api/cargo/${carrier}/disconnect`);
      toast.success(`${getCarrierName(carrier)} disconnected`);
      await loadCargoStatus();
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

  const handleParasutDisconnect = async () => {
    if (!confirm('Disconnect Parasut?')) return;
    try {
      await apiClient.post('/api/parasut/disconnect');
      toast.success('Parasut disconnected');
      await loadParasutStatus();
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

  const handleConnect = async (integration) => {
    try {
      if (integration.type === 'WHATSAPP') { setWhatsappModalOpen(true); return; }
      if (integration.type === 'TRENDYOL') { setTrendyolModalOpen(true); return; }
      if (integration.type === 'YURTICI_KARGO') { openCargoModal('yurtici'); return; }
      if (integration.type === 'ARAS_KARGO') { openCargoModal('aras'); return; }
      if (integration.type === 'MNG_KARGO') { openCargoModal('mng'); return; }
      if (integration.type === 'IYZICO') { setIyzicoModalOpen(true); return; }
      if (integration.type === 'PARASUT') {
        const response = await apiClient.get('/api/parasut/auth');
        window.location.href = response.data.authUrl;
        return;
      }
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
      toast.info(`${integration.name} coming soon!`);
    } catch (error) {
      toast.error('Failed to connect');
    }
  };

  const handleDisconnect = async (integration) => {
  if (!confirm('Disconnect this integration?')) return;
  try {
    if (integration.type === 'WHATSAPP') await handleWhatsAppDisconnect();
    else if (integration.type === 'TRENDYOL') await handleTrendyolDisconnect();
    else if (integration.type === 'YURTICI_KARGO') await handleCargoDisconnect('yurtici');
    else if (integration.type === 'ARAS_KARGO') await handleCargoDisconnect('aras');
    else if (integration.type === 'MNG_KARGO') await handleCargoDisconnect('mng');
    else if (integration.type === 'IYZICO') await handleIyzicoDisconnect();
    else if (integration.type === 'PARASUT') await handleParasutDisconnect();
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
  } catch (error) { 
    toast.error('Failed to disconnect');
  }
};

  const handleTest = async (integration) => {
  try {
    if (integration.type === 'TRENDYOL') {
      const response = await apiClient.post('/api/trendyol/test');
      if (response.data.success) toast.success('Connection working!');
      else toast.error('Test failed');
      return;
    }
    // ↓↓↓ BU İKİSİNİ EKLE ↓↓↓
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
      GOOGLE_CALENDAR: 'Sync appointments and manage your schedule',
      WHATSAPP: 'AI-powered customer conversations via WhatsApp',
      SHOPIFY: 'Connect your Shopify store for order management',
      WOOCOMMERCE: 'Integrate your WooCommerce store',
      TRENDYOL: 'Trendyol mağazanızı bağlayın - sipariş ve stok sorgulama',
      YURTICI_KARGO: 'Yurtiçi Kargo ile kargo takip entegrasyonu',
      ARAS_KARGO: 'Aras Kargo ile kargo takip entegrasyonu',
      MNG_KARGO: 'MNG Kargo ile kargo takip entegrasyonu',
      PARASUT: 'Turkish accounting - Invoice and contact management',
      IYZICO: 'Turkish payment gateway - Payment and refund tracking',
      ZAPIER: 'Connect thousands of apps with automation'
    };
    return descriptions[type] || 'Integration';
  };

  const renderIntegrationCard = (integration) => {
    const Icon = getIntegrationIcon(integration.type);
    const colors = getCategoryColors(integration.category);
    const docsUrl = getDocsUrl(integration.type);

    return (
      <div key={integration.type} className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${integration.priority === 'ESSENTIAL' ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${colors.bg}`}>
              <Icon className={`h-6 w-6 ${colors.icon}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900">{integration.name}</h3>
                {integration.priority === 'ESSENTIAL' && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
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

        {integration.priority === 'ESSENTIAL' && (
          <div className="mb-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-blue-700" />Essential for your business
          </div>
        )}

        <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{getCategoryDescription(integration.type)}</p>

        <div className="flex gap-2">
          {integration.connected ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleTest(integration)}>Test</Button>
              <Button variant="outline" size="sm" onClick={() => handleDisconnect(integration)}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" className="flex-1" onClick={() => handleConnect(integration)}>Connect</Button>
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
        <h1 className="text-3xl font-bold text-neutral-900">Integrations</h1>
        <p className="text-neutral-600 mt-1">Connect your tools and platforms to enhance your AI assistant</p>
        {businessType && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Target className="h-4 w-4 mr-1" />{getBusinessTypeDisplay(businessType)} Business
            </Badge>
          </div>
        )}
      </div>

      {/* Email Channel Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-600" />Email Channel
          </h2>
          <p className="text-sm text-neutral-600 mt-1">Connect your email to let AI assist with customer emails</p>
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
                  <Badge variant="secondary" className="text-xs mt-1">Email Channel</Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'GMAIL' && (
                <div className="p-1 bg-green-100 rounded-full"><Check className="h-4 w-4 text-green-600" /></div>
              )}
            </div>
            <p className="text-sm text-neutral-600 mb-4">Connect Gmail for AI-assisted email management.</p>
            {emailStatus?.connected && emailStatus?.provider === 'GMAIL' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" /><span>Connected: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = '/dashboard/email'}>
                    <Inbox className="h-4 w-4 mr-1" />Open Inbox
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEmailDisconnect} disabled={emailLoading}>Disconnect</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="w-full" onClick={handleGmailConnect} disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'GMAIL')}>
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : 'Connect Gmail'}
              </Button>
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
                  <Badge variant="secondary" className="text-xs mt-1">Email Channel</Badge>
                </div>
              </div>
              {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' && (
                <div className="p-1 bg-green-100 rounded-full"><Check className="h-4 w-4 text-green-600" /></div>
              )}
            </div>
            <p className="text-sm text-neutral-600 mb-4">Connect Outlook for AI-assisted email management.</p>
            {emailStatus?.connected && emailStatus?.provider === 'OUTLOOK' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" /><span>Connected: {emailStatus.email}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = '/dashboard/email'}>
                    <Inbox className="h-4 w-4 mr-1" />Open Inbox
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEmailDisconnect} disabled={emailLoading}>Disconnect</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="w-full" onClick={handleOutlookConnect} disabled={emailLoading || (emailStatus?.connected && emailStatus?.provider !== 'OUTLOOK')}>
                {emailLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : 'Connect Outlook'}
              </Button>
            )}
          </div>
        </div>
      </div>

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
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />Essential Integrations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.ESSENTIAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {groupedIntegrations.RECOMMENDED.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />Recommended Integrations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.RECOMMENDED.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {groupedIntegrations.OPTIONAL.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-neutral-900">More Integrations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIntegrations.OPTIONAL.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {integrations.length === 0 && (
            <EmptyState icon={Puzzle} title="No integrations available" description="Contact support to enable custom integrations" />
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

      {/* Trendyol Modal */}
      <Dialog open={trendyolModalOpen} onOpenChange={setTrendyolModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trendyol Satıcı Hesabı Bağla</DialogTitle>
            <DialogDescription>Trendyol mağazanızı bağlayarak AI asistanınızın sipariş durumu ve stok bilgisi sorgulamasını sağlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier ID (Satıcı ID) *</Label>
              <Input type="text" placeholder="Örn: 123456" value={trendyolForm.supplierId} onChange={(e) => setTrendyolForm({ ...trendyolForm, supplierId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input type="text" placeholder="API Key'inizi girin" value={trendyolForm.apiKey} onChange={(e) => setTrendyolForm({ ...trendyolForm, apiKey: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>API Secret *</Label>
              <Input type="password" placeholder="API Secret'ınızı girin" value={trendyolForm.apiSecret} onChange={(e) => setTrendyolForm({ ...trendyolForm, apiSecret: e.target.value })} />
            </div>
            {trendyolStatus?.connected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Bağlantı Aktif</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrendyolModalOpen(false)} disabled={trendyolLoading}>İptal</Button>
            <Button onClick={handleTrendyolConnect} disabled={trendyolLoading}>{trendyolLoading ? 'Bağlanıyor...' : "Trendyol'u Bağla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cargo Modal */}
      <Dialog open={cargoModalOpen} onOpenChange={(open) => { setCargoModalOpen(open); if (!open) resetCargoForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeCargoCarrier && `Connect ${getCarrierName(activeCargoCarrier)}`}</DialogTitle>
            <DialogDescription>Connect your cargo integration for AI-powered shipment tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(activeCargoCarrier === 'yurtici' || activeCargoCarrier === 'aras') && (
              <>
                <div className="space-y-2">
                  <Label>Customer Code *</Label>
                  <Input type="text" placeholder="Enter your customer code" value={cargoForm.customerCode} onChange={(e) => setCargoForm({ ...cargoForm, customerCode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Username *</Label>
                  <Input type="text" placeholder="Enter your username" value={cargoForm.username} onChange={(e) => setCargoForm({ ...cargoForm, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input type="password" placeholder="Enter your password" value={cargoForm.password} onChange={(e) => setCargoForm({ ...cargoForm, password: e.target.value })} />
                </div>
              </>
            )}
            {activeCargoCarrier === 'mng' && (
              <>
                <div className="space-y-2">
                  <Label>API Key *</Label>
                  <Input type="password" placeholder="Enter your MNG API Key" value={cargoForm.apiKey} onChange={(e) => setCargoForm({ ...cargoForm, apiKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Customer ID (Optional)</Label>
                  <Input type="text" placeholder="Enter your customer ID" value={cargoForm.customerCode} onChange={(e) => setCargoForm({ ...cargoForm, customerCode: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCargoModalOpen(false); resetCargoForm(); }} disabled={cargoLoading}>Cancel</Button>
            <Button onClick={handleCargoConnect} disabled={cargoLoading}>{cargoLoading ? 'Connecting...' : `Connect ${activeCargoCarrier ? getCarrierName(activeCargoCarrier) : ''}`}</Button>
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
    </div>
  );
}
