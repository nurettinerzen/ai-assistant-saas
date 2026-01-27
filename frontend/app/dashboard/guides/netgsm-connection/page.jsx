/**
 * NetGSM Connection Guide
 * Step-by-step guide for connecting NetGSM phone numbers to AI assistants
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Phone,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Copy,
  Settings,
  CreditCard,
  Headphones
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NetGSMConnectionGuidePage() {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopyalandı!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-teal-600 rounded-xl">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              NetGSM Bağlantı Rehberi
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              NetGSM 0850 numaranızı AI asistanınıza bağlayın
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
              Başlamadan Önce
            </h3>
            <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                NetGSM hesabınız olmalı
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                0850 numaranız aktif olmalı
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                Ses paketi satın almış olmalısınız
              </li>
            </ul>
            <a
              href="https://portal.netgsm.com.tr/satis_arayuzu/ses-paketler.php"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              <CreditCard className="h-4 w-4" />
              Ses Paketi Satın Al
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full text-white font-bold">
                1
              </span>
              <h2 className="text-xl font-semibold text-white">
                NetGSM Paneline Giriş Yapın
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-neutral-700 dark:text-neutral-300">
              NetGSM portalına giriş yapın ve sol menüden <strong>Ses Hizmeti</strong> sekmesine gidin.
            </p>
            <a
              href="https://portal.netgsm.com.tr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              NetGSM Portal
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full text-white font-bold">
                2
              </span>
              <h2 className="text-xl font-semibold text-white">
                SIP Bilgilerinizi Alın
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-neutral-700 dark:text-neutral-300">
              Sol menüden <strong>Ayarlar</strong>'a tıklayın. Açılan sayfada <strong>SIP Bilgileri</strong> bölümünü bulun.
            </p>
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-neutral-900 dark:text-white">Aldığınız bilgiler:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded border">
                  <span className="text-neutral-600 dark:text-neutral-400">SIP Kullanıcı Adı</span>
                  <span className="font-mono text-neutral-900 dark:text-white">8503078914</span>
                </li>
                <li className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded border">
                  <span className="text-neutral-600 dark:text-neutral-400">SIP Sunucu Adresi</span>
                  <span className="font-mono text-neutral-900 dark:text-white">sip.netgsm.com.tr</span>
                </li>
                <li className="flex items-center justify-between p-2 bg-white dark:bg-neutral-900 rounded border">
                  <span className="text-neutral-600 dark:text-neutral-400">SIP Şifresi</span>
                  <span className="font-mono text-neutral-900 dark:text-white">••••••••</span>
                </li>
              </ul>
              <p className="text-xs text-neutral-500 mt-2">
                Şifreyi görmek için "Şifreyi Göster" butonuna tıklayın
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full text-white font-bold">
                3
              </span>
              <h2 className="text-xl font-semibold text-white">
                SIP Trunk Ayarlarını Yapın
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-neutral-700 dark:text-neutral-300">
              Aynı sayfada aşağı kaydırın ve <strong>SIP Trunk</strong> bölümünü bulun.
              SIP Trunk'ı <strong>açık</strong> konuma getirin ve aşağıdaki bilgileri girin:
            </p>
            <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 rounded-lg p-4 border border-teal-200 dark:border-teal-800">
              <h4 className="font-medium text-teal-900 dark:text-teal-100 mb-3">
                SIP Trunk Bilgileri (NetGSM'e girilecek):
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border">
                  <div>
                    <span className="text-sm text-neutral-500">Sunucu Adresi</span>
                    <p className="font-mono font-medium text-neutral-900 dark:text-white">sip.rtc.elevenlabs.io</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('sip.rtc.elevenlabs.io')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border">
                  <div>
                    <span className="text-sm text-neutral-500">Port</span>
                    <p className="font-mono font-medium text-neutral-900 dark:text-white">5060</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('5060')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border">
                  <div>
                    <span className="text-sm text-neutral-500">Transport</span>
                    <p className="font-mono font-medium text-neutral-900 dark:text-white">TCP</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('TCP')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-teal-700 dark:text-teal-300 mt-3">
                ⚠️ Transport mutlaka <strong>TCP</strong> olmalı (UDP desteklenmez)
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                copyToClipboard('sip.rtc.elevenlabs.io');
                toast.success('Tüm bilgiler kopyalandı!');
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Tümünü Kopyala
            </Button>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full text-white font-bold">
                4
              </span>
              <h2 className="text-xl font-semibold text-white">
                Telyx'e Bağlayın
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-neutral-700 dark:text-neutral-300">
              Telyx panelinde <strong>Telefon Numaraları</strong> sayfasına gidin ve
              "Numara Ekle" butonuna tıklayın. Açılan formda NetGSM'den aldığınız SIP bilgilerini girin:
            </p>
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
                Telyx'e girilecek bilgiler:
              </h4>
              <ul className="space-y-2 text-sm text-green-800 dark:text-green-200">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Telefon Numarası:</strong> 0850 numaranız (örn: 08503078914)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>SIP Kullanıcı Adı:</strong> NetGSM'deki kullanıcı adı (örn: 8503078914)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>SIP Şifresi:</strong> NetGSM'deki SIP şifresi</span>
                </li>
              </ul>
            </div>
            <Link href="/dashboard/phone-numbers">
              <Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                <Phone className="h-4 w-4 mr-2" />
                Telefon Numaraları Sayfasına Git
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              Tebrikler! 🎉
            </h3>
            <p className="text-green-800 dark:text-green-200">
              Tüm adımları tamamladıktan sonra numaranız AI asistanınıza bağlanacak ve
              gelen aramalar otomatik olarak yanıtlanacaktır.
            </p>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Headphones className="h-6 w-6 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">
              Yardıma mı ihtiyacınız var?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Bağlantı sırasında sorun yaşarsanız destek ekibimize ulaşabilirsiniz.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="mailto:support@telyx.ai"
                className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                support@telyx.ai
              </a>
              <span className="text-neutral-400">•</span>
              <a
                href="https://wa.me/905551234567"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                WhatsApp Destek
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
