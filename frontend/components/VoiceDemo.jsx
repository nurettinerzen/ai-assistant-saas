'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Conversation } from '@elevenlabs/client';
import { useTheme } from 'next-themes';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

const getElevenLabsWorkletPaths = () => {
  if (typeof window === 'undefined') {
    return {
      rawAudioProcessor: '/elevenlabs-rawAudioProcessor.js',
      audioConcatProcessor: '/elevenlabs-audioConcatProcessor.js',
    };
  }

  const origin = window.location.origin;
  return {
    rawAudioProcessor: `${origin}/elevenlabs-rawAudioProcessor.js`,
    audioConcatProcessor: `${origin}/elevenlabs-audioConcatProcessor.js`,
  };
};

const describeError = (error, fallback = 'Bilinmeyen hata') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof CloseEvent !== 'undefined' && error instanceof CloseEvent) {
    return `Bağlantı beklenmedik şekilde kapandı (${error.code || 'n/a'})`;
  }
  if (error.message && String(error.message).trim()) return error.message;
  if (error.error && String(error.error).trim()) return error.error;
  if (error.response?.data?.error && String(error.response.data.error).trim()) {
    return error.response.data.error;
  }
  if (error.type === 'close' && typeof error.code !== 'undefined') {
    return `Bağlantı beklenmedik şekilde kapandı (${error.code || 'n/a'})`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

export default function VoiceDemo({ assistantId, previewFirstMessage = '', previewAssistantName = '', onClose }) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const conversationRef = useRef(null);
  const isDark = resolvedTheme === 'dark';

  const endCall = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch (error) {
        console.error('Error ending session:', error);
      }
      conversationRef.current = null;
    }
    setIsCallActive(false);
    setIsSpeaking(false);
    setCallStatus(t('onboarding.voiceDemo.callStatus.ended'));
  }, [t]);

  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        endCall();
      }
    };
  }, [endCall]);

  const startCall = async () => {
    try {
      console.log('🎯 Starting 11Labs call with assistantId:', assistantId);
      setIsConnecting(true);
      setCallStatus(t('onboarding.voiceDemo.callStatus.starting'));

      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const tokenUrl = `${BACKEND_URL}/api/elevenlabs/conversation-token/${assistantId}?preview=1`;
      console.log('🎟️ Fetching conversation token from:', tokenUrl);
      const tokenResponse = await fetch(tokenUrl);

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Conversation token request failed (${tokenResponse.status})`);
      }

      const { conversationToken } = await tokenResponse.json();
      if (!conversationToken) {
        throw new Error('Conversation token is empty');
      }

      const sessionConfig = {
        conversationToken,
        connectionType: 'webrtc'
      };
      console.log('✅ Got conversation token for preview WebRTC session');

      // Start conversation using official SDK
      const conversation = await Conversation.startSession({
        ...sessionConfig,
        workletPaths: getElevenLabsWorkletPaths(),
        overrides: previewFirstMessage
          ? {
              agent: {
                firstMessage: previewFirstMessage,
              },
            }
          : undefined,
        onConnect: () => {
          setIsCallActive(true);
          setIsConnecting(false);
          setCallStatus(t('onboarding.voiceDemo.callStatus.started'));
        },
        onDisconnect: () => {
          setIsCallActive(false);
          setIsSpeaking(false);
          setCallStatus(t('onboarding.voiceDemo.callStatus.ended'));
        },
        onError: (error) => {
          console.error('11Labs error:', error);
          setCallStatus('Bağlantı hatası: ' + describeError(error, 'Bağlantı kurulamadı'));
          setIsCallActive(false);
          setIsConnecting(false);
        },
        onModeChange: (mode) => {
          if (mode.mode === 'speaking') {
            setIsSpeaking(true);
            setCallStatus(t('onboarding.voiceDemo.callStatus.speaking'));
          } else {
            setIsSpeaking(false);
            setCallStatus(t('onboarding.voiceDemo.callStatus.listening'));
          }
        },
        onMessage: (message) => {
          console.log('📝 Message:', message);
        }
      });

      conversationRef.current = conversation;
      console.log('✅ Conversation started');

    } catch (error) {
      console.error('Start call error:', error);
      setCallStatus('Bağlantı başlatılamadı: ' + describeError(error, 'Bağlantı kurulamadı'));
      setIsCallActive(false);
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    if (onClose) {
      onClose();
    }
  };

  const isErrorStatus = callStatus.toLowerCase().includes('hata') || callStatus.toLowerCase().includes('başlatılamadı');

  return (
    <div
      className={`relative rounded-[24px] px-5 py-6 text-center shadow-sm sm:px-7 ${
        isDark
          ? 'border border-[#21426f] bg-[#091529]'
          : 'border border-[#d7e2f0] bg-white'
      }`}
    >
      {onClose && (
        <button
          onClick={handleClose}
          className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            isDark
              ? 'border border-[#21426f] bg-[#0d1c36] text-[#c6d6ee] hover:text-white'
              : 'border border-[#d7e2f0] bg-white text-[#52637d] hover:border-[#051752]/20 hover:text-[#051752]'
          }`}
          aria-label="Kapat"
        >
          ×
        </button>
      )}

      <h3 className={`text-2xl font-semibold tracking-[-0.02em] ${isDark ? 'text-white' : 'text-[#051752]'}`}>
        AI sesi test edin
      </h3>
      <p className={`mx-auto mt-3 max-w-xl text-sm leading-6 ${isDark ? 'text-[#c6d6ee]' : 'text-[#52637d]'}`}>
        {assistantId
          ? t('onboarding.voiceDemo.description')
          : t('onboarding.voiceDemo.createAssistantFirst')}
      </p>

      {callStatus && (
        <div
          aria-live="polite"
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            isErrorStatus
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
              : isCallActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                : isDark
                  ? 'border-[#21426f] bg-[#0d1c36] text-[#c6d6ee]'
                  : 'border-[#d7e2f0] bg-[#f7f9fc] text-[#52637d]'
          }`}
        >
          {callStatus}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={!assistantId || isConnecting}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
              assistantId && !isConnecting
                ? 'bg-[#051752] text-white hover:bg-[#0a245f] dark:bg-[#051752] dark:text-white dark:hover:bg-[#10307c]'
                : 'cursor-not-allowed bg-[#d7e2f0] text-[#7b8da8] dark:bg-white/10 dark:text-[#7d8da5]'
            }`}
          >
            {isConnecting ? 'Bağlanıyor...' : t('onboarding.voiceDemo.startVoiceTest')}
          </button>
        ) : (
          <button
            onClick={endCall}
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            {t('onboarding.voiceDemo.endCall')}
          </button>
        )}
      </div>

      <p className={`mt-4 text-xs leading-6 ${isDark ? 'text-[#9bb2d3]' : 'text-[#71829c]'}`}>
        {t('onboarding.voiceDemo.allowMicrophone')}
      </p>
    </div>
  );
}
