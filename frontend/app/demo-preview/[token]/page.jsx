'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { AlertCircle, Loader2 } from 'lucide-react';
import VoiceDemo from '@/components/VoiceDemo';
import { TelyxLogoFull } from '@/components/TelyxLogo';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function DemoPreviewPage({ params }) {
  const { resolvedTheme } = useTheme();
  const token = useMemo(() => decodeURIComponent(params?.token || ''), [params?.token]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!token || !API_BASE_URL) {
        setError('Demo önizlemesi başlatılamadı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/leads/preview/${encodeURIComponent(token)}?activate=1`, {
          method: 'GET',
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || 'Demo önizlemesi hazırlanamadı.');
        }

        if (!cancelled) {
          setPreview(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Demo önizlemesi hazırlanamadı.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <main
      className={`min-h-screen px-4 py-10 ${
        isDark ? 'bg-[#030b1a] text-white' : 'bg-[#eef3f9] text-[#051752]'
      }`}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div
          className={`rounded-[28px] px-6 py-8 sm:px-10 ${
            isDark
              ? 'border border-[#173153] bg-[#081224] shadow-[0_28px_90px_rgba(0,0,0,0.52)]'
              : 'border border-[#d7e2f0] bg-white shadow-[0_18px_60px_rgba(5,23,82,0.08)]'
          }`}
        >
          <TelyxLogoFull width={192} height={44} darkMode={isDark} />

          <div className="mt-8">
            <h1 className={`text-3xl font-semibold tracking-[-0.03em] sm:text-4xl ${isDark ? 'text-white' : 'text-[#051752]'}`}>
              {preview?.leadName ? `Merhaba ${preview.leadName},` : 'Merhaba,'}
            </h1>
            <p
              className={`mt-4 max-w-2xl text-base leading-7 sm:text-lg ${
                isDark ? 'text-[#d2dff3]' : 'text-[#52637d]'
              }`}
            >
              Telyx demo önizlemesine hoş geldiniz. Aşağıdan yapay zeka asistanımızla doğrudan konuşabilir, nasıl çalıştığını canlı olarak deneyebilirsiniz.
            </p>
          </div>

          <div
            className={`mt-8 rounded-[24px] p-5 sm:p-6 ${
              isDark
                ? 'border border-[#173153] bg-[#0d1a31]'
                : 'border border-[#d7e2f0] bg-[#f7f9fc]'
            }`}
          >
            {loading ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
                <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-white' : 'text-[#051752]'}`} />
                <p className={`text-sm ${isDark ? 'text-[#b9c9e1]' : 'text-[#52637d]'}`}>Demo önizlemesi hazırlanıyor...</p>
              </div>
            ) : error ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <div>
                  <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-[#051752]'}`}>Önizleme başlatılamadı</p>
                  <p className={`mt-2 text-sm ${isDark ? 'text-[#b9c9e1]' : 'text-[#52637d]'}`}>{error}</p>
                </div>
              </div>
            ) : preview?.previewAssistantId ? (
              <div className="space-y-4">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    isDark
                      ? 'border border-[#1b365c] bg-[#081224] text-[#d2dff3]'
                      : 'border border-[#d7e2f0] bg-white text-[#52637d]'
                  }`}
                >
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-[#051752]'}`}>
                    Asistan hazır:
                  </span>{' '}
                  <strong className={isDark ? 'text-white' : 'text-[#051752]'}>Demo</strong>
                </div>

                <VoiceDemo
                  assistantId={preview.previewAssistantId}
                  previewFirstMessage={preview.previewFirstMessage || ''}
                />
              </div>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <div>
                  <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-[#051752]'}`}>Henüz kullanılabilir bir demo asistanı yok</p>
                  <p className={`mt-2 text-sm ${isDark ? 'text-[#b9c9e1]' : 'text-[#52637d]'}`}>
                    Demo önizlemesini başlatmak için panelde voice özellikli bir asistanın aktif olması gerekiyor.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className={`mt-5 text-xs leading-6 ${isDark ? 'text-[#a9bddb]' : 'text-[#71829c]'}`}>
            Not: Tarayıcınız mikrofon izni isterse onaylayın. Bu ekran, gerçek telefon araması başlatmadan panel içi demo konuşması içindir.
          </p>
        </div>
      </div>
    </main>
  );
}
