'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import { useState } from 'react';
import Vapi from '@vapi-ai/web';

const VAPI_PUBLIC_KEY = '7f454254-027f-4679-8ced-9cd0e5035f8b';

export default function VoiceDemo({ assistantId, onClose }) {
  const { t } = useLanguage();
  const [isCallActive, setIsCallActive] = useState(false);
  const [vapi, setVapi] = useState(null);
  const [callStatus, setCallStatus] = useState('');

  const startCall = async () => {
    try {
      console.log('🎯 Starting call with assistantId:', assistantId);
      setCallStatus(t('onboarding.voiceDemo.callStatus.starting'));

      const vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
      setVapi(vapiInstance);

      // Event listeners
      vapiInstance.on('call-start', () => {
        console.log('✅ Call started!');
        setIsCallActive(true);
        setCallStatus(t('onboarding.voiceDemo.callStatus.started'));
      });

      vapiInstance.on('call-end', () => {
        console.log('🔴 Call ended');
        setIsCallActive(false);
        setCallStatus(t('onboarding.voiceDemo.callStatus.ended'));
        setVapi(null);
      });

      vapiInstance.on('speech-start', () => {
        setCallStatus(t('onboarding.voiceDemo.callStatus.speaking'));
      });

      vapiInstance.on('speech-end', () => {
        setCallStatus(t('onboarding.voiceDemo.callStatus.listening'));
      });

      vapiInstance.on('error', (error) => {
        console.error('VAPI Error:', error);
        setCallStatus('Error: ' + error.message);
        setIsCallActive(false);
      });

      // Start call
      console.log('📞 Calling vapiInstance.start()...');
      await vapiInstance.start(assistantId);

    } catch (error) {
      console.error('Start call error:', error);
      setCallStatus('Failed to start call: ' + error.message);
      setIsCallActive(false);
    }
  };

  const endCall = () => {
    if (vapi) {
      vapi.stop();
    }
  };

  // 🔧 BUG FIX 2: Kapatma butonu eklendi
  const handleClose = () => {
    if (vapi && isCallActive) {
      vapi.stop();
    }
    if (onClose) {
      onClose();
    }
  };

  console.log('VoiceDemo rendered with assistantId:', assistantId);

  return (
    <div style={{
      padding: '30px',
      background: '#f0f4ff',
      borderRadius: '10px',
      border: '2px solid #4f46e5',
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* 🔧 Close Button */}
      {onClose && (
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      )}

      <h3 style={{ marginBottom: '15px' }}>🎤 {t('onboarding.voiceDemo.title')}</h3>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        {assistantId
          ? t('onboarding.voiceDemo.description')
          : t('onboarding.voiceDemo.createAssistantFirst')}
      </p>

      {callStatus && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          background: isCallActive ? '#d4edda' : '#fff3cd',
          borderRadius: '5px',
          fontSize: '14px'
        }}>
          {callStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={!assistantId}
            style={{
              padding: '15px 30px',
              background: assistantId ? '#4f46e5' : '#e5e7eb',
              color: assistantId ? 'white' : '#999',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: assistantId ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {t('onboarding.voiceDemo.startVoiceTest')}
          </button>
        ) : (
          <button
            onClick={endCall}
            style={{
              padding: '15px 30px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            🔴 {t('onboarding.voiceDemo.endCall')}
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#999', marginTop: '15px' }}>
        {t('onboarding.voiceDemo.allowMicrophone')}
      </p>
    </div>
  );
}
